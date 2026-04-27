import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { Connection, PublicKey } from '@solana/web3.js';

// ── Live x402 endpoint: /api/x402/oracle/btc-usd ─────────────────────
// Implements the Coinbase x402 spec (HTTP 402 Payment Required).
// Returns a paywall challenge unless the client provides a valid Ohlarr
// settlement receipt in the `X-PAYMENT` header.

const PROGRAM_ID = new PublicKey(
  process.env.NEXT_PUBLIC_PROGRAM_ID || 'CmHUW6WAUcobsYCHpK2cSgjcYU5KqbW8MDXunK5SzdLA',
);
const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || 'https://api.devnet.solana.com';

const PRICE_LAMPORTS = 1000; // 0.000001 SOL per request
const RESOURCE = '/v1/oracle/btc-usd';

// ── x402 challenge envelope ─────────────────────────────────────────
function buildChallenge(reqHash: string) {
  return {
    scheme: 'ohlarr-x402-v1',
    network: 'solana-devnet',
    resource: RESOURCE,
    description: 'Real-time BTC/USD oracle. Paid per request via Ohlarr PER.',
    amount: { lamports: PRICE_LAMPORTS },
    payTo: PROGRAM_ID.toBase58(),
    requestHash: reqHash,
    nonce: Date.now(),
    expiresIn: 60,
  };
}

// ── GET — returns 402 unless paid ──────────────────────────────────
export async function GET(req: NextRequest) {
  const reqHash = createHash('sha256')
    .update(`${RESOURCE}:${req.headers.get('user-agent') || 'unknown'}:${Date.now()}`)
    .digest('hex');

  const payment = req.headers.get('x-payment');

  // No payment → 402 Payment Required
  if (!payment) {
    return NextResponse.json(buildChallenge(reqHash), {
      status: 402,
      headers: {
        'WWW-Authenticate': 'OhlarrX402',
        'X-Payment-Required': 'true',
      },
    });
  }

  // Payment provided → verify on-chain
  try {
    const decoded = JSON.parse(Buffer.from(payment, 'base64').toString());
    const txSig = decoded.txSig;
    if (!txSig) throw new Error('missing txSig');

    const conn = new Connection(RPC_URL, 'confirmed');
    const tx = await conn.getTransaction(txSig, {
      maxSupportedTransactionVersion: 0,
      commitment: 'confirmed',
    });

    if (!tx || tx.meta?.err) {
      return NextResponse.json(
        { error: 'invalid_payment', reason: 'tx not found or failed' },
        { status: 402 },
      );
    }

    // Check the tx invokes the Ohlarr program with a Settle instruction
    const logs = tx.meta?.logMessages || [];
    const isSettle = logs.some((l) => l.includes('Instruction: Settle'));
    if (!isSettle) {
      return NextResponse.json(
        { error: 'invalid_payment', reason: 'not a settle instruction' },
        { status: 402 },
      );
    }

    // Payment verified — return the data
    const btcPrice = await fetchBtcPrice();
    return NextResponse.json({
      symbol: 'BTC-USD',
      price: btcPrice,
      timestamp: Date.now(),
      paid: {
        amount: PRICE_LAMPORTS,
        txSig,
        explorer: `https://explorer.solana.com/tx/${txSig}?cluster=devnet`,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: 'invalid_payment', reason: err instanceof Error ? err.message : 'unknown' },
      { status: 402 },
    );
  }
}

// Fallback BTC price (no API key needed)
async function fetchBtcPrice(): Promise<number> {
  try {
    const res = await fetch(
      'https://api.coinbase.com/v2/prices/BTC-USD/spot',
      { next: { revalidate: 30 } },
    );
    const data = await res.json();
    return parseFloat(data.data?.amount || '0');
  } catch {
    return 0;
  }
}
