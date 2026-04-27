'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import { Eye, EyeOff, Lock, Unlock, Activity, ArrowLeft, Radio } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { RabbitLogo } from '@/components/rabbit-logo';
import { GridBackground } from '@/components/animated-bg';

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
  return s + '\u2026';
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

  const toggle = useCallback(() => setAuthorized((v) => !v), []);

  return (
    <>
      <GridBackground />
      <main className="relative mx-auto max-w-7xl px-6 py-6">
        {/* Nav */}
        <motion.nav
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between glass rounded-2xl px-5 py-3 mb-8 border border-zinc-800/50"
        >
          <div className="flex items-center gap-4">
            <Link href="/" className="flex items-center gap-2 text-zinc-400 hover:text-white transition-colors">
              <ArrowLeft className="w-4 h-4" />
              <RabbitLogo size={24} />
              <span className="font-semibold text-white">Ohlarr</span>
            </Link>
            <span className="text-zinc-700">|</span>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-accent2 live-dot" />
              <span className="text-sm text-zinc-400">Live Stream</span>
            </div>
          </div>
          <motion.button
            onClick={toggle}
            whileTap={{ scale: 0.97 }}
            className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all duration-300 ${
              authorized
                ? 'bg-accent2/15 text-accent2 border border-accent2/30 hover:bg-accent2/25'
                : 'bg-accent text-white hover:bg-accent/90 glow'
            }`}
          >
            {authorized ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
            {authorized ? 'Lock view' : 'Unlock with Permission key'}
          </motion.button>
        </motion.nav>

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-accent2/10 grid place-items-center">
              <Activity className="w-5 h-5 text-accent2" />
            </div>
            Live agent payment stream
          </h1>
          <p className="text-zinc-400 mt-2 max-w-2xl">
            Same on-chain events. Two views. The left stays encrypted to the world; the right is decrypted by your Permission key.
          </p>
        </motion.div>

        {/* Dual panes */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="grid lg:grid-cols-2 gap-6 mt-8"
        >
          <Pane
            title="Public Solana observer"
            subtitle="Anyone watching the chain. No Permission membership."
            icon={<EyeOff className="w-4 h-4" />}
            tone="muted"
          >
            <AnimatePresence initial={false}>
              {events.map((e) => (
                <motion.div
                  key={e.id}
                  initial={{ opacity: 0, x: -20, height: 0 }}
                  animate={{ opacity: 1, x: 0, height: 'auto' }}
                  transition={{ duration: 0.3, ease: 'easeOut' }}
                >
                  <Row
                    ts={e.ts}
                    left={<span className="text-zinc-500">PER commit</span>}
                    middle={<span className="encrypted text-zinc-500">{e.channel}</span>}
                    right={<span className="encrypted text-zinc-500">{'\u2588\u2588\u2588\u2588\u2588\u2588 \u2588\u2588\u2588\u2588'}</span>}
                  />
                </motion.div>
              ))}
            </AnimatePresence>
          </Pane>

          <Pane
            title="Authorized Ohlarr view"
            subtitle={authorized ? 'Permission key validated. Decrypting state\u2026' : 'Locked. Click Unlock to reveal.'}
            icon={<Eye className="w-4 h-4" />}
            tone="hot"
            authorized={authorized}
          >
            <AnimatePresence initial={false}>
              {events.map((e) => (
                <motion.div
                  key={e.id}
                  initial={{ opacity: 0, x: 20, height: 0 }}
                  animate={{ opacity: 1, x: 0, height: 'auto' }}
                  transition={{ duration: 0.3, ease: 'easeOut' }}
                >
                  <Row
                    ts={e.ts}
                    left={
                      authorized ? (
                        <span>
                          <span className="text-accent2">{e.buyer}</span>{' '}
                          <span className="text-zinc-600">{'\u2192'}</span>{' '}
                          <span className="text-accent">{e.seller}</span>
                        </span>
                      ) : (
                        <span className="encrypted text-zinc-600">{'\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588'}</span>
                      )
                    }
                    middle={
                      authorized ? (
                        <span className="text-zinc-300">{e.api}</span>
                      ) : (
                        <span className="encrypted text-zinc-600">{'\u2588\u2588\u2588\u2588\u2588\u2588 \u2588\u2588\u2588\u2588 \u2588\u2588\u2588'}</span>
                      )
                    }
                    right={
                      authorized ? (
                        <span className="text-amber-300 font-medium">{e.amount.toLocaleString()} lamports</span>
                      ) : (
                        <span className="encrypted text-zinc-600">{'\u2588\u2588\u2588\u2588\u2588'}</span>
                      )
                    }
                  />
                </motion.div>
              ))}
            </AnimatePresence>
          </Pane>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Stats events={events} authorized={authorized} />
        </motion.div>

        {/* Network info bar */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-6 flex items-center justify-center gap-6 text-xs text-zinc-600"
        >
          <span className="flex items-center gap-1.5">
            <Radio className="w-3 h-3" /> RPC: devnet
          </span>
          <span>PER: devnet-tee.magicblock.app</span>
          <span>Program: CmHUW...zdLA</span>
        </motion.div>
      </main>
    </>
  );
}

function Pane({
  title,
  subtitle,
  icon,
  tone,
  children,
  authorized,
}: {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  tone: 'muted' | 'hot';
  children: React.ReactNode;
  authorized?: boolean;
}) {
  return (
    <section
      className={`rounded-2xl border bg-haze/80 backdrop-blur-sm transition-all duration-500 ${
        tone === 'hot'
          ? authorized
            ? 'border-accent2/40 glow-green'
            : 'border-accent/30 glow'
          : 'border-zinc-800'
      }`}
    >
      <header className="px-5 py-4 border-b border-zinc-800/50 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-lg grid place-items-center ${
            tone === 'hot' ? 'bg-accent/15 text-accent' : 'bg-zinc-900 text-zinc-400'
          }`}>
            {icon}
          </div>
          <div>
            <div className="text-sm font-semibold">{title}</div>
            <div className="text-xs text-zinc-500">{subtitle}</div>
          </div>
        </div>
        {tone === 'hot' && authorized && (
          <motion.span
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-[10px] uppercase tracking-widest text-accent2 bg-accent2/10 px-2 py-1 rounded-full"
          >
            Decrypted
          </motion.span>
        )}
      </header>
      <div className="divide-y divide-zinc-900/50 max-h-[480px] overflow-auto">{children}</div>
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
    <div className="px-5 py-3 grid grid-cols-[7ch_1fr_2fr_auto] gap-4 items-center text-sm font-mono hover:bg-white/[0.02] transition-colors">
      <span className="text-zinc-600 text-xs tabular-nums">{new Date(ts).toLocaleTimeString().slice(0, 8)}</span>
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
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
      <Stat label="Settled events" value={String(totals.count)} accent={false} />
      <Stat
        label="Total volume"
        value={authorized ? `${totals.total.toLocaleString()} lamports` : '\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588'}
        accent={authorized}
      />
      <Stat label="Network" value="Solana devnet" accent={false} />
      <Stat label="TEE runtime" value="MagicBlock PER" accent={false} />
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent: boolean }) {
  return (
    <div className={`rounded-xl border bg-haze/80 backdrop-blur-sm px-5 py-4 transition-all duration-300 ${
      accent ? 'border-accent2/30 glow-green' : 'border-zinc-800'
    }`}>
      <div className="text-[10px] uppercase tracking-widest text-zinc-500">{label}</div>
      <div className={`mt-1.5 text-lg font-bold tabular-nums ${accent ? 'text-accent2' : ''}`}>{value}</div>
    </div>
  );
}
