/**
 * Buyer agent — autonomously calls the seller demo, paying privately via
 * Ohlarr PER on each 402.
 *
 * Run:  pnpm --filter buyer-agent start
 */
import 'dotenv/config';
import fs from 'node:fs';
import { Keypair, PublicKey, TransactionInstruction } from '@solana/web3.js';
import { AnchorProvider, BN, Program, Wallet } from '@coral-xyz/anchor';
import { OhlarrClient, PerSession } from '@ohlarr/sdk';

const SELLER_URL = process.env.SELLER_URL ?? 'http://localhost:3001/api/premium';
const PROGRAM_ID = new PublicKey(
  process.env.OHLARR_PROGRAM_ID ?? 'OhLaRR1111111111111111111111111111111111111',
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
  // checked in — the agent assumes it's been built locally first.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const idl = JSON.parse(
    fs.readFileSync('./target/idl/ohlarr_payments.json', 'utf8'),
  );
  const provider = new AnchorProvider(per.rollup, new Wallet(buyer), {
    commitment: 'confirmed',
  });
  const program = new Program(idl, provider);

  const ohlarr = new OhlarrClient({
    programId: PROGRAM_ID,
    buyer,
    network: 'solana-devnet',
    per,
    buildSettleIx: ({ buyer, channel, buyerVault, sellerVault, amount, nonce, requestHash }) =>
      program.methods
        .settle(new BN(amount.toString()), new BN(nonce.toString()), Array.from(requestHash))
        .accountsStrict({
          channel,
          buyerVault,
          sellerVault,
          buyer,
        })
        .instruction() as unknown as TransactionInstruction,
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
