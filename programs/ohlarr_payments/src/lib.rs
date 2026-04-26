//! Ohlarr Payments — private payment rails for autonomous agents.
//!
//! Architecture:
//!   * Buyer & seller each own a `Vault` PDA holding lamports.
//!   * A `PaymentChannel` PDA represents a bilateral relationship.
//!   * Vaults & channels are *delegated* into a MagicBlock Private Ephemeral
//!     Rollup (PER, running inside an Intel TDX TEE). A `Permission` PDA
//!     (managed by MagicBlock's Permission Program) gates who can read or
//!     mutate that delegated state.
//!   * `settle()` runs *inside* the PER — amounts and counterparties remain
//!     confidential to non-members. State periodically commits to Solana L1.
//!
//! Layered with the x402 HTTP handshake (see `packages/sdk`), this gives every
//! HTTP API a private payment rail.

use anchor_lang::prelude::*;
use ephemeral_rollups_sdk::access_control::instructions::{
    CommitAndUndelegatePermissionCpiBuilder, CreatePermissionCpiBuilder,
    DelegatePermissionCpiBuilder,
};
use ephemeral_rollups_sdk::access_control::structs::{Member, MembersArgs, PERMISSION_SEED};
use ephemeral_rollups_sdk::anchor::{commit, delegate, ephemeral};
use ephemeral_rollups_sdk::consts::PERMISSION_PROGRAM_ID;
use ephemeral_rollups_sdk::cpi::DelegateConfig;
use ephemeral_rollups_sdk::ephem::MagicIntentBundleBuilder;

declare_id!("OhLaRR1111111111111111111111111111111111111");

pub const VAULT_SEED: &[u8] = b"vault";
pub const CHANNEL_SEED: &[u8] = b"channel";

#[ephemeral]
#[program]
pub mod ohlarr_payments {
    use super::*;

    /// Initialize a vault on Solana L1 for a given owner. Idempotent.
    pub fn initialize_vault(ctx: Context<InitializeVault>) -> Result<()> {
        let vault = &mut ctx.accounts.vault;
        if vault.owner == Pubkey::default() {
            vault.owner = ctx.accounts.owner.key();
            vault.balance = 0;
            vault.bump = ctx.bumps.vault;
            emit!(VaultInitialized {
                vault: vault.key(),
                owner: vault.owner,
            });
        }
        Ok(())
    }

    /// Deposit lamports into the L1 vault. Only callable when undelegated.
    pub fn deposit(ctx: Context<Deposit>, amount: u64) -> Result<()> {
        require!(amount > 0, OhlarrError::ZeroAmount);

        let cpi = anchor_lang::system_program::Transfer {
            from: ctx.accounts.owner.to_account_info(),
            to: ctx.accounts.vault.to_account_info(),
        };
        anchor_lang::system_program::transfer(
            CpiContext::new(ctx.accounts.system_program.to_account_info(), cpi),
            amount,
        )?;

        let vault = &mut ctx.accounts.vault;
        vault.balance = vault.balance.checked_add(amount).ok_or(OhlarrError::Overflow)?;
        emit!(VaultDeposited {
            vault: vault.key(),
            owner: ctx.accounts.owner.key(),
            amount,
            new_balance: vault.balance,
        });
        Ok(())
    }

    /// Delegate the vault into the Private Ephemeral Rollup with a member ACL.
    /// After this call, all reads and mutations of vault state are confined to
    /// the TEE and gated by the Permission Program.
    pub fn delegate_vault_private(
        ctx: Context<DelegateVaultPrivately>,
        members: Option<Vec<Member>>,
    ) -> Result<()> {
        let owner_key = ctx.accounts.owner.key();
        let validator = ctx.accounts.validator.as_ref();

        // 1. Permission account — created if missing.
        if ctx.accounts.permission.data_is_empty() {
            CreatePermissionCpiBuilder::new(&ctx.accounts.permission_program)
                .permissioned_account(&ctx.accounts.vault.to_account_info())
                .permission(&ctx.accounts.permission.to_account_info())
                .payer(&ctx.accounts.payer.to_account_info())
                .system_program(&ctx.accounts.system_program.to_account_info())
                .args(MembersArgs { members })
                .invoke_signed(&[&[VAULT_SEED, owner_key.as_ref(), &[ctx.bumps.vault]]])?;
        }

        // 2. Delegate the permission account so it lives in PER.
        if ctx.accounts.permission.owner != &ephemeral_rollups_sdk::id() {
            DelegatePermissionCpiBuilder::new(&ctx.accounts.permission_program.to_account_info())
                .permissioned_account(&ctx.accounts.vault.to_account_info(), true)
                .permission(&ctx.accounts.permission.to_account_info())
                .payer(&ctx.accounts.payer.to_account_info())
                .authority(&ctx.accounts.vault.to_account_info(), false)
                .system_program(&ctx.accounts.system_program.to_account_info())
                .owner_program(&ctx.accounts.permission_program.to_account_info())
                .delegation_buffer(&ctx.accounts.buffer_permission.to_account_info())
                .delegation_metadata(&ctx.accounts.delegation_metadata_permission.to_account_info())
                .delegation_record(&ctx.accounts.delegation_record_permission.to_account_info())
                .delegation_program(&ctx.accounts.delegation_program.to_account_info())
                .validator(validator)
                .invoke_signed(&[&[VAULT_SEED, owner_key.as_ref(), &[ctx.bumps.vault]]])?;
        }

        // 3. Delegate the vault itself.
        if ctx.accounts.vault.owner != &ephemeral_rollups_sdk::id() {
            ctx.accounts.delegate_vault(
                &ctx.accounts.payer,
                &[VAULT_SEED, owner_key.as_ref()],
                DelegateConfig {
                    validator: validator.map(|v| v.key()),
                    ..Default::default()
                },
            )?;
        }

        Ok(())
    }

    /// Open a bilateral payment channel between buyer and seller, *inside* PER.
    /// Idempotent: re-opening returns existing state.
    pub fn open_channel(ctx: Context<OpenChannel>, seller: Pubkey) -> Result<()> {
        let channel = &mut ctx.accounts.channel;
        if channel.buyer == Pubkey::default() {
            channel.buyer = ctx.accounts.buyer.key();
            channel.seller = seller;
            channel.nonce = 0;
            channel.total_settled = 0;
            channel.bump = ctx.bumps.channel;
            emit!(ChannelOpened {
                channel: channel.key(),
                buyer: channel.buyer,
                seller: channel.seller,
            });
        }
        Ok(())
    }

    /// Settle a single x402 payment inside the PER. Atomically:
    ///   * verifies nonce monotonicity
    ///   * debits buyer vault
    ///   * credits seller vault
    ///   * stores the request hash as a non-repudiable receipt
    ///
    /// `request_hash` is BLAKE3(canonical(x402_request)) committed by the buyer.
    pub fn settle(
        ctx: Context<Settle>,
        amount: u64,
        nonce: u64,
        request_hash: [u8; 32],
    ) -> Result<()> {
        require!(amount > 0, OhlarrError::ZeroAmount);

        let channel = &mut ctx.accounts.channel;
        require!(nonce == channel.nonce + 1, OhlarrError::BadNonce);
        require_keys_eq!(channel.buyer, ctx.accounts.buyer_vault.owner, OhlarrError::WrongBuyer);
        require_keys_eq!(channel.seller, ctx.accounts.seller_vault.owner, OhlarrError::WrongSeller);

        let buyer_vault = &mut ctx.accounts.buyer_vault;
        let seller_vault = &mut ctx.accounts.seller_vault;

        require!(buyer_vault.balance >= amount, OhlarrError::InsufficientFunds);

        buyer_vault.balance = buyer_vault.balance.checked_sub(amount).ok_or(OhlarrError::Overflow)?;
        seller_vault.balance = seller_vault.balance.checked_add(amount).ok_or(OhlarrError::Overflow)?;
        channel.nonce = nonce;
        channel.total_settled = channel.total_settled.checked_add(amount).ok_or(OhlarrError::Overflow)?;
        channel.last_request_hash = request_hash;

        emit!(PaymentSettled {
            channel: channel.key(),
            nonce,
            amount,
            request_hash,
        });
        Ok(())
    }

    /// Commit channel & vault state back to Solana L1 and undelegate, ending
    /// the private session. Net balances become public; per-call detail does not.
    pub fn close_and_commit_channel(ctx: Context<CloseChannel>) -> Result<()> {
        // Commit & undelegate the permission accounts (one for each delegated PDA).
        CommitAndUndelegatePermissionCpiBuilder::new(
            &ctx.accounts.permission_program.to_account_info(),
        )
        .authority(&ctx.accounts.payer.to_account_info(), true)
        .permissioned_account(&ctx.accounts.buyer_vault.to_account_info(), true)
        .permission(&ctx.accounts.buyer_permission.to_account_info())
        .magic_context(&ctx.accounts.magic_context.to_account_info())
        .magic_program(&ctx.accounts.magic_program.to_account_info())
        .invoke()?;

        // Commit & undelegate the actual data accounts in one bundle.
        MagicIntentBundleBuilder::new(
            ctx.accounts.payer.to_account_info(),
            ctx.accounts.magic_context.to_account_info(),
            ctx.accounts.magic_program.to_account_info(),
        )
        .commit_and_undelegate(&[
            ctx.accounts.buyer_vault.to_account_info(),
            ctx.accounts.channel.to_account_info(),
        ])
        .build_and_invoke()?;

        Ok(())
    }
}

// ============================================================================
//  Accounts
// ============================================================================

#[derive(Accounts)]
pub struct InitializeVault<'info> {
    #[account(
        init_if_needed,
        payer = owner,
        space = 8 + Vault::INIT_SPACE,
        seeds = [VAULT_SEED, owner.key().as_ref()],
        bump,
    )]
    pub vault: Account<'info, Vault>,
    #[account(mut)]
    pub owner: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Deposit<'info> {
    #[account(
        mut,
        seeds = [VAULT_SEED, owner.key().as_ref()],
        bump = vault.bump,
        has_one = owner,
    )]
    pub vault: Account<'info, Vault>,
    #[account(mut)]
    pub owner: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[delegate]
#[derive(Accounts)]
pub struct DelegateVaultPrivately<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    /// CHECK: vault owner — used only to derive the seed.
    pub owner: AccountInfo<'info>,
    /// CHECK: PDA delegated to PER.
    #[account(
        mut, del,
        seeds = [VAULT_SEED, owner.key().as_ref()],
        bump,
    )]
    pub vault: AccountInfo<'info>,
    /// CHECK: Permission PDA managed by MagicBlock Permission Program.
    #[account(
        mut,
        seeds = [PERMISSION_SEED, vault.key().as_ref()],
        bump,
        seeds::program = permission_program.key(),
    )]
    pub permission: AccountInfo<'info>,
    /// CHECK: delegation buffer for the permission account.
    #[account(
        mut,
        seeds = [ephemeral_rollups_sdk::pda::DELEGATE_BUFFER_TAG, permission.key().as_ref()],
        bump,
        seeds::program = PERMISSION_PROGRAM_ID,
    )]
    pub buffer_permission: AccountInfo<'info>,
    /// CHECK: delegation record for the permission account.
    #[account(
        mut,
        seeds = [ephemeral_rollups_sdk::pda::DELEGATION_RECORD_TAG, permission.key().as_ref()],
        bump,
        seeds::program = ephemeral_rollups_sdk::id(),
    )]
    pub delegation_record_permission: AccountInfo<'info>,
    /// CHECK: delegation metadata for the permission account.
    #[account(
        mut,
        seeds = [ephemeral_rollups_sdk::pda::DELEGATION_METADATA_TAG, permission.key().as_ref()],
        bump,
        seeds::program = ephemeral_rollups_sdk::id(),
    )]
    pub delegation_metadata_permission: AccountInfo<'info>,
    /// CHECK: MagicBlock Permission Program.
    #[account(address = PERMISSION_PROGRAM_ID)]
    pub permission_program: AccountInfo<'info>,
    pub system_program: Program<'info, System>,
    /// CHECK: optional ER validator override.
    pub validator: Option<AccountInfo<'info>>,
}

#[derive(Accounts)]
#[instruction(seller: Pubkey)]
pub struct OpenChannel<'info> {
    #[account(
        init_if_needed,
        payer = buyer,
        space = 8 + PaymentChannel::INIT_SPACE,
        seeds = [CHANNEL_SEED, buyer.key().as_ref(), seller.as_ref()],
        bump,
    )]
    pub channel: Account<'info, PaymentChannel>,
    #[account(mut)]
    pub buyer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Settle<'info> {
    #[account(
        mut,
        seeds = [CHANNEL_SEED, buyer_vault.owner.as_ref(), seller_vault.owner.as_ref()],
        bump = channel.bump,
    )]
    pub channel: Account<'info, PaymentChannel>,
    #[account(
        mut,
        seeds = [VAULT_SEED, buyer_vault.owner.as_ref()],
        bump = buyer_vault.bump,
    )]
    pub buyer_vault: Account<'info, Vault>,
    #[account(
        mut,
        seeds = [VAULT_SEED, seller_vault.owner.as_ref()],
        bump = seller_vault.bump,
    )]
    pub seller_vault: Account<'info, Vault>,
    pub buyer: Signer<'info>,
}

#[commit]
#[derive(Accounts)]
pub struct CloseChannel<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(mut)]
    pub buyer_vault: Account<'info, Vault>,
    #[account(mut)]
    pub channel: Account<'info, PaymentChannel>,
    /// CHECK: managed by MagicBlock Permission Program.
    #[account(
        mut,
        seeds = [PERMISSION_SEED, buyer_vault.key().as_ref()],
        bump,
        seeds::program = permission_program.key(),
    )]
    pub buyer_permission: AccountInfo<'info>,
    /// CHECK: MagicBlock Permission Program.
    #[account(address = PERMISSION_PROGRAM_ID)]
    pub permission_program: UncheckedAccount<'info>,
}

// ============================================================================
//  State
// ============================================================================

#[account]
#[derive(InitSpace)]
pub struct Vault {
    pub owner: Pubkey,
    pub balance: u64,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct PaymentChannel {
    pub buyer: Pubkey,
    pub seller: Pubkey,
    pub nonce: u64,
    pub total_settled: u64,
    pub last_request_hash: [u8; 32],
    pub bump: u8,
}

// ============================================================================
//  Events
// ============================================================================

#[event]
pub struct VaultInitialized {
    pub vault: Pubkey,
    pub owner: Pubkey,
}

#[event]
pub struct VaultDeposited {
    pub vault: Pubkey,
    pub owner: Pubkey,
    pub amount: u64,
    pub new_balance: u64,
}

#[event]
pub struct ChannelOpened {
    pub channel: Pubkey,
    pub buyer: Pubkey,
    pub seller: Pubkey,
}

#[event]
pub struct PaymentSettled {
    pub channel: Pubkey,
    pub nonce: u64,
    pub amount: u64,
    pub request_hash: [u8; 32],
}

// ============================================================================
//  Errors
// ============================================================================

#[error_code]
pub enum OhlarrError {
    #[msg("amount must be greater than zero")]
    ZeroAmount,
    #[msg("arithmetic overflow")]
    Overflow,
    #[msg("nonce must be exactly previous + 1")]
    BadNonce,
    #[msg("buyer mismatch")]
    WrongBuyer,
    #[msg("seller mismatch")]
    WrongSeller,
    #[msg("insufficient buyer balance")]
    InsufficientFunds,
}
