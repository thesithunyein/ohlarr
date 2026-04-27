import { NextResponse } from 'next/server';
import { Connection, PublicKey } from '@solana/web3.js';

const PROGRAM_ID = new PublicKey(
  process.env.NEXT_PUBLIC_PROGRAM_ID || 'CmHUW6WAUcobsYCHpK2cSgjcYU5KqbW8MDXunK5SzdLA',
);
const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || 'https://api.devnet.solana.com';

// In-memory cache (10s TTL) to avoid hammering devnet RPC
let cache: { data: unknown; expires: number } | null = null;

export async function GET() {
  if (cache && cache.expires > Date.now()) {
    return NextResponse.json(cache.data);
  }

  try {
    const conn = new Connection(RPC_URL, 'confirmed');
    const programInfo = await conn.getAccountInfo(PROGRAM_ID);
    if (!programInfo) {
      return NextResponse.json({ deployed: false });
    }

    const sigs = await conn.getSignaturesForAddress(PROGRAM_ID, { limit: 100 });
    const successful = sigs.filter((s) => !s.err).length;

    const data = {
      deployed: true,
      programId: PROGRAM_ID.toBase58(),
      totalTxns: sigs.length,
      successful,
      latestTxSig: sigs[0]?.signature || null,
      latestTimestamp: sigs[0]?.blockTime ? sigs[0].blockTime * 1000 : null,
      network: 'solana-devnet',
      perEndpoint: 'devnet-tee.magicblock.app',
    };

    cache = { data, expires: Date.now() + 10_000 };
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'unknown' },
      { status: 500 },
    );
  }
}
