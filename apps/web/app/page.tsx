'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Lock, Zap, Bot, ShieldCheck, ArrowRight, Github, ExternalLink, Activity, CheckCircle2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { RabbitLogo } from '@/components/rabbit-logo';
import { GridBackground, FloatingParticles } from '@/components/animated-bg';

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.12, duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] },
  }),
};

const stagger = {
  visible: { transition: { staggerChildren: 0.1 } },
};

export default function LandingPage() {
  return (
    <>
      <GridBackground />
      <FloatingParticles />
      <main className="relative mx-auto max-w-6xl px-6 py-8">
        <Header />

        {/* Hero */}
        <motion.section
          initial="hidden"
          animate="visible"
          variants={stagger}
          className="mt-16 md:mt-24 grid md:grid-cols-2 gap-12 items-center"
        >
          <div>
            <motion.span
              variants={fadeUp}
              custom={0}
              className="inline-flex items-center gap-2 text-xs uppercase tracking-widest text-accent border border-accent/20 rounded-full px-3 py-1.5 bg-accent/5"
            >
              <Lock className="w-3 h-3" /> Privacy Track · Colosseum Hackathon
            </motion.span>
            <motion.h1
              variants={fadeUp}
              custom={1}
              className="mt-6 text-5xl md:text-[3.5rem] lg:text-6xl font-bold leading-[1.05] tracking-tight"
            >
              Private payment rails{' '}
              <span className="text-gradient">for autonomous agents.</span>
            </motion.h1>
            <motion.p
              variants={fadeUp}
              custom={2}
              className="mt-6 text-lg text-zinc-400 max-w-lg leading-relaxed"
            >
              Ohlarr drops into any HTTP API in 4 lines of code. Powered by{' '}
              <strong className="text-white">x402</strong> and{' '}
              <strong className="text-white">MagicBlock Private Ephemeral Rollups</strong>{' '}
              (Intel TDX TEE) on Solana — amounts and intent stay encrypted, settlement stays verifiable.
            </motion.p>
            <motion.div variants={fadeUp} custom={3} className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/dashboard"
                className="group inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-accent text-white font-medium hover:bg-accent/90 transition-all duration-300 glow hover:scale-[1.02]"
              >
                See it live
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </Link>
              <a
                href="https://github.com/thesithunyein/ohlarr"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl border border-zinc-800 hover:border-zinc-600 transition-all duration-300 hover:bg-zinc-900/50"
              >
                <Github className="w-4 h-4" /> View source
              </a>
            </motion.div>
          </div>

          <motion.div variants={fadeUp} custom={2}>
            <CodeShowcase />
          </motion.div>
        </motion.section>

        {/* Live stats banner — proves it's real */}
        <LiveStats />

        {/* Features */}
        <motion.section
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-100px' }}
          variants={stagger}
          className="mt-28 grid md:grid-cols-3 gap-6"
        >
          <Feature
            index={0}
            icon={<Lock className="w-5 h-5" />}
            title="Encrypted by default"
            body="State lives inside Intel TDX. Public observers see opaque commits — only Permission members read amounts."
          />
          <Feature
            index={1}
            icon={<Zap className="w-5 h-5" />}
            title="One-RTT payments"
            body="Settle inside the Ephemeral Rollup at L1.5 latency. No waiting for finality on the base layer."
          />
          <Feature
            index={2}
            icon={<Bot className="w-5 h-5" />}
            title="Agent-native"
            body="Standard HTTP 402. Drop a middleware on the seller, wrap fetch() on the buyer. No custom protocols."
          />
        </motion.section>

        {/* Architecture */}
        <motion.section
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 0.6 }}
          className="mt-28"
        >
          <div className="rounded-2xl gradient-border bg-haze p-8 md:p-12">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-accent2/10 grid place-items-center flex-shrink-0">
                <ShieldCheck className="w-5 h-5 text-accent2" />
              </div>
              <div>
                <h2 className="text-2xl font-bold">Built on the right primitives.</h2>
                <p className="mt-3 text-zinc-400 max-w-2xl leading-relaxed">
                  Ohlarr uses MagicBlock&apos;s ER + PER + Permission Program in concert. The agent
                  handshake follows Coinbase&apos;s x402 spec verbatim, so any LangChain / CrewAI /
                  MCP agent works out of the box.
                </p>
                <div className="mt-6 flex flex-wrap gap-3">
                  {['Solana', 'Anchor', 'MagicBlock PER', 'Intel TDX TEE', 'x402', 'TypeScript SDK'].map((tag) => (
                    <span
                      key={tag}
                      className="text-xs px-3 py-1.5 rounded-full border border-zinc-800 text-zinc-400 bg-ink/50"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </motion.section>

        {/* How it works */}
        <motion.section
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-100px' }}
          variants={stagger}
          className="mt-28"
        >
          <motion.h2 variants={fadeUp} custom={0} className="text-3xl font-bold text-center">
            How it works
          </motion.h2>
          <motion.p variants={fadeUp} custom={1} className="text-zinc-400 text-center mt-3 max-w-xl mx-auto">
            Three steps. No custom protocols. No key exchange ceremonies.
          </motion.p>
          <div className="mt-12 grid md:grid-cols-3 gap-8">
            {[
              { step: '01', title: 'Seller adds middleware', desc: 'One line of code wraps any Express/Next.js route with x402 payment requirements.' },
              { step: '02', title: 'Buyer agent pays', desc: 'The agent receives HTTP 402, signs a settlement TX inside the Private Ephemeral Rollup.' },
              { step: '03', title: 'Encrypted settlement', desc: 'Payment settles in the TEE. Public chain sees only opaque commits. Permission members see everything.' },
            ].map((item, i) => (
              <motion.div
                key={item.step}
                variants={fadeUp}
                custom={i + 2}
                className="relative"
              >
                <span className="text-5xl font-black text-gradient opacity-20">{item.step}</span>
                <h3 className="mt-2 text-lg font-semibold">{item.title}</h3>
                <p className="mt-2 text-sm text-zinc-400 leading-relaxed">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </motion.section>

        {/* CTA */}
        <motion.section
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="mt-28 text-center"
        >
          <div className="rounded-2xl bg-gradient-to-br from-accent/10 to-accent2/10 border border-accent/20 p-12">
            <RabbitLogo size={56} className="mx-auto mb-6 animate-float" />
            <h2 className="text-3xl font-bold">Ready to make agent payments private?</h2>
            <p className="mt-3 text-zinc-400 max-w-md mx-auto">
              Explore the live dashboard, read the source, or deploy your own instance.
            </p>
            <div className="mt-8 flex justify-center gap-4">
              <Link
                href="/dashboard"
                className="group inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-accent text-white font-medium hover:bg-accent/90 transition-all duration-300 glow hover:scale-[1.02]"
              >
                Live Dashboard
                <ExternalLink className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
              <a
                href="https://github.com/thesithunyein/ohlarr"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl border border-zinc-700 hover:border-zinc-500 transition-all duration-300"
              >
                <Github className="w-4 h-4" /> GitHub
              </a>
            </div>
          </div>
        </motion.section>

        <Footer />
      </main>
    </>
  );
}

function Header() {
  return (
    <motion.header
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="flex items-center justify-between glass rounded-2xl px-6 py-3 sticky top-4 z-50 border border-zinc-800/50"
    >
      <Link href="/" className="flex items-center gap-2.5 group">
        <RabbitLogo size={32} className="transition-transform group-hover:scale-110" />
        <span className="text-lg font-bold tracking-tight">Ohlarr</span>
      </Link>
      <nav className="hidden md:flex items-center gap-8 text-sm text-zinc-400">
        <Link href="/dashboard" className="hover:text-white transition-colors">Dashboard</Link>
        <a href="https://github.com/thesithunyein/ohlarr" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">Docs</a>
        <a
          href="https://github.com/thesithunyein/ohlarr"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-zinc-800 hover:border-accent/40 hover:bg-accent/5 transition-all"
        >
          <Github className="w-3.5 h-3.5" /> GitHub
        </a>
      </nav>
    </motion.header>
  );
}

function Feature({
  icon,
  title,
  body,
  index,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  index: number;
}) {
  return (
    <motion.div
      variants={fadeUp}
      custom={index}
      className="rounded-xl border border-zinc-800 bg-haze p-6 card-hover"
    >
      <div className="w-10 h-10 rounded-xl bg-accent/10 text-accent grid place-items-center">
        {icon}
      </div>
      <h3 className="mt-4 text-lg font-semibold">{title}</h3>
      <p className="mt-2 text-sm text-zinc-400 leading-relaxed">{body}</p>
    </motion.div>
  );
}

function CodeShowcase() {
  return (
    <div className="rounded-2xl gradient-border bg-haze p-1 animate-glow-pulse">
      <div className="rounded-xl bg-ink p-6 font-mono text-[13px] leading-relaxed">
        <div className="flex items-center gap-1.5 mb-5">
          <span className="w-3 h-3 rounded-full bg-red-500/60" />
          <span className="w-3 h-3 rounded-full bg-yellow-500/60" />
          <span className="w-3 h-3 rounded-full bg-green-500/60" />
          <span className="ml-3 text-xs text-zinc-500 font-sans">seller.ts</span>
        </div>
        <pre className="whitespace-pre-wrap"><code>
          <span className="text-pink-400">import</span> <span className="text-zinc-200">{'{'} ohlarrMiddleware {'}'}</span> <span className="text-pink-400">from</span> <span className="text-emerald-400">{`'@ohlarr/sdk'`}</span>;
{'\n\n'}app.get(<span className="text-emerald-400">{`'/api/premium'`}</span>,
{'\n  '}<span className="text-sky-400">ohlarrMiddleware</span>({'{'} programId, sellerPubkey, per, price: <span className="text-amber-300">1000n</span> {'}'}),
{'\n  '}(req, res) {'=>'} res.json({'{'} oracle: <span className="text-emerald-400">{`'BTC/USD'`}</span>, price: <span className="text-amber-300">99421.18</span> {'}'}),
{'\n'});
        </code></pre>
      </div>
    </div>
  );
}

function LiveStats() {
  const [stats, setStats] = useState<{
    deployed?: boolean;
    totalTxns?: number;
    successful?: number;
    programId?: string;
    latestTxSig?: string;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      fetch('/api/stats')
        .then((r) => r.json())
        .then((d) => !cancelled && setStats(d))
        .catch(() => {});
    };
    load();
    const t = setInterval(load, 15_000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, []);

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5 }}
      className="mt-20"
    >
      <div className="rounded-2xl border border-accent2/30 bg-gradient-to-br from-accent2/5 via-transparent to-accent/5 p-6 md:p-8">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-2 h-2 rounded-full bg-accent2 live-dot" />
          <span className="text-xs uppercase tracking-widest text-accent2 font-medium">
            Live on Solana devnet
          </span>
          {stats?.deployed && (
            <span className="ml-auto inline-flex items-center gap-1 text-xs text-accent2">
              <CheckCircle2 className="w-3 h-3" /> Program deployed
            </span>
          )}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
          <StatBlock
            label="Real settlements"
            value={stats?.successful != null ? stats.successful.toLocaleString() : '—'}
            highlight
          />
          <StatBlock
            label="Total program txns"
            value={stats?.totalTxns != null ? stats.totalTxns.toLocaleString() : '—'}
          />
          <StatBlock label="Network" value="Solana devnet" />
          <StatBlock label="TEE runtime" value="MagicBlock PER" />
        </div>
        <div className="mt-5 pt-5 border-t border-zinc-800/60 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-zinc-500 font-mono">
          <span className="flex items-center gap-1.5">
            <Activity className="w-3 h-3" /> Auto-refresh every 15s
          </span>
          {stats?.programId && (
            <a
              href={`https://explorer.solana.com/address/${stats.programId}?cluster=devnet`}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-zinc-300 inline-flex items-center gap-1"
            >
              Program: {stats.programId.slice(0, 8)}...{stats.programId.slice(-4)}
              <ExternalLink className="w-3 h-3" />
            </a>
          )}
          {stats?.latestTxSig && (
            <a
              href={`https://explorer.solana.com/tx/${stats.latestTxSig}?cluster=devnet`}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-zinc-300 inline-flex items-center gap-1"
            >
              Latest tx: {stats.latestTxSig.slice(0, 8)}...
              <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
      </div>
    </motion.section>
  );
}

function StatBlock({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-widest text-zinc-500">{label}</div>
      <div
        className={`mt-1.5 text-2xl md:text-3xl font-bold tabular-nums ${
          highlight ? 'text-accent2' : 'text-white'
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function Footer() {
  return (
    <footer className="mt-32 pb-8 text-xs text-zinc-500 flex flex-col sm:flex-row justify-between items-center border-t border-zinc-900 pt-8 gap-3">
      <div className="flex items-center gap-2">
        <RabbitLogo size={16} />
        <span>© {new Date().getFullYear()} Ohlarr · MIT License</span>
      </div>
      <span>Built for the Privacy Track — powered by MagicBlock</span>
    </footer>
  );
}
