#!/usr/bin/env bash
# One-shot: build the Anchor program, deploy to devnet, and initialize vaults.
# Run inside Codespaces after `setup-keypairs.sh`.
set -euo pipefail

echo "==> Building Anchor program"
anchor build

PROGRAM_ID=$(solana-keygen pubkey target/deploy/ohlarr_payments-keypair.json)
echo "Program ID: $PROGRAM_ID"

echo "==> Patching declare_id! and Anchor.toml"
sed -i "s/OhLaRR1111111111111111111111111111111111111/$PROGRAM_ID/g" \
  programs/ohlarr_payments/src/lib.rs Anchor.toml

echo "==> Rebuilding with real program id"
anchor build

echo "==> Deploying to devnet"
anchor deploy --provider.cluster devnet

echo "OHLARR_PROGRAM_ID=$PROGRAM_ID" >> .env
echo "✅ Deployed. Add to .env: OHLARR_PROGRAM_ID=$PROGRAM_ID"
