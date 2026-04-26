# Contributing to Ohlarr

Thanks for your interest! Ohlarr is built openly and we welcome PRs.

## Dev setup

The fastest path is **GitHub Codespaces** — `.devcontainer/` provisions Solana CLI, Anchor 0.31, Node 20, and pnpm automatically.

```bash
# 1. Open in Codespaces (or run .devcontainer/post-create.sh locally)
# 2. Generate dev wallets and airdrop
bash scripts/setup-keypairs.sh
# 3. Build & deploy the Anchor program to devnet
bash scripts/deploy-and-init.sh
# 4. Run everything
pnpm dev
```

## Project structure

See [`README.md`](./README.md#repo-layout) and [`ARCHITECTURE.md`](./ARCHITECTURE.md).

## Code style

- TypeScript strict mode everywhere; no `any`.
- Rust: `cargo fmt` + `cargo clippy -- -D warnings`.
- Run `pnpm lint` and `anchor test` before opening a PR.

## Reporting security issues

Please email security@ohlarr.com — do not open public issues for vulnerabilities.
