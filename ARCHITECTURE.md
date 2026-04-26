# Ohlarr — Architecture

This document explains the on-chain and off-chain components, the payment lifecycle, the threat model, and the design choices.

## 1. Components

### 1.1 `ohlarr_payments` (Anchor program)

Lives at `programs/ohlarr_payments/`. Owns three account types:

| PDA | Seeds | Purpose |
|-----|-------|---------|
| `Vault` | `[b"vault", owner]` | Per-user balance held inside PER |
| `PaymentChannel` | `[b"channel", buyer, seller]` | Bilateral channel state (nonce, last settled tx) |
| `Permission` (MagicBlock) | `[b"permission", account]` | ACL for who can read/write delegated state |

Instructions:

- `initialize_vault(owner)` — creates vault on L1
- `delegate_vault_private(validator, members)` — moves vault into PER (TEE) and creates a Permission PDA gating reads to a member set (buyer + seller + Ohlarr ops key)
- `deposit(amount)` — funds vault from L1 (when undelegated)
- `open_channel(seller)` — initializes channel inside PER
- `settle(amount, nonce, x402_payload_hash)` — atomic transfer buyer→seller inside PER, increments nonce, records receipt hash
- `close_and_commit_channel()` — commits channel & vault state back to L1, undelegates

The `#[ephemeral]`, `#[delegate]`, and `#[commit]` macros from `ephemeral_rollups_sdk` (MagicBlock) wire the cross-layer state machine.

### 1.2 `@ohlarr/sdk` (TypeScript)

Lives at `packages/sdk/`. Three entry points:

- **`ohlarrMiddleware(opts)`** — Express/Connect-style middleware. Accepts a price, vault, and policy; returns 402 when payment headers are absent, validates and extracts `(amount, channel, nonce, sig)` when present.
- **`OhlarrClient`** — Agent-side fetch wrapper. On a 402, it parses `WWW-Authenticate: x402`, builds a settle tx in PER, signs, and retries with `Authorization: x402 <payload>`.
- **`PerSession`** — Low-level PER connection manager. Holds a `Connection` to `devnet-tee.magicblock.app`, multiplexes program calls, and surfaces commit/undelegate.

### 1.3 Apps

- `apps/seller-demo` — Express server with one paid route, demonstrating drop-in middleware integration.
- `apps/buyer-agent` — Node script that loops, calling the seller, paying via Ohlarr, and printing private vs public views.
- `apps/web` — Next.js dashboard. Shows live agent traffic with two columns: **Public Solana view** (only commits visible — opaque) vs **Authorized Ohlarr view** (decrypted with permission key — full detail).

## 2. Payment lifecycle

```
sequenceDiagram
    participant B as Buyer Agent
    participant S as Seller API
    participant P as PER (TEE)
    participant L as Solana L1

    B->>S: GET /api/premium
    S-->>B: 402 { vault: V_S, amount: 1000, channel: C, nonce: 7 }
    B->>P: settle(C, 1000, 7, hash(req))
    P-->>B: tx_sig (private)
    B->>S: GET /api/premium\nAuthorization: x402 <payload>
    S->>P: read channel C state (with permission)
    P-->>S: nonce=7, last_settled=1000  ✓
    S-->>B: 200 OK { data }

    Note over P,L: Periodically — or on close_channel() —\nstate commits to L1. Only net balances visible.
```

### Why PER (not just ER)?

A vanilla Ephemeral Rollup gives speed and zero fees — but its state is **public**. PER adds Intel TDX (Trusted Execution Environment) enforcement: state is encrypted at rest in the validator and only readable through the Permission Program's ACL. For agentic commerce this matters because:

- Trading agents leak strategy via API spend patterns.
- Enterprise A2A trades are competitively sensitive.
- Compliance: regulators want auditability without public exposure — PER's TEE provides exactly this (auditor added as a permission member).

## 3. x402 wire format

We follow [x402.org](https://x402.org) for the HTTP semantics, with a Solana-flavored payload.

**Server response (no payment):**

```http
HTTP/1.1 402 Payment Required
WWW-Authenticate: x402
Content-Type: application/json

{
  "scheme": "ohlarr-per-v1",
  "network": "solana-devnet",
  "asset": "lamports",
  "amount": "1000",
  "recipient_vault": "9Wz...",
  "channel": "Cf8...",
  "nonce": 7,
  "expires_at": 1745690000,
  "request_hash": "blake3:..."
}
```

**Client retry:**

```http
GET /api/premium HTTP/1.1
Authorization: x402 eyJzaWciOiI...    # base64(JSON{ tx_sig, channel, nonce, sig })
```

The middleware verifies the signature, queries the channel PDA inside PER (it has read permission as a channel member), and serves the response.

## 4. Threat model

| Threat | Mitigation |
|--------|------------|
| Public observer learns who paid whom | PER state is encrypted; only Permission members read it |
| Replay of a paid request | `nonce` per channel, monotonic; server rejects stale |
| Buyer pays then server doesn't deliver | x402 receipt is a signed promise; off-chain dispute via auditor permission |
| TEE compromise | TDX attestation verified by validator; degrades to ER (still atomic, loses confidentiality) |
| Rogue validator | Solana base layer remains canonical — commits checked at L1 |

## 5. Why this is hard to copy in 15 days

- The `#[ephemeral]` + `#[delegate]` + `Permission Program` triple-handshake is non-trivial; most teams will use ER alone.
- Implementing x402 *correctly* (replay protection, expiry, async settlement) is a real protocol, not a toy.
- The dual-view dashboard (public-opaque vs auth-decrypted) is the killer demo — it makes "privacy" tangible to non-technical judges.

## 6. Roadmap

- [ ] Mainnet program deploy
- [ ] MCP server integration (`@modelcontextprotocol/sdk`) for plug-and-play LLM agents
- [ ] Streaming payments (sub-cent micropayments per token, not per request)
- [ ] Compliance dashboard (auditor-as-permission-member)
- [ ] SPL token support beyond lamports
