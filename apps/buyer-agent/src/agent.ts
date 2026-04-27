/**
 * Buyer agent — autonomously calls the seller demo, paying privately via
 * Ohlarr PER on each 402.
 *
 * Run:  pnpm --filter buyer-agent start
 */
import 'dotenv/config';
import fs from 'node:fs';
import { Keypair, PublicKey } from '@solana/web3.js';
import { AnchorProvider, BN, Idl, Program, Wallet } from '@coral-xyz/anchor';
import { OhlarrClient, PerSession } from '@ohlarr/sdk';

const SELLER_URL = process.env.SELLER_URL ?? 'http://localhost:3001/api/premium';
const PROGRAM_ID = new PublicKey(
  process.env.OHLARR_PROGRAM_ID ?? 'CmHUW6WAUcobsYCHpK2cSgjcYU5KqbW8MDXunK5SzdLA',
);

function loadKeypair(path: string): Keypair {
  const raw = JSON.parse(fs.readFileSync(path, 'utf8')) as number[];
  return Keypair.fromSecretKey(Uint8Array.from(raw));
}

async function main() {
  const buyer = loadKeypair(
    process.env.BUYER_WALLET_KEYPAIR_PATH ?? './keypairs/buyer.json',
  );

  const per = new PerSession({
    baseRpcUrl: process.env.SOLANA_RPC_URL ?? 'https://api.devnet.solana.com',
    rollupRpcUrl:
      process.env.MAGICBLOCK_PER_RPC_URL ?? 'https://devnet-tee.magicblock.app',
  });

  // Lazy-load IDL produced by `anchor build`. The file is generated and not
  // checked in — the agent assumes the program has been built first.
  const idl = JSON.parse(
    fs.readFileSync('./target/idl/ohlarr_payments.json', 'utf8'),
  ) as Idl;
  const provider = new AnchorProvider(per.rollup, new Wallet(buyer), {
    commitment: 'confirmed',
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const program = new Program(idl, provider) as unknown as any;

  const ohlarr = new OhlarrClient({
    programId: PROGRAM_ID,
    buyer,
    network: 'solana-devnet',
    per,
    buildSettleIx: async (args) =>
      program.methods
        .settle(
          new BN(args.amount.toString()),
          new BN(args.nonce.toString()),
          Array.from(args.requestHash),
        )
        .accountsStrict({
          channel: args.channel,
          buyerVault: args.buyerVault,
          sellerVault: args.sellerVault,
          buyer: args.buyer,
        })
        .instruction(),
  });

  console.log(`[ohlarr buyer-agent] buyer: ${buyer.publicKey.toBase58()}`);
  console.log(`[ohlarr buyer-agent] target: ${SELLER_URL}`);

  for (let i = 0; i < 5; i++) {
    const r = await ohlarr.fetch(SELLER_URL);
    const body = await r.json();
    console.log(`[#${i + 1}] status=${r.status}`, body);
    await new Promise((res) => setTimeout(res, 1500));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
