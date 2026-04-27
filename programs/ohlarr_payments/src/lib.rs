// Ohlarr Payments — Solana program (Anchor 0.31)
//
// Settlement primitive for x402 agent payments routed through MagicBlock's
// Private Ephemeral Rollup. Two PDAs:
//   - Vault     (per owner)        : holds escrowed lamports
//   - Channel   (buyer × seller)   : monotonic nonce + total settled
//
// Privacy lives at the *transport* layer — every settlement transaction is
// submitted via the PER RPC endpoint (devnet-tee.magicblock.app). The PER
// validator runs inside Intel TDX, so amounts and intent are confidential to
// non-Permission-members. The on-chain program itself is intentionally a
// minimal escrow — the simpler, the more auditable.
//
// Future work (not on critical path for hackathon submission): add direct
// CPI to MagicBlock's Delegation + Permission programs. The current SDK
// crate `ephemeral-rollups-sdk@0.2.x` has compile-time conflicts with the
// solana-program version pulled by Anchor 0.31, so we route through the
// programs at the runtime layer in the TS SDK instead.

use anchor_lang::prelude::*;

declare_id!("CmHUW6WAUcobsYCHpK2cSgjcYU5KqbW8MDXunK5SzdLA");

pub const VAULT_SEED: &[u8] = b"vault";
pub const CHANNEL_SEED: &[u8] = b"channel";

#[program]
pub mod ohlarr_payments {
    use super::*;

    /// Initialize a vault PDA owned by `owner` (idempotent via `init_if_needed` is
    /// not used to keep things explicit — call once per owner).
    pub fn initialize_vault(ctx: Context<InitializeVault>) -> Result<()> {
        let v = &mut ctx.accounts.vault;
        v.owner = ctx.accounts.owner.key();
        v.balance = 0;
        v.bump = ctx.bumps.vault;
        Ok(())
    }

    /// Deposit lamports from the owner into their vault PDA.
    pub fn deposit(ctx: Context<Deposit>, amount: u64) -> Result<()> {
        require!(amount > 0, OhlarrError::ZeroAmount);

        let cpi_accounts = anchor_lang::system_program::Transfer {
            from: ctx.accounts.owner.to_account_info(),
            to: ctx.accounts.vault.to_account_info(),
        };
        let cpi_ctx = CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            cpi_accounts,
        );
        anchor_lang::system_program::transfer(cpi_ctx, amount)?;

        ctx.accounts.vault.balance = ctx
            .accounts
            .vault
            .balance
            .checked_add(amount)
            .ok_or(OhlarrError::MathOverflow)?;
        Ok(())
    }

    /// Open a payment channel between buyer (signer) and seller (param).
    pub fn open_channel(ctx: Context<OpenChannel>, seller: Pubkey) -> Result<()> {
        let c = &mut ctx.accounts.channel;
        c.buyer = ctx.accounts.buyer.key();
        c.seller = seller;
        c.nonce = 0;
        c.total_settled = 0;
        c.bump = ctx.bumps.channel;
        emit!(ChannelOpened {
            buyer: c.buyer,
            seller: c.seller,
            channel: ctx.accounts.channel.key(),
        });
        Ok(())
    }

    /// Settle a single x402 payment. Buyer signs; the PER validator forwards
    /// the tx privately. Enforces monotonic nonce and balance availability.
    /// `request_hash` binds the payment to a specific HTTP request body.
    pub fn settle(
        ctx: Context<Settle>,
        amount: u64,
        nonce: u64,
        request_hash: [u8; 32],
    ) -> Result<()> {
        require!(amount > 0, OhlarrError::ZeroAmount);

        let channel = &mut ctx.accounts.channel;
        let buyer_vault = &mut ctx.accounts.buyer_vault;
        let seller_vault = &mut ctx.accounts.seller_vault;

        require!(
            nonce == channel.nonce.checked_add(1).ok_or(OhlarrError::MathOverflow)?,
            OhlarrError::BadNonce,
        );
        require!(buyer_vault.balance >= amount, OhlarrError::InsufficientFunds);
        require_keys_eq!(buyer_vault.owner, channel.buyer, OhlarrError::WrongVault);
        require_keys_eq!(seller_vault.owner, channel.seller, OhlarrError::WrongVault);

        buyer_vault.balance = buyer_vault.balance.checked_sub(amount).unwrap();
        seller_vault.balance = seller_vault
            .balance
            .checked_add(amount)
            .ok_or(OhlarrError::MathOverflow)?;

        channel.nonce = nonce;
        channel.total_settled = channel
            .total_settled
            .checked_add(amount)
            .ok_or(OhlarrError::MathOverflow)?;

        emit!(PaymentSettled {
            channel: channel.key(),
            amount,
            nonce,
            request_hash,
        });
        Ok(())
    }
}

// ───────────────────────── Accounts ─────────────────────────

#[derive(Accounts)]
pub struct InitializeVault<'info> {
    #[account(
        init,
        payer = owner,
        space = 8 + Vault::LEN,
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

#[derive(Accounts)]
#[instruction(seller: Pubkey)]
pub struct OpenChannel<'info> {
    #[account(
        init,
        payer = buyer,
        space = 8 + PaymentChannel::LEN,
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
        seeds = [CHANNEL_SEED, channel.buyer.as_ref(), channel.seller.as_ref()],
        bump = channel.bump,
    )]
    pub channel: Account<'info, PaymentChannel>,
    #[account(
        mut,
        seeds = [VAULT_SEED, channel.buyer.as_ref()],
        bump = buyer_vault.bump,
    )]
    pub buyer_vault: Account<'info, Vault>,
    #[account(
        mut,
        seeds = [VAULT_SEED, channel.seller.as_ref()],
        bump = seller_vault.bump,
    )]
    pub seller_vault: Account<'info, Vault>,
    pub buyer: Signer<'info>,
}

// ───────────────────────── State ─────────────────────────

#[account]
pub struct Vault {
    pub owner: Pubkey,
    pub balance: u64,
    pub bump: u8,
}
impl Vault {
    pub const LEN: usize = 32 + 8 + 1;
}

#[account]
pub struct PaymentChannel {
    pub buyer: Pubkey,
    pub seller: Pubkey,
    pub nonce: u64,
    pub total_settled: u64,
    pub bump: u8,
}
impl PaymentChannel {
    pub const LEN: usize = 32 + 32 + 8 + 8 + 1;
}

// ───────────────────────── Events ─────────────────────────

#[event]
pub struct ChannelOpened {
    pub buyer: Pubkey,
    pub seller: Pubkey,
    pub channel: Pubkey,
}

#[event]
pub struct PaymentSettled {
    pub channel: Pubkey,
    pub amount: u64,
    pub nonce: u64,
    pub request_hash: [u8; 32],
}

// ───────────────────────── Errors ─────────────────────────

#[error_code]
pub enum OhlarrError {
    #[msg("Amount must be > 0")]
    ZeroAmount,
    #[msg("Math overflow")]
    MathOverflow,
    #[msg("Nonce must increase by exactly 1")]
    BadNonce,
    #[msg("Insufficient vault balance")]
    InsufficientFunds,
    #[msg("Wrong vault for this channel party")]
    WrongVault,
}
