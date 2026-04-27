'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import {
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Activity,
  ArrowLeft,
  Radio,
  ExternalLink,
  Zap,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Bot,
  Terminal,
  X,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { RabbitLogo } from '@/components/rabbit-logo';
import { GridBackground } from '@/components/animated-bg';
import { useProgramEvents, type OnChainEvent } from '@/hooks/use-program-events';
import { explorerTxUrl, explorerAddrUrl, shortAddr, PROGRAM_ID } from '@/lib/solana';

// ── Synthesized demo data (fallback when program not deployed yet) ──
type DemoEvent = {
  id: string;
  ts: number;
  channel: string;
  buyer: string;
  seller: string;
  amount: number;
  api: string;
  txSig: string;
  type: 'settle';
  isReal: false;
};

type UnifiedEvent = (OnChainEvent & { isReal: true; api: string }) | DemoEvent;

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
  const [demoEvents, setDemoEvents] = useState<DemoEvent[]>([]);
  const [demoRunning, setDemoRunning] = useState(false);
  const [demoResult, setDemoResult] = useState<{ success: boolean; message: string } | null>(null);
  const [agentRunning, setAgentRunning] = useState(false);
  const [agentResult, setAgentResult] = useState<{
    transcript: { step: string; type: string; detail: string; data?: unknown }[];
    finalPrice?: number;
    txSig?: string;
    explorer?: string;
    durationMs?: number;
    error?: string;
  } | null>(null);
  const { events: onChainEvents, isLive, isLoading, programDeployed } = useProgramEvents();

  // Synthesize demo events as fallback
  useEffect(() => {
    if (programDeployed && onChainEvents.length > 0) return; // Real data available
    const t = setInterval(() => {
      const buyer = AGENTS.filter((a) => a.kind === 'buyer');
      const seller = AGENTS.filter((a) => a.kind === 'seller');
      const ev: DemoEvent = {
        id: crypto.randomUUID(),
        ts: Date.now(),
        channel: shortB58(),
        buyer: rand(buyer).name,
        seller: rand(seller).name,
        amount: 100 + Math.floor(Math.random() * 9000),
        api: rand(APIS),
        txSig: shortB58() + shortB58(),
        type: 'settle',
        isReal: false,
      };
      setDemoEvents((p) => [ev, ...p].slice(0, 20));
    }, 1100);
    return () => clearInterval(t);
  }, [programDeployed, onChainEvents.length]);

  // Merge real + demo events
  const events: UnifiedEvent[] = useMemo(() => {
    if (onChainEvents.length > 0) {
      return onChainEvents.map((e) => ({
        ...e,
        isReal: true as const,
        api: rand(APIS),
      }));
    }
    return demoEvents;
  }, [onChainEvents, demoEvents]);

  const mode = onChainEvents.length > 0 ? 'live' : 'demo';

  const toggle = useCallback(() => setAuthorized((v) => !v), []);

  // Trigger real devnet transaction
  const runDemo = useCallback(async () => {
    setDemoRunning(true);
    setDemoResult(null);
    try {
      const res = await fetch('/api/demo', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setDemoResult({
          success: true,
          message: `Settled ${data.amount} lamports! Tx: ${shortAddr(data.transactions[data.transactions.length - 1]?.sig || '', 8)}`,
        });
      } else {
        setDemoResult({ success: false, message: data.error || 'Failed' });
      }
    } catch (err) {
      setDemoResult({ success: false, message: err instanceof Error ? err.message : 'Network error' });
    } finally {
      setDemoRunning(false);
    }
  }, []);

  // Watch a real AI agent perform an x402 purchase
  const runAgent = useCallback(async () => {
    setAgentRunning(true);
    setAgentResult({ transcript: [] });
    try {
      const res = await fetch('/api/agent-buy', { method: 'POST' });
      const data = await res.json();
      setAgentResult(data);
    } catch (err) {
      setAgentResult({
        transcript: [],
        error: err instanceof Error ? err.message : 'Network error',
      });
    } finally {
      setAgentRunning(false);
    }
  }, []);

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
              {mode === 'live' ? (
                <>
                  <div className="w-2 h-2 rounded-full bg-accent2 live-dot" />
                  <span className="text-sm text-accent2 font-medium">LIVE</span>
                </>
              ) : (
                <>
                  <div className="w-2 h-2 rounded-full bg-amber-400 live-dot" />
                  <span className="text-sm text-amber-400 font-medium">DEMO</span>
                </>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <motion.button
              onClick={runAgent}
              disabled={agentRunning}
              whileTap={{ scale: 0.97 }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border border-purple-500/40 text-purple-300 bg-purple-500/5 hover:bg-purple-500/15 transition-all disabled:opacity-50"
            >
              {agentRunning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Bot className="w-3.5 h-3.5" />}
              {agentRunning ? 'Agent paying...' : 'Watch AI Agent Buy'}
            </motion.button>
            <motion.button
              onClick={runDemo}
              disabled={demoRunning}
              whileTap={{ scale: 0.97 }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border border-accent2/30 text-accent2 hover:bg-accent2/10 transition-all disabled:opacity-50"
            >
              {demoRunning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
              Run Real Tx
            </motion.button>
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
          </div>
        </motion.nav>

        {/* Demo result toast */}
        <AnimatePresence>
          {demoResult && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className={`mb-4 rounded-xl border px-4 py-3 text-sm flex items-center gap-2 ${
                demoResult.success
                  ? 'border-accent2/30 bg-accent2/5 text-accent2'
                  : 'border-red-500/30 bg-red-500/5 text-red-400'
              }`}
            >
              {demoResult.success ? <Zap className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
              {demoResult.message}
              <button onClick={() => setDemoResult(null)} className="ml-auto text-zinc-500 hover:text-white">&times;</button>
            </motion.div>
          )}
        </AnimatePresence>

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
            {mode === 'live'
              ? 'Showing real Solana devnet transactions. Two views \u2014 the left stays encrypted; the right is decrypted by your Permission key.'
              : 'Simulated stream (program not yet deployed). Click "Run Real Tx" to trigger real devnet transactions, or deploy the program first.'}
          </p>
          {isLoading && (
            <div className="flex items-center gap-2 mt-2 text-sm text-zinc-500">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Connecting to Solana devnet...
            </div>
          )}
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
            subtitle="What every node, indexer & MEV bot sees on devnet."
            icon={<EyeOff className="w-4 h-4" />}
            tone="muted"
          >
            <AnimatePresence initial={false}>
              {events.map((e) => {
                const ixName =
                  e.type === 'settle'
                    ? 'Settle'
                    : e.type === 'channel_opened'
                      ? 'OpenChannel'
                      : e.type === 'deposit'
                        ? 'Deposit'
                        : e.type === 'init_vault'
                          ? 'InitializeVault'
                          : 'Unknown';
                return (
                  <motion.div
                    key={e.id}
                    initial={{ opacity: 0, x: -20, height: 0 }}
                    animate={{ opacity: 1, x: 0, height: 'auto' }}
                    transition={{ duration: 0.3, ease: 'easeOut' }}
                    className="px-5 py-3 hover:bg-white/[0.02] transition-colors group border-b border-zinc-900/50"
                  >
                    <div className="flex items-center justify-between gap-3 text-xs font-mono">
                      <div className="flex items-center gap-2">
                        <span className="text-zinc-600 tabular-nums">
                          {new Date(e.ts).toLocaleTimeString().slice(0, 8)}
                        </span>
                        <span className="px-1.5 py-0.5 rounded bg-zinc-800/60 text-zinc-400 text-[10px]">
                          {ixName}
                        </span>
                        <span className="flex items-center gap-1 text-emerald-600/70 text-[10px]">
                          <CheckCircle2 className="w-2.5 h-2.5" /> verified
                        </span>
                      </div>
                      {e.isReal && e.txSig && (
                        <a
                          href={explorerTxUrl(e.txSig)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-zinc-500 hover:text-accent2 transition-colors flex items-center gap-1"
                        >
                          {shortAddr(e.txSig, 6)}
                          <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      )}
                    </div>
                    <div className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs font-mono">
                      <span className="text-zinc-700">from</span>
                      <span className="encrypted text-zinc-600 tracking-widest">
                        {'\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588'}
                      </span>
                      <span className="text-zinc-700">to</span>
                      <span className="encrypted text-zinc-600 tracking-widest">
                        {'\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588'}
                      </span>
                      <span className="text-zinc-700">api</span>
                      <span className="encrypted text-zinc-600">
                        {'\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588'}
                      </span>
                      <span className="text-zinc-700">amount</span>
                      <span className="encrypted text-zinc-600">
                        {'\u2588\u2588\u2588\u2588\u2588\u2588\u2588 lamports'}
                      </span>
                      <span className="text-zinc-700">commit</span>
                      <span className="text-zinc-500 truncate">
                        {e.isReal ? shortAddr(e.channel || e.txSig, 8) : 'PER:rollup-state-root'}
                      </span>
                    </div>
                  </motion.div>
                );
              })}
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
                        <span className="encrypted text-zinc-600">
                          {'\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588'}
                        </span>
                      )
                    }
                    middle={
                      authorized ? (
                        <span className="text-zinc-300">{e.api}</span>
                      ) : (
                        <span className="encrypted text-zinc-600">
                          {'\u2588\u2588\u2588\u2588\u2588\u2588 \u2588\u2588\u2588\u2588 \u2588\u2588\u2588'}
                        </span>
                      )
                    }
                    right={
                      authorized ? (
                        <span className="text-amber-300 font-medium">
                          {e.amount.toLocaleString()} lamports
                        </span>
                      ) : (
                        <span className="encrypted text-zinc-600">
                          {'\u2588\u2588\u2588\u2588\u2588'}
                        </span>
                      )
                    }
                    txSig={e.isReal ? e.txSig : undefined}
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
          <Stats events={events} authorized={authorized} programDeployed={programDeployed} />
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
          <a
            href={explorerAddrUrl(PROGRAM_ID.toBase58())}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 hover:text-zinc-400 transition-colors"
          >
            Program: {shortAddr(PROGRAM_ID.toBase58(), 4)}
            <ExternalLink className="w-3 h-3" />
          </a>
        </motion.div>

        {/* Agent transcript modal */}
        <AnimatePresence>
          {agentResult && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !agentRunning && setAgentResult(null)}
              className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
            >
              <motion.div
                initial={{ scale: 0.95, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.95, y: 20 }}
                onClick={(e: React.MouseEvent) => e.stopPropagation()}
                className="w-full max-w-3xl max-h-[85vh] overflow-hidden rounded-2xl border border-purple-500/30 bg-zinc-950 glow"
              >
                <header className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between bg-gradient-to-r from-purple-500/10 to-transparent">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-purple-500/15 grid place-items-center">
                      <Bot className="w-5 h-5 text-purple-300" />
                    </div>
                    <div>
                      <div className="font-semibold flex items-center gap-2">
                        AI Agent x402 Purchase
                        {agentRunning && <Loader2 className="w-3.5 h-3.5 animate-spin text-purple-300" />}
                      </div>
                      <div className="text-xs text-zinc-500">
                        Live HTTP transcript · Solana devnet
                        {agentResult.durationMs && ` · ${agentResult.durationMs}ms total`}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => setAgentResult(null)}
                    disabled={agentRunning}
                    className="w-8 h-8 rounded-lg hover:bg-white/5 grid place-items-center text-zinc-500 hover:text-white disabled:opacity-30"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </header>

                {agentResult.error ? (
                  <div className="p-6 text-red-400 flex items-center gap-3">
                    <AlertCircle className="w-5 h-5" />
                    <div>
                      <div className="font-semibold">Agent failed</div>
                      <div className="text-sm text-zinc-400 mt-1 font-mono">{agentResult.error}</div>
                    </div>
                  </div>
                ) : agentResult.transcript.length === 0 ? (
                  <div className="p-12 text-center text-zinc-500">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-3 text-purple-300" />
                    Agent initializing...
                  </div>
                ) : (
                  <div className="overflow-auto max-h-[60vh] p-6 font-mono text-xs space-y-3 bg-black/40">
                    {agentResult.transcript.map((line, i) => {
                      const color =
                        line.type === 'http'
                          ? 'text-cyan-300'
                          : line.type === 'chain'
                            ? 'text-emerald-300'
                            : 'text-zinc-300';
                      const bgColor =
                        line.type === 'http'
                          ? 'bg-cyan-500/5 border-cyan-500/20'
                          : line.type === 'chain'
                            ? 'bg-emerald-500/5 border-emerald-500/20'
                            : 'bg-zinc-800/30 border-zinc-700/40';
                      return (
                        <motion.div
                          key={i}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.04 }}
                          className={`rounded-lg border ${bgColor} p-3`}
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-zinc-600 text-[10px] uppercase tracking-wider">
                              [{line.type}]
                            </span>
                            <span className={`flex-1 ${color}`}>{line.detail}</span>
                          </div>
                          {line.data !== undefined && line.data !== null ? (
                            <pre className="mt-2 pl-4 text-[10px] text-zinc-500 overflow-auto whitespace-pre-wrap break-all">
                              {typeof line.data === 'string'
                                ? line.data
                                : JSON.stringify(line.data, null, 2)}
                            </pre>
                          ) : null}
                        </motion.div>
                      );
                    })}

                    {agentResult.finalPrice && agentResult.txSig && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: agentResult.transcript.length * 0.04 + 0.2 }}
                        className="rounded-xl border-2 border-purple-500/40 bg-gradient-to-br from-purple-500/10 to-emerald-500/10 p-4 mt-4"
                      >
                        <div className="text-xs text-zinc-400 mb-1">Final result</div>
                        <div className="text-2xl font-bold text-white">
                          BTC/USD = ${agentResult.finalPrice.toLocaleString()}
                        </div>
                        <a
                          href={agentResult.explorer}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 mt-3 text-xs text-purple-300 hover:text-purple-200"
                        >
                          <CheckCircle2 className="w-3 h-3" />
                          Verified on Solana Explorer
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </motion.div>
                    )}
                  </div>
                )}

                <footer className="px-6 py-3 border-t border-zinc-800 bg-zinc-900/40 flex items-center justify-between text-xs text-zinc-500">
                  <span className="flex items-center gap-1.5">
                    <Terminal className="w-3 h-3" /> x402 + Ohlarr PER + Solana devnet
                  </span>
                  <span>{agentResult.transcript.length} steps</span>
                </footer>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
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
  txSig,
}: {
  ts: number;
  left: React.ReactNode;
  middle: React.ReactNode;
  right: React.ReactNode;
  txSig?: string;
}) {
  return (
    <div className="px-5 py-3 grid grid-cols-[7ch_1fr_2fr_auto] gap-4 items-center text-sm font-mono hover:bg-white/[0.02] transition-colors group">
      <span className="text-zinc-600 text-xs tabular-nums">
        {new Date(ts).toLocaleTimeString().slice(0, 8)}
      </span>
      <span>{left}</span>
      <span className="truncate">{middle}</span>
      <span className="flex items-center gap-2">
        {right}
        {txSig && (
          <a
            href={explorerTxUrl(txSig)}
            target="_blank"
            rel="noopener noreferrer"
            className="opacity-0 group-hover:opacity-100 transition-opacity"
            title="View on Solana Explorer"
          >
            <ExternalLink className="w-3 h-3 text-zinc-600 hover:text-accent2" />
          </a>
        )}
      </span>
    </div>
  );
}

function Stats({
  events,
  authorized,
  programDeployed,
}: {
  events: UnifiedEvent[];
  authorized: boolean;
  programDeployed: boolean;
}) {
  const totals = useMemo(() => {
    const total = events.reduce((s, e) => s + e.amount, 0);
    return { total, count: events.length };
  }, [events]);

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
      <Stat label="Settled events" value={String(totals.count)} accent={false} />
      <Stat
        label="Total volume"
        value={
          authorized
            ? `${totals.total.toLocaleString()} lamports`
            : '\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588'
        }
        accent={authorized}
      />
      <Stat
        label="Network"
        value="Solana devnet"
        accent={false}
        link={explorerAddrUrl(PROGRAM_ID.toBase58())}
      />
      <Stat
        label="Status"
        value={programDeployed ? 'Program deployed' : 'Not deployed'}
        accent={programDeployed}
      />
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
  link,
}: {
  label: string;
  value: string;
  accent: boolean;
  link?: string;
}) {
  const inner = (
    <div
      className={`rounded-xl border bg-haze/80 backdrop-blur-sm px-5 py-4 transition-all duration-300 ${
        accent ? 'border-accent2/30 glow-green' : 'border-zinc-800'
      }`}
    >
      <div className="text-[10px] uppercase tracking-widest text-zinc-500 flex items-center gap-1">
        {label}
        {link && <ExternalLink className="w-2.5 h-2.5" />}
      </div>
      <div className={`mt-1.5 text-lg font-bold tabular-nums ${accent ? 'text-accent2' : ''}`}>
        {value}
      </div>
    </div>
  );
  if (link) {
    return (
      <a href={link} target="_blank" rel="noopener noreferrer" className="hover:opacity-80 transition-opacity">
        {inner}
      </a>
    );
  }
  return inner;
}
