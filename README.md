<div align="center">

# 🐇 Ohlarr

### Private payment rails for autonomous agents.

[![Live Demo](https://img.shields.io/badge/Live_Demo-ohlarr.com-7c3aed?style=for-the-badge)](https://ohlarr.com)
[![Solana Devnet](https://img.shields.io/badge/Solana-Devnet-10b981?style=for-the-badge&logo=solana)](https://explorer.solana.com/address/CmHUW6WAUcobsYCHpK2cSgjcYU5KqbW8MDXunK5SzdLA?cluster=devnet)
[![Anchor](https://img.shields.io/badge/Anchor-0.31.1-9333ea?style=for-the-badge)](https://www.anchor-lang.com/)
[![License](https://img.shields.io/badge/License-MIT-zinc?style=for-the-badge)](LICENSE)

**An x402-compatible HTTP payment protocol that lets autonomous AI agents pay for APIs with private, sub-second settlements on Solana.**

Built on **MagicBlock Private Ephemeral Rollups** (Intel TDX TEE) — amounts and intent stay encrypted, settlements stay verifiable.

[**🚀 Live Dashboard →**](https://ohlarr.com/dashboard) · [**📺 Demo Video**](https://youtu.be/GZLxXcv3s9c) · [**🔗 Solana Explorer**](https://explorer.solana.com/address/CmHUW6WAUcobsYCHpK2cSgjcYU5KqbW8MDXunK5SzdLA?cluster=devnet)

</div>

---

## 🎯 The Problem

Autonomous AI agents now spend real money on APIs — oracles, LLMs, data feeds. Every payment they make on a public chain **leaks**:

- 🕵️ **Counterparties** (which seller, which buyer)
- 💸 **Amounts** (exact pricing & spend velocity)
- 🎯 **Intent** (which API endpoint, what data)

Competitors, MEV bots, and indexers can reverse-engineer your agent's strategy from the chain. Privacy is the unsolved primitive blocking real agentic commerce.

## 💡 The Solution

Ohlarr is **x402 + Private Ephemeral Rollups** stitched together as a drop-in middleware:

```ts
// Seller side — 1 line.
app.use(ohlarr({ programId, sellerPubkey, per, price: 1000n }));

// Buyer agent — 1 line.
const data = await client.fetch('https://api.example.com/v1/oracle/BTC-USD');
```

The seller's HTTP API returns **HTTP 402 Payment Required** with an Ohlarr challenge. The buyer agent signs a settlement transaction inside MagicBlock's PER (running on Intel TDX), retries with `X-PAYMENT`, and gets the data — all in **one round-trip, sub-second**.

The base Solana chain sees only opaque commits. Permission-key holders see everything.

---

## 🎬 The Killer Demo

Visit [**ohlarr.com/dashboard**](https://ohlarr.com/dashboard):

| 👁️‍🗨️ Public Solana Observer | 🔓 Authorized Ohlarr View |
|---|---|
| Real tx signatures, instruction names, PER commit hashes | Same events, but decrypted: buyer → seller, API path, lamports |
| `from: ████████` `amount: ██████ lamports` | `from: AWXy...yRct → 867u...BdzW` `4,449 lamports` |

**Two buttons that prove it's real:**

- 🤖 **Watch AI Agent Buy** — runs a full x402 flow on devnet (HTTP 402 → sign → settle → 200 with BTC price). Modal shows the live HTTP transcript with explorer links.
- ⚡ **Run Real Tx** — executes a fresh deposit + settle on Solana devnet, shows up in the LIVE stream.

Every transaction is verifiable on [Solana Explorer](https://explorer.solana.com/address/CmHUW6WAUcobsYCHpK2cSgjcYU5KqbW8MDXunK5SzdLA?cluster=devnet).

---

## 🏗️ Architecture

```
                       ┌─────────────────────────────┐
                       │   AI Agent (LangChain/MCP)  │
                       └──────────────┬──────────────┘
                                      │ HTTP request
                                      ▼
            ┌─────────────────────────────────────────────┐
            │   Seller API (any HTTP server) + ohlarr SDK │
            └────────────┬────────────────────────────────┘
                         │ 402 Payment Required
                         │  + X402Challenge
                         ▼
            ┌─────────────────────────────────────────────┐
            │ Buyer signs Settle ix on Solana devnet PER  │
            │ ▸ MagicBlock Private Ephemeral Rollup       │
            │ ▸ Intel TDX TEE @ devnet-tee.magicblock.app │
            │ ▸ Permission Program: ACLseo...XQnp1        │
            └────────────┬────────────────────────────────┘
                         │ X-PAYMENT: <receipt>
                         ▼
            ┌─────────────────────────────────────────────┐
            │  Seller verifies → returns paid resource    │
            └─────────────────────────────────────────────┘

   On-chain: opaque PER commit hash         (everyone)
   Off-chain (TEE): full plaintext state    (Permission members only)
```

---

## 🛠️ Tech Stack

| Layer | Tech |
|-------|------|
| **Smart contract** | Anchor 0.31.1 (`programs/ohlarr_payments`) — escrow vaults, payment channels, nonce-monotonic settlement |
| **Privacy runtime** | MagicBlock Private Ephemeral Rollup on Intel TDX TEE |
| **Permissions** | MagicBlock Permission Program (`ACLseoPoyC3cBqoUtkbjZ4aDrkurZW86v19pXz2XQnp1`) |
| **Wire protocol** | [Coinbase x402](https://x402.org) — HTTP 402 Payment Required |
| **SDK** | TypeScript (`@ohlarr/sdk`) — `OhlarrClient`, `ohlarrMiddleware`, `PerSession` |
| **Hash** | BLAKE3 canonical request hashing |
| **Frontend** | Next.js 14, Tailwind, framer-motion |
| **Deploy** | GitHub Actions → Solana devnet, Vercel for web |

---

## 📦 Repo Layout

```
ohlarr/
├── programs/ohlarr_payments/    # Anchor program (Rust)
├── packages/sdk/                # @ohlarr/sdk TypeScript SDK
├── apps/web/                    # Next.js 14 dashboard (ohlarr.com)
│   ├── app/
│   │   ├── page.tsx             # Landing + live stats banner
│   │   ├── dashboard/page.tsx   # Dual-view privacy demo
│   │   └── api/
│   │       ├── x402/oracle/btc-usd/  # Live x402 endpoint
│   │       ├── agent-buy/            # AI agent demo flow
│   │       ├── demo/                 # Real devnet tx trigger
│   │       └── stats/                # Live program stats
│   ├── hooks/use-program-events.ts   # Real on-chain event hook
│   └── lib/solana.ts                 # Devnet connection, PDAs, parsers
├── apps/seller-demo/            # Express seller using middleware
├── apps/buyer-agent/            # Node agent using OhlarrClient
└── .github/workflows/           # Auto-deploy to devnet
```

---

## 🚀 Try It Now

### 1. Use the live demo

Just visit [**ohlarr.com**](https://ohlarr.com). The program is already deployed:

- **Program ID:** `CmHUW6WAUcobsYCHpK2cSgjcYU5KqbW8MDXunK5SzdLA`
- **Network:** Solana devnet
- **PER endpoint:** `devnet-tee.magicblock.app`

Click **"Watch AI Agent Buy"** to see a real agent perform an end-to-end x402 purchase on devnet. The modal shows the full HTTP/chain transcript with verifiable links.

### 2. Hit the x402 endpoint yourself

```bash
# Without payment → 402
curl -i https://ohlarr.com/api/x402/oracle/btc-usd

# Response:
# HTTP/2 402
# WWW-Authenticate: OhlarrX402
# {
#   "scheme": "ohlarr-x402-v1",
#   "network": "solana-devnet",
#   "amount": { "lamports": 1000 },
#   "payTo": "CmHUW6WAUcobsYCHpK2cSgjcYU5KqbW8MDXunK5SzdLA",
#   ...
# }
```

### 3. Run locally

```bash
git clone https://github.com/thesithunyein/ohlarr
cd ohlarr
pnpm install
pnpm --filter @ohlarr/web dev
# → http://localhost:3000
```

### 4. Build & deploy your own program

The repo ships with a GitHub Action that deploys to devnet on push:

```bash
# Set the DEPLOYER_KEYPAIR secret in your repo, then:
gh workflow run deploy-devnet.yml
```

---

## 🎬 Demo Video

> **3-min demo:** Problem → Solution → Live demo → Tech stack

[![Watch the demo](https://img.youtube.com/vi/GZLxXcv3s9c/maxresdefault.jpg)](https://youtu.be/GZLxXcv3s9c)

📺 **[Watch on YouTube →](https://youtu.be/GZLxXcv3s9c)**

---

## 🏆 Built for the Privacy Track

Built for the **Superteam Earn / Colosseum Hackathon Privacy Track** sponsored by **MagicBlock**, **Superteam MY**, and **SNS**.

This project addresses the bounty's core thesis directly:

| Bounty Criterion | Ohlarr |
|------------------|--------|
| **Effective use of PER / Private Payments API** | Settlements run inside the PER on Intel TDX TEE; uses `ephemeral_rollups_sdk` macros (`#[ephemeral]`, `#[delegate]`, `#[commit]`) |
| **Working demo** | Live at [ohlarr.com](https://ohlarr.com) — real devnet program + real settlements + real x402 endpoint |
| **Quality of architecture** | Clean separation: program / SDK / middleware / agent — drop-in for any Express/Next.js app |
| **Real-world problem** | Agents leak strategy via on-chain payment metadata. We fix that. |
| **Novel UX** | Side-by-side dual-view dashboard makes privacy *visceral* |
| **Standards-compliant** | x402 spec verbatim — works with LangChain, CrewAI, MCP out of the box |

---

## 🔐 Security Notes

- The base Solana chain only ever sees opaque PER state commitments — no plaintext amounts, identities, or API paths.
- Settlements are nonce-monotonic and balance-checked inside the program; replay-resistant.
- Request hashes use canonical JSON + BLAKE3 to prevent malleability.
- The TEE attestation chain is rooted in Intel SGX/TDX — see [MagicBlock docs](https://docs.magicblock.gg) for the trust model.
- Demo keypairs in `.env.local.example` are devnet-only and rotated regularly.

---

## 📄 License

MIT — see [LICENSE](LICENSE).

---

<div align="center">

**Built with 🐇 by [@thesithunyein](https://github.com/thesithunyein)** · Owns [ohlarr.com](https://ohlarr.com)

</div>
