/**
 * Seller demo — a tiny premium API protected by the Ohlarr x402 middleware.
 *
 *   GET /api/premium    → 402 unless the caller paid via Ohlarr PER
 *   GET /health         → public liveness check
 *
 * Run:  pnpm --filter seller-demo dev
 */
import 'dotenv/config';
import express from 'express';
import { Keypair, PublicKey } from '@solana/web3.js';
import fs from 'node:fs';
import { ohlarrMiddleware, PerSession } from '@ohlarr/sdk';

const PORT = Number(process.env.X402_SELLER_PORT ?? 3001);
const PRICE = BigInt(process.env.X402_PRICE_PER_CALL_LAMPORTS ?? 1000);
const PROGRAM_ID = new PublicKey(
  process.env.OHLARR_PROGRAM_ID ?? 'OhLaRR1111111111111111111111111111111111111',
);

function loadKeypair(path: string): Keypair {
  const raw = JSON.parse(fs.readFileSync(path, 'utf8')) as number[];
  return Keypair.fromSecretKey(Uint8Array.from(raw));
}

const seller = loadKeypair(
  process.env.SELLER_WALLET_KEYPAIR_PATH ?? './keypairs/seller.json',
);

const per = new PerSession({
  baseRpcUrl: process.env.SOLANA_RPC_URL ?? 'https://api.devnet.solana.com',
  rollupRpcUrl:
    process.env.MAGICBLOCK_PER_RPC_URL ?? 'https://devnet-tee.magicblock.app',
});

const app = express();
app.disable('x-powered-by');

app.get('/health', (_req, res) => {
  res.json({ ok: true, seller: seller.publicKey.toBase58() });
});

app.get(
  '/api/premium',
  ohlarrMiddleware({
    programId: PROGRAM_ID,
    sellerPubkey: seller.publicKey,
    network: 'solana-devnet',
    per,
    price: PRICE,
  }),
  (req, res) => {
    res.json({
      data: {
        oracle: 'BTC/USD',
        price: 99_421.18,
        confidence: 0.97,
        ts: Date.now(),
      },
      paid: {
        nonce: (req as express.Request & { ohlarr?: { receipt: { nonce: number } } }).ohlarr
          ?.receipt.nonce,
      },
    });
  },
);

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(
    `[ohlarr seller-demo] listening on :${PORT}\n  seller: ${seller.publicKey.toBase58()}\n  price : ${PRICE} lamports / call`,
  );
});
