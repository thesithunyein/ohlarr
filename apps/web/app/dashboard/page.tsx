'use client';

import { useEffect, useMemo, useState } from 'react';
import { Eye, EyeOff, Lock, Unlock, Activity } from 'lucide-react';

/**
 * The killer-demo page: dual-view comparison of what a public Solana observer
 * sees vs what an authorized Ohlarr Permission member sees, fed by a live
 * stream of agent payments.
 *
 * In a real deployment, the events come from the Ohlarr program subscription
 * on the PER endpoint. For the demo we synthesize plausible traffic so judges
 * always see motion when they open the link.
 */
type Event = {
  id: string;
  ts: number;
  channel: string;
  buyer: string;
  seller: string;
  amount: number;
  api: string;
  txSig: string;
};

const APIS = [
  '/v1/oracle/BTC-USD',
  '/v1/llm/claude/completions',
  '/v1/data/onchain/whales',
  '/v1/inference/embeddings',
  '/v1/llm/gpt-4o/completions',
];
const AGENTS = [
  { name: 'arb-bot-7f3', kind: 'buyer' },
  { name: 'pnl-hunter', kind: 'buyer' },
  { name: 'oracle-co', kind: 'seller' },
  { name: 'data-co', kind: 'seller' },
  { name: 'mcp-router', kind: 'buyer' },
];

function rand<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)] as T;
}
function shortB58(): string {
  const c = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ123456789';
  let s = '';
  for (let i = 0; i < 8; i++) s += c[Math.floor(Math.random() * c.length)];
  return s + '…';
}

export default function Dashboard() {
  const [authorized, setAuthorized] = useState(false);
  const [events, setEvents] = useState<Event[]>([]);

  useEffect(() => {
    const t = setInterval(() => {
      const buyer = AGENTS.filter((a) => a.kind === 'buyer');
      const seller = AGENTS.filter((a) => a.kind === 'seller');
      const ev: Event = {
        id: crypto.randomUUID(),
        ts: Date.now(),
        channel: shortB58(),
        buyer: rand(buyer).name,
        seller: rand(seller).name,
        amount: 100 + Math.floor(Math.random() * 9000),
        api: rand(APIS),
        txSig: shortB58() + shortB58(),
      };
      setEvents((p) => [ev, ...p].slice(0, 20));
    }, 1100);
    return () => clearInterval(t);
  }, []);

  return (
    <main className="mx-auto max-w-7xl px-6 py-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold flex items-center gap-3">
            <Activity className="w-6 h-6 text-accent2" />
            Live agent payment stream
          </h1>
          <p className="text-zinc-400 mt-1">
            Same on-chain events. Two views. One stays encrypted to the world; the other is decrypted by your Permission key.
          </p>
        </div>
        <button
          onClick={() => setAuthorized((v) => !v)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-accent hover:bg-accent/90 text-white text-sm"
        >
          {authorized ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
          {authorized ? 'Lock view' : 'Unlock with Permission key'}
        </button>
      </div>

      <div className="grid lg:grid-cols-2 gap-6 mt-8">
        <Pane
          title="Public Solana observer"
          subtitle="Anyone watching the chain. No Permission membership."
          icon={<EyeOff className="w-4 h-4" />}
          tone="muted"
        >
          {events.map((e) => (
            <Row
              key={e.id}
              ts={e.ts}
              left={<span className="text-zinc-500">PER commit</span>}
              middle={<span className="encrypted text-zinc-500">{e.channel}</span>}
              right={<span className="encrypted text-zinc-500">██████ ████</span>}
            />
          ))}
        </Pane>

        <Pane
          title="Authorized Ohlarr view"
          subtitle={authorized ? 'Permission key validated. Decrypting state…' : 'Locked. Click Unlock to reveal.'}
          icon={<Eye className="w-4 h-4" />}
          tone="hot"
        >
          {events.map((e) => (
            <Row
              key={e.id}
              ts={e.ts}
              left={
                authorized ? (
                  <span>
                    <span className="text-accent2">{e.buyer}</span>{' '}
                    <span className="text-zinc-500">→</span>{' '}
                    <span className="text-accent">{e.seller}</span>
                  </span>
                ) : (
                  <span className="encrypted text-zinc-600">██████████</span>
                )
              }
              middle={
                authorized ? (
                  <span className="text-zinc-300">{e.api}</span>
                ) : (
                  <span className="encrypted text-zinc-600">██████ ████ ███</span>
                )
              }
              right={
                authorized ? (
                  <span className="text-amber-300">{e.amount.toLocaleString()} lamports</span>
                ) : (
                  <span className="encrypted text-zinc-600">█████</span>
                )
              }
            />
          ))}
        </Pane>
      </div>

      <Stats events={events} authorized={authorized} />
    </main>
  );
}

function Pane({
  title,
  subtitle,
  icon,
  tone,
  children,
}: {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  tone: 'muted' | 'hot';
  children: React.ReactNode;
}) {
  return (
    <section
      className={`rounded-2xl border bg-haze ${
        tone === 'hot' ? 'border-accent/40 glow' : 'border-zinc-800'
      }`}
    >
      <header className="px-5 py-4 border-b border-zinc-800 flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg bg-zinc-900 grid place-items-center">{icon}</div>
        <div>
          <div className="text-sm font-medium">{title}</div>
          <div className="text-xs text-zinc-500">{subtitle}</div>
        </div>
      </header>
      <div className="divide-y divide-zinc-900 max-h-[480px] overflow-auto">{children}</div>
    </section>
  );
}

function Row({
  ts,
  left,
  middle,
  right,
}: {
  ts: number;
  left: React.ReactNode;
  middle: React.ReactNode;
  right: React.ReactNode;
}) {
  return (
    <div className="px-5 py-3 grid grid-cols-[8ch_1fr_2fr_auto] gap-4 items-center text-sm font-mono">
      <span className="text-zinc-600 text-xs">{new Date(ts).toLocaleTimeString().slice(0, 8)}</span>
      <span>{left}</span>
      <span className="truncate">{middle}</span>
      <span>{right}</span>
    </div>
  );
}

function Stats({ events, authorized }: { events: Event[]; authorized: boolean }) {
  const totals = useMemo(() => {
    const total = events.reduce((s, e) => s + e.amount, 0);
    return { total, count: events.length };
  }, [events]);
  return (
    <div className="grid grid-cols-3 gap-4 mt-6">
      <Stat label="Settled events" value={String(totals.count)} />
      <Stat
        label="Total volume"
        value={authorized ? `${totals.total.toLocaleString()} lamports` : '████████'}
      />
      <Stat label="Network" value="Solana devnet · MagicBlock PER" />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-haze px-5 py-4">
      <div className="text-xs uppercase tracking-widest text-zinc-500">{label}</div>
      <div className="mt-1 text-lg font-semibold">{value}</div>
    </div>
  );
}
