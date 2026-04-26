<div align="center">

# Ohlarr

### Private payment rails for autonomous agents.

Built on **Solana** + **MagicBlock Private Ephemeral Rollups (PER)** + **x402**.

[![Solana](https://img.shields.io/badge/Solana-Devnet-14F195?logo=solana)](https://solana.com)
[![MagicBlock](https://img.shields.io/badge/MagicBlock-PER%20%7C%20TEE-7c3aed)](https://magicblock.gg)
[![x402](https://img.shields.io/badge/x402-Payment%20Required-000)](https://x402.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)

**Live demo →** [ohlarr.com](https://ohlarr.com) · **Docs →** [`/ARCHITECTURE.md`](./ARCHITECTURE.md)

</div>

---

## The problem

The agentic web is being built right now. AI agents will soon spend more on APIs, data, and compute than humans do. But **every payment they make is fully public on-chain** — amounts, counterparties, frequency, intent.

This is a privacy disaster waiting to happen:

- A trading agent's strategy can be reverse-engineered by watching its API spend.
- An enterprise agent leaks competitive intelligence with every paid call.
- An A2A (agent-to-agent) market with public ledgers is a market without trade secrets.

x402 (Coinbase's revival of HTTP 402) is a beautiful primitive — but on a transparent chain, it's surveillance-as-a-service.

## The solution

**Ohlarr is a private payment middleware for the agentic web.**

It combines three pieces:

| Layer | Tech | Role |
|-------|------|------|
| **Settlement** | Solana L1 | Final state, public addresses only |
| **Privacy** | MagicBlock **Private Ephemeral Rollup** (Intel TDX TEE) | Encrypted state, gated reads via Permission Program |
| **Protocol** | **x402** (HTTP 402 Payment Required) | Standard handshake any HTTP API can adopt |

A buyer agent calls a seller API. The server responds `402` with an Ohlarr payment requirement. The agent funds an Ohlarr vault inside the PER (TEE), settles the call privately, and retries with proof. **Public observers see encrypted state — only the buyer, seller, and TEE see amounts and intent.**

```
┌────────────────┐  1. GET /api/data            ┌──────────────────┐
│  Buyer Agent   │ ───────────────────────────▶ │  Seller API      │
│  @ohlarr/sdk   │ ◀─────────────────────────── │  + ohlarr        │
└────────┬───────┘  2. 402 { vault, amount }    │    middleware    │
         │                                       └────────┬─────────┘
         │ 3. settle() in PER (TEE)                       │
         ▼                                                │
┌─────────────────────────────────────┐                   │
│  MagicBlock Private Ephemeral       │                   │
│  Rollup — Intel TDX                 │                   │
│  ohlarr_payments program:           │                   │
│   • vault PDA (delegated)           │                   │
│   • permission PDA (gated reads)    │                   │
│   • settle(amount, recipient)       │                   │
└─────────────────────────────────────┘                   │
         │ 4. payment proof (signed receipt)              │
         └────────────────────────────────────────────────▶
                                                  5. 200 OK + data
```

## Why this wins (for the judges)

**Technology (40%)** — We use **all three** MagicBlock privacy primitives in concert: ER for low-latency settlement, PER for TEE-gated state confidentiality, and the Permission Program for granular ACL. The x402 handshake is implemented per [Coinbase's spec](https://docs.cdp.coinbase.com/x402/welcome), with Solana Ed25519 auth payloads.

**Impact (30%)** — Every credible agent framework (LangChain, CrewAI, AutoGPT, MCP) needs a payment rail. Ohlarr is dropped into any HTTP API in 4 lines of code. The market is the entire commercial agentic web.

**Creativity & UX (30%)** — Most privacy projects build dark pools or shielded transfers. Ohlarr asks a more interesting question: **what does private commerce look like when the customer is a machine?** And the answer is: it looks like x402, but encrypted.

## Repo layout

```
ohlarr/
├── programs/
│   └── ohlarr_payments/        # Anchor program — vault, permissions, settle()
├── packages/
│   └── sdk/                    # @ohlarr/sdk — middleware + agent client
├── apps/
│   ├── web/                    # Next.js dashboard + landing
│   ├── seller-demo/            # Example x402 API (Express)
│   └── buyer-agent/            # Example autonomous buyer
├── tests/                      # Anchor integration tests
├── .devcontainer/              # Codespaces config (Solana + Anchor preinstalled)
└── ARCHITECTURE.md             # Deep technical doc
```

## Getting started

> **Zero local setup required.** Click *Code → Codespaces → Create* on GitHub. Solana CLI, Anchor, and Node are preinstalled via `.devcontainer/`.

```bash
# inside the codespace
solana airdrop 2
anchor build
anchor deploy --provider.cluster devnet
pnpm install
pnpm dev
```

Open the forwarded port `3000` for the dashboard and `3001` for the seller demo API.

### Try it from the command line

```bash
# This will fail with HTTP 402:
curl http://localhost:3001/api/premium

# This will pay privately and succeed:
pnpm --filter buyer-agent start
```

## Submission checklist

- [x] Working demo — [ohlarr.com](https://ohlarr.com)
- [x] Public GitHub repo
- [x] 3-min demo video — [YouTube](#) *(linked at submission)*
- [x] MagicBlock PER integration — see [`programs/ohlarr_payments/src/lib.rs`](./programs/ohlarr_payments/src/lib.rs)
- [x] Solana devnet program — `OHLARR_PROGRAM_ID` in `.env.example`

## License

MIT — see [`LICENSE`](./LICENSE).

---

<div align="center">
Built for the <b>Privacy Track — Colosseum Hackathon</b> · Powered by MagicBlock, ST MY & SNS
</div>
