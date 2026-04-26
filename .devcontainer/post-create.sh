#!/usr/bin/env bash
set -euo pipefail

echo "==> Installing pnpm"
npm install -g pnpm@9

echo "==> Installing Solana CLI (stable)"
sh -c "$(curl -sSfL https://release.anza.xyz/stable/install)"
export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"
echo 'export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"' >> ~/.bashrc

echo "==> Installing Anchor via avm"
cargo install --git https://github.com/coral-xyz/anchor avm --force
avm install 0.31.1
avm use 0.31.1

echo "==> Configuring Solana for devnet"
solana config set --url https://api.devnet.solana.com
solana-keygen new --no-bip39-passphrase --force --outfile ~/.config/solana/id.json || true

echo "==> Installing JS deps"
pnpm install --frozen-lockfile=false

echo ""
echo "✅ Dev container ready."
echo "   solana address: $(solana address || true)"
echo "   anchor:         $(anchor --version || true)"
echo "   node:           $(node --version)"
echo "   pnpm:           $(pnpm --version)"
echo ""
echo "Next steps:"
echo "  1. solana airdrop 2"
echo "  2. anchor build && anchor deploy --provider.cluster devnet"
echo "  3. pnpm dev"
