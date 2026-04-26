# Deploying & verifying Ohlarr — zero local install

This project deploys end-to-end **without you needing Solana CLI, Rust, or Node installed on your machine**. Everything runs on free GitHub Actions + Vercel.

## 1. Deploy the Anchor program to Solana devnet

1. Open https://github.com/thesithunyein/ohlarr/actions/workflows/deploy-devnet.yml
2. Click **Run workflow** → **Run workflow**
3. The job will:
   - Install Solana + Anchor in the runner
   - Use a deployer wallet (from secret `DEPLOYER_KEYPAIR`, or generate an ephemeral one and print it in the logs)
   - Build the program
   - Deploy it to devnet
   - Auto-commit the new program id back into `Anchor.toml`, `lib.rs`, `.env.example`, and the SDK
4. **First run will fail** at the deploy step because the new wallet has 0 SOL. That's expected:
   - Open the failed run, find the line `🔑 Deployer pubkey: <ADDRESS>` in the summary
   - Visit https://faucet.solana.com, paste the address, request 5 SOL
   - **Re-run** the workflow — it'll succeed

### Make deploys reproducible (recommended)

After the first successful run, save the deployer keypair as a GitHub Secret so subsequent runs reuse the same address (and don't re-fund every time):

1. The first run prints the keypair JSON in the log under "Restore deployer keypair (or create one)"
2. Copy that JSON array (the 64 numbers between `[` and `]`)
3. Repo → **Settings → Secrets and variables → Actions → New repository secret**
   - Name: `DEPLOYER_KEYPAIR`
   - Value: the JSON array
4. Optionally also save `PROGRAM_KEYPAIR` (from `target/deploy/ohlarr_payments-keypair.json` — accessible via run artifacts) so the program id is stable across redeploys.

## 2. Run a live on-chain demo

Once the program is deployed:

1. Open https://github.com/thesithunyein/ohlarr/actions/workflows/demo.yml
2. **Run workflow**
3. The job spins up `seller-demo` + `buyer-agent` in the runner; the agent makes 5 paid HTTP calls, settling each one against the deployed devnet program.
4. Download `demo-logs` artifact for proof.

## 3. Deploy the dashboard to Vercel (free)

1. Go to https://vercel.com/new
2. Import `thesithunyein/ohlarr`
3. **Root directory:** `apps/web`
4. **Framework preset:** Next.js (auto-detected)
5. **Environment variables** (copy from `.env.example`):
   ```
   NEXT_PUBLIC_OHLARR_PROGRAM_ID=<from deploy-devnet workflow output>
   NEXT_PUBLIC_SOLANA_RPC_URL=https://api.devnet.solana.com
   NEXT_PUBLIC_MAGICBLOCK_PER_RPC_URL=https://devnet-tee.magicblock.app
   ```
6. Deploy. Vercel auto-redeploys on every push to `main`.
7. Add custom domain `ohlarr.com` in Vercel → Settings → Domains.

## Architecture proof for judges

Every commit that lands on `main` triggers:
- ✅ `CI` workflow — proves the code compiles cleanly (TS lint + `anchor build`)
- ✅ Vercel deploy — proves the dashboard ships
- 🟡 (manual) `Deploy to Solana devnet` — produces a real on-chain program id, recorded in git history
- 🟡 (manual) `Live demo` — produces real on-chain settlement transactions

Anyone can fork this repo, plug in a deployer keypair, click two buttons, and reproduce the whole pipeline in ~10 minutes. **No proprietary infra, no paid services.**
