import { NextResponse } from 'next/server';
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from '@solana/web3.js';
import { createHash } from 'crypto';

// ── Config ──────────────────────────────────────────────────────────
const PROGRAM_ID = new PublicKey(
  process.env.NEXT_PUBLIC_PROGRAM_ID || 'CmHUW6WAUcobsYCHpK2cSgjcYU5KqbW8MDXunK5SzdLA',
);
const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || 'https://api.devnet.solana.com';

const VAULT_SEED = Buffer.from('vault');
const CHANNEL_SEED = Buffer.from('channel');

// ── Anchor discriminators (first 8 bytes of SHA256("global:<method>")) ──
function disc(method: string): Buffer {
  return createHash('sha256').update(`global:${method}`).digest().subarray(0, 8);
}

const IX_INIT_VAULT = disc('initialize_vault');
const IX_DEPOSIT = disc('deposit');
const IX_OPEN_CHANNEL = disc('open_channel');
const IX_SETTLE = disc('settle');

// ── PDA helpers ─────────────────────────────────────────────────────
function vaultPda(owner: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([VAULT_SEED, owner.toBuffer()], PROGRAM_ID);
}

function channelPda(buyer: PublicKey, seller: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [CHANNEL_SEED, buyer.toBuffer(), seller.toBuffer()],
    PROGRAM_ID,
  );
}

// ── Instruction builders ────────────────────────────────────────────
function initVaultIx(owner: PublicKey): TransactionInstruction {
  const [vault] = vaultPda(owner);
  return new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: vault, isSigner: false, isWritable: true },
      { pubkey: owner, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: IX_INIT_VAULT,
  });
}

function depositIx(owner: PublicKey, amount: bigint): TransactionInstruction {
  const [vault] = vaultPda(owner);
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64LE(amount);
  return new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: vault, isSigner: false, isWritable: true },
      { pubkey: owner, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: Buffer.concat([IX_DEPOSIT, buf]),
  });
}

function openChannelIx(buyer: PublicKey, seller: PublicKey): TransactionInstruction {
  const [channel] = channelPda(buyer, seller);
  return new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: channel, isSigner: false, isWritable: true },
      { pubkey: buyer, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: Buffer.concat([IX_OPEN_CHANNEL, seller.toBuffer()]),
  });
}

function settleIx(
  buyer: PublicKey,
  seller: PublicKey,
  amount: bigint,
  nonce: bigint,
  requestHash: Uint8Array,
): TransactionInstruction {
  const [channel] = channelPda(buyer, seller);
  const [buyerVault] = vaultPda(buyer);
  const [sellerVault] = vaultPda(seller);

  const amountBuf = Buffer.alloc(8);
  amountBuf.writeBigUInt64LE(amount);
  const nonceBuf = Buffer.alloc(8);
  nonceBuf.writeBigUInt64LE(nonce);

  return new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: channel, isSigner: false, isWritable: true },
      { pubkey: buyerVault, isSigner: false, isWritable: true },
      { pubkey: sellerVault, isSigner: false, isWritable: true },
      { pubkey: buyer, isSigner: true, isWritable: false },
    ],
    data: Buffer.concat([IX_SETTLE, amountBuf, nonceBuf, Buffer.from(requestHash)]),
  });
}

// ── Helper: send + confirm ──────────────────────────────────────────
async function sendTx(
  conn: Connection,
  ixs: TransactionInstruction[],
  signers: Keypair[],
  feePayer: PublicKey,
): Promise<string> {
  const { blockhash, lastValidBlockHeight } = await conn.getLatestBlockhash('confirmed');
  const tx = new Transaction({ feePayer, recentBlockhash: blockhash });
  tx.add(...ixs);
  tx.sign(...signers);
  const sig = await conn.sendRawTransaction(tx.serialize(), { skipPreflight: false });
  await conn.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, 'confirmed');
  return sig;
}

// ── POST /api/demo ──────────────────────────────────────────────────
export async function POST() {
  try {
    // Load demo keypair from env (base64-encoded 64-byte secret key, or JSON array)
    const raw = process.env.DEMO_KEYPAIR;
    if (!raw) {
      return NextResponse.json(
        {
          error: 'DEMO_KEYPAIR env not set',
          help: 'Set DEMO_KEYPAIR on Vercel to a base64-encoded Solana keypair. Generate with: solana-keygen new --outfile demo.json && base64 -w0 < <(python3 -c "import json; print(bytes(json.load(open(\'demo.json\'))))" )',
        },
        { status: 500 },
      );
    }

    let buyer: Keypair;
    try {
      const trimmed = raw.trim();
      if (trimmed.startsWith('[')) {
        buyer = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(trimmed)));
      } else {
        buyer = Keypair.fromSecretKey(Uint8Array.from(Buffer.from(trimmed, 'base64')));
      }
    } catch {
      return NextResponse.json({ error: 'Invalid DEMO_KEYPAIR format' }, { status: 500 });
    }

    // Deterministic seller from a seed derived from buyer
    const sellerSeed = createHash('sha256').update('ohlarr-demo-seller').update(buyer.publicKey.toBytes()).digest();
    const seller = Keypair.fromSeed(sellerSeed);

    const conn = new Connection(RPC_URL, 'confirmed');

    // Check program exists
    const programInfo = await conn.getAccountInfo(PROGRAM_ID);
    if (!programInfo) {
      return NextResponse.json(
        {
          error: 'Program not deployed',
          programId: PROGRAM_ID.toBase58(),
          help: 'Run the deploy-devnet GitHub Action first.',
        },
        { status: 503 },
      );
    }

    const sigs: { step: string; sig: string; explorer: string }[] = [];

    // Step 1: Init buyer vault (skip if exists)
    const [buyerVaultAddr] = vaultPda(buyer.publicKey);
    const buyerVaultInfo = await conn.getAccountInfo(buyerVaultAddr);
    if (!buyerVaultInfo) {
      const sig = await sendTx(conn, [initVaultIx(buyer.publicKey)], [buyer], buyer.publicKey);
      sigs.push({ step: 'init_buyer_vault', sig, explorer: `https://explorer.solana.com/tx/${sig}?cluster=devnet` });
    }

    // Step 2: Init seller vault (skip if exists)
    const [sellerVaultAddr] = vaultPda(seller.publicKey);
    const sellerVaultInfo = await conn.getAccountInfo(sellerVaultAddr);
    if (!sellerVaultInfo) {
      // Fund seller first (needs SOL for rent)
      const fundSig = await sendTx(
        conn,
        [
          SystemProgram.transfer({
            fromPubkey: buyer.publicKey,
            toPubkey: seller.publicKey,
            lamports: 5_000_000, // 0.005 SOL for rent
          }),
        ],
        [buyer],
        buyer.publicKey,
      );
      sigs.push({ step: 'fund_seller', sig: fundSig, explorer: `https://explorer.solana.com/tx/${fundSig}?cluster=devnet` });

      const sig = await sendTx(conn, [initVaultIx(seller.publicKey)], [seller], seller.publicKey);
      sigs.push({ step: 'init_seller_vault', sig, explorer: `https://explorer.solana.com/tx/${sig}?cluster=devnet` });
    }

    // Step 3: Open channel (skip if exists)
    const [channelAddr] = channelPda(buyer.publicKey, seller.publicKey);
    const channelInfo = await conn.getAccountInfo(channelAddr);
    let currentNonce = 0n;
    if (!channelInfo) {
      const sig = await sendTx(
        conn,
        [openChannelIx(buyer.publicKey, seller.publicKey)],
        [buyer],
        buyer.publicKey,
      );
      sigs.push({ step: 'open_channel', sig, explorer: `https://explorer.solana.com/tx/${sig}?cluster=devnet` });
    } else {
      // Read current nonce from channel data
      const view = new DataView(channelInfo.data.buffer, channelInfo.data.byteOffset, channelInfo.data.byteLength);
      currentNonce = view.getBigUint64(72, true); // 8 disc + 32 buyer + 32 seller = 72
    }

    // Step 4: Deposit to buyer vault
    const amount = BigInt(1000 + Math.floor(Math.random() * 4000)); // 1000–5000 lamports
    const depositSig = await sendTx(
      conn,
      [depositIx(buyer.publicKey, amount)],
      [buyer],
      buyer.publicKey,
    );
    sigs.push({ step: 'deposit', sig: depositSig, explorer: `https://explorer.solana.com/tx/${depositSig}?cluster=devnet` });

    // Step 5: Settle payment
    const nextNonce = currentNonce + 1n;
    const requestHash = createHash('sha256')
      .update(`demo-request-${Date.now()}`)
      .digest();

    const settleSig = await sendTx(
      conn,
      [settleIx(buyer.publicKey, seller.publicKey, amount, nextNonce, requestHash)],
      [buyer],
      buyer.publicKey,
    );
    sigs.push({ step: 'settle', sig: settleSig, explorer: `https://explorer.solana.com/tx/${settleSig}?cluster=devnet` });

    return NextResponse.json({
      success: true,
      buyer: buyer.publicKey.toBase58(),
      seller: seller.publicKey.toBase58(),
      channel: channelAddr.toBase58(),
      amount: Number(amount),
      nonce: Number(nextNonce),
      transactions: sigs,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ── GET /api/demo — health check ────────────────────────────────────
export async function GET() {
  const conn = new Connection(RPC_URL, 'confirmed');
  const programInfo = await conn.getAccountInfo(PROGRAM_ID);
  return NextResponse.json({
    programId: PROGRAM_ID.toBase58(),
    deployed: !!programInfo,
    rpc: RPC_URL,
    demo_keypair_set: !!process.env.DEMO_KEYPAIR,
  });
}
