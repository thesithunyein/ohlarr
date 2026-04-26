#!/usr/bin/env bash
# Generate dev keypairs for the buyer & seller demos and fund them via airdrop.
# Run inside Codespaces. NEVER use these wallets on mainnet.
set -euo pipefail

mkdir -p keypairs

if [ ! -f keypairs/buyer.json ]; then
  solana-keygen new --no-bip39-passphrase --outfile keypairs/buyer.json
fi
if [ ! -f keypairs/seller.json ]; then
  solana-keygen new --no-bip39-passphrase --outfile keypairs/seller.json
fi

BUYER=$(solana address -k keypairs/buyer.json)
SELLER=$(solana address -k keypairs/seller.json)

echo "Buyer:  $BUYER"
echo "Seller: $SELLER"

solana airdrop 2 "$BUYER"  --url devnet
solana airdrop 2 "$SELLER" --url devnet
