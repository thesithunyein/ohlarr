# 3-minute demo video script

> Total budget: **180 seconds**. Hit each beat hard. No filler. Use a Solana devnet wallet so the chain shots look real.

## 0:00–0:20 — The hook

> **On screen:** Ohlarr landing page. Cursor highlights the headline.

**Narration:**
> "AI agents are about to spend trillions on APIs. And every single payment they make is fully public on-chain. That's a privacy disaster."
> "I built **Ohlarr** — private payment rails for autonomous agents."

## 0:20–0:50 — The 4-line drop-in

> **On screen:** `apps/seller-demo/src/server.ts`. Highlight the `ohlarrMiddleware()` line.

**Narration:**
> "Any HTTP API becomes paid in 4 lines. Standard x402. The middleware returns 402 with an Ohlarr challenge. The buyer agent settles inside a Private Ephemeral Rollup, retries with a receipt — done."

## 0:50–1:30 — The agent in action

> **On screen:** Split terminal — left runs `seller-demo`, right runs `buyer-agent`. Show the 5 successful paid calls scrolling.

**Narration:**
> "Here's a live agent calling a paid oracle. First request returns 402. The agent automatically pays inside MagicBlock's PER, retries, gets data. All in one round-trip from the user's perspective. Sub-second latency."

## 1:30–2:30 — The killer moment: dual-view dashboard

> **On screen:** `/dashboard` — two columns. Click the **Unlock** button.

**Narration:**
> "This is what makes Ohlarr different. On the left, what any public observer sees: encrypted state, opaque commits. On the right, what an authorized Permission member sees: the same events, fully decrypted. Same chain. Two views. **That's MagicBlock's TEE-backed PER giving us privacy *and* verifiability at the same time.**"

> Click Lock again. Right column re-blurs. Pause for effect.

## 2:30–3:00 — The pitch close

> **On screen:** Architecture diagram from README.

**Narration:**
> "Ohlarr uses three MagicBlock primitives in concert: ER for speed, PER for confidentiality, and the Permission Program for auditable access control. We layer x402 on top so any LangChain, CrewAI, or MCP agent works out of the box."
> "It's the payment rail the agentic web actually needs."
> **"Ohlarr — privacy as a primitive."**

> **On screen:** Final card with `ohlarr.com` · GitHub URL · "Built for the Privacy Track."
