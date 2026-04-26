/**
 * Anchor integration test suite. Runs against `solana-test-validator` (or
 * devnet via Anchor.toml override).
 *
 *   anchor test
 */
import * as anchor from '@coral-xyz/anchor';
import { Program, BN } from '@coral-xyz/anchor';
import { Keypair, LAMPORTS_PER_SOL, PublicKey, SystemProgram } from '@solana/web3.js';
import { assert } from 'chai';
import { OhlarrPayments } from '../target/types/ohlarr_payments';

describe('ohlarr_payments', () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.OhlarrPayments as Program<OhlarrPayments>;

  const buyer = Keypair.generate();
  const seller = Keypair.generate();

  const [buyerVault] = PublicKey.findProgramAddressSync(
    [Buffer.from('vault'), buyer.publicKey.toBuffer()],
    program.programId,
  );
  const [sellerVault] = PublicKey.findProgramAddressSync(
    [Buffer.from('vault'), seller.publicKey.toBuffer()],
    program.programId,
  );
  const [channel] = PublicKey.findProgramAddressSync(
    [Buffer.from('channel'), buyer.publicKey.toBuffer(), seller.publicKey.toBuffer()],
    program.programId,
  );

  before(async () => {
    for (const kp of [buyer, seller]) {
      const sig = await provider.connection.requestAirdrop(kp.publicKey, 2 * LAMPORTS_PER_SOL);
      await provider.connection.confirmTransaction(sig);
    }
  });

  it('initializes both vaults', async () => {
    await program.methods
      .initializeVault()
      .accountsStrict({
        vault: buyerVault,
        owner: buyer.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([buyer])
      .rpc();

    await program.methods
      .initializeVault()
      .accountsStrict({
        vault: sellerVault,
        owner: seller.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([seller])
      .rpc();

    const v = await program.account.vault.fetch(buyerVault);
    assert.equal(v.owner.toBase58(), buyer.publicKey.toBase58());
    assert.equal(v.balance.toNumber(), 0);
  });

  it('deposits into the buyer vault', async () => {
    await program.methods
      .deposit(new BN(50_000))
      .accountsStrict({
        vault: buyerVault,
        owner: buyer.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([buyer])
      .rpc();

    const v = await program.account.vault.fetch(buyerVault);
    assert.equal(v.balance.toNumber(), 50_000);
  });

  it('opens a payment channel', async () => {
    await program.methods
      .openChannel(seller.publicKey)
      .accountsStrict({
        channel,
        buyer: buyer.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([buyer])
      .rpc();

    const c = await program.account.paymentChannel.fetch(channel);
    assert.equal(c.buyer.toBase58(), buyer.publicKey.toBase58());
    assert.equal(c.seller.toBase58(), seller.publicKey.toBase58());
    assert.equal(c.nonce.toNumber(), 0);
  });

  it('settles a payment with monotonic nonce', async () => {
    const requestHash = new Uint8Array(32).fill(7);
    await program.methods
      .settle(new BN(1000), new BN(1), Array.from(requestHash))
      .accountsStrict({
        channel,
        buyerVault,
        sellerVault,
        buyer: buyer.publicKey,
      })
      .signers([buyer])
      .rpc();

    const c = await program.account.paymentChannel.fetch(channel);
    const bv = await program.account.vault.fetch(buyerVault);
    const sv = await program.account.vault.fetch(sellerVault);
    assert.equal(c.nonce.toNumber(), 1);
    assert.equal(c.totalSettled.toNumber(), 1000);
    assert.equal(bv.balance.toNumber(), 49_000);
    assert.equal(sv.balance.toNumber(), 1000);
  });

  it('rejects bad nonce', async () => {
    const requestHash = new Uint8Array(32).fill(8);
    try {
      await program.methods
        .settle(new BN(500), new BN(7), Array.from(requestHash)) // should be 2
        .accountsStrict({
          channel,
          buyerVault,
          sellerVault,
          buyer: buyer.publicKey,
        })
        .signers([buyer])
        .rpc();
      assert.fail('expected BadNonce');
    } catch (err) {
      assert.match(String(err), /BadNonce/);
    }
  });

  it('rejects insufficient balance', async () => {
    const requestHash = new Uint8Array(32).fill(9);
    try {
      await program.methods
        .settle(new BN(10_000_000), new BN(2), Array.from(requestHash))
        .accountsStrict({
          channel,
          buyerVault,
          sellerVault,
          buyer: buyer.publicKey,
        })
        .signers([buyer])
        .rpc();
      assert.fail('expected InsufficientFunds');
    } catch (err) {
      assert.match(String(err), /InsufficientFunds/);
    }
  });
});
