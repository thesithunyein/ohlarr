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

// ── Live AI Agent Demo: ohlarr.com/api/agent-buy ─────────────────────
// Simulates an autonomous agent making an x402 purchase end-to-end.
// 1. GET /api/x402/oracle/btc-usd  →  402 challenge
// 2. Agent signs + sends settle tx to devnet
// 3. GET again with X-PAYMENT header  →  200 with BTC price
// Returns the full HTTP transcript for the dashboard to render.

const PROGRAM_ID = new PublicKey(
  process.env.NEXT_PUBLIC_PROGRAM_ID || 'CmHUW6WAUcobsYCHpK2cSgjcYU5KqbW8MDXunK5SzdLA',
);
const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || 'https://api.devnet.solana.com';

const VAULT_SEED = Buffer.from('vault');
const CHANNEL_SEED = Buffer.from('channel');

function disc(method: string): Buffer {
  return createHash('sha256').update(`global:${method}`).digest().subarray(0, 8);
}

const IX_SETTLE = disc('settle');

function vaultPda(owner: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([VAULT_SEED, owner.toBuffer()], PROGRAM_ID);
}

function channelPda(buyer: PublicKey, seller: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [CHANNEL_SEED, buyer.toBuffer(), seller.toBuffer()],
    PROGRAM_ID,
  );
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

export async function POST(req: Request) {
  const transcript: { step: string; type: 'http' | 'chain' | 'info'; detail: string; data?: unknown }[] = [];
  const t0 = Date.now();

  try {
    const raw = process.env.DEMO_KEYPAIR;
    if (!raw) {
      return NextResponse.json({ error: 'DEMO_KEYPAIR not set' }, { status: 500 });
    }
    const trimmed = raw.trim();
    const buyer = trimmed.startsWith('[')
      ? Keypair.fromSecretKey(Uint8Array.from(JSON.parse(trimmed)))
      : Keypair.fromSecretKey(Uint8Array.from(Buffer.from(trimmed, 'base64')));
    const sellerSeed = createHash('sha256')
      .update('ohlarr-demo-seller')
      .update(buyer.publicKey.toBytes())
      .digest();
    const seller = Keypair.fromSeed(sellerSeed);

    const conn = new Connection(RPC_URL, 'confirmed');

    // Build the absolute URL for the x402 endpoint
    const origin = new URL(req.url).origin;
    const x402Url = `${origin}/api/x402/oracle/btc-usd`;

    transcript.push({
      step: '1',
      type: 'info',
      detail: `🤖 Agent ${buyer.publicKey.toBase58().slice(0, 8)}... wants BTC/USD price`,
    });

    // Step 1: GET without payment → expect 402
    transcript.push({ step: '2', type: 'http', detail: `GET ${x402Url}` });
    const r1 = await fetch(x402Url, { method: 'GET' });
    const challenge = await r1.json();
    transcript.push({
      step: '3',
      type: 'http',
      detail: `← 402 Payment Required`,
      data: challenge,
    });

    if (r1.status !== 402) {
      throw new Error(`Expected 402, got ${r1.status}`);
    }

    // Step 2: Sign + settle on devnet
    transcript.push({
      step: '4',
      type: 'info',
      detail: `🔐 Agent signs challenge with Solana keypair...`,
    });

    // Get current channel nonce
    const [channelAddr] = channelPda(buyer.publicKey, seller.publicKey);
    const channelInfo = await conn.getAccountInfo(channelAddr);
    let currentNonce = 0n;
    if (channelInfo && channelInfo.data.length >= 80) {
      const view = new DataView(
        channelInfo.data.buffer,
        channelInfo.data.byteOffset,
        channelInfo.data.byteLength,
      );
      currentNonce = view.getBigUint64(72, true);
    }
    const nextNonce = currentNonce + 1n;
    const amount = BigInt(challenge.amount?.lamports || 1000);
    const reqHash = createHash('sha256').update(challenge.requestHash || 'demo').digest();

    transcript.push({
      step: '5',
      type: 'chain',
      detail: `Sending Settle ix to Solana devnet (${amount} lamports, nonce ${nextNonce})`,
    });

    const txSig = await sendTx(
      conn,
      [settleIx(buyer.publicKey, seller.publicKey, amount, nextNonce, reqHash)],
      [buyer],
      buyer.publicKey,
    );

    transcript.push({
      step: '6',
      type: 'chain',
      detail: `✅ Settled on-chain`,
      data: {
        txSig,
        explorer: `https://explorer.solana.com/tx/${txSig}?cluster=devnet`,
      },
    });

    // Step 3: Retry with X-PAYMENT header
    const paymentHeader = Buffer.from(JSON.stringify({ txSig, scheme: 'ohlarr-x402-v1' })).toString(
      'base64',
    );

    transcript.push({
      step: '7',
      type: 'http',
      detail: `GET ${x402Url} (X-PAYMENT: ${paymentHeader.slice(0, 24)}...)`,
    });
    const r2 = await fetch(x402Url, {
      method: 'GET',
      headers: { 'X-PAYMENT': paymentHeader },
    });
    const data = await r2.json();
    transcript.push({
      step: '8',
      type: 'http',
      detail: `← ${r2.status} ${r2.statusText || 'OK'}`,
      data,
    });

    transcript.push({
      step: '9',
      type: 'info',
      detail: `🎯 Agent received BTC/USD = $${data.price?.toLocaleString?.() || data.price} in ${Date.now() - t0}ms`,
    });

    return NextResponse.json({
      success: true,
      durationMs: Date.now() - t0,
      finalPrice: data.price,
      txSig,
      explorer: `https://explorer.solana.com/tx/${txSig}?cluster=devnet`,
      transcript,
    });
  } catch (err) {
    transcript.push({
      step: 'error',
      type: 'info',
      detail: `❌ ${err instanceof Error ? err.message : String(err)}`,
    });
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'unknown', transcript },
      { status: 500 },
    );
  }
}
