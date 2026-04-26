import Link from 'next/link';
import { Lock, Zap, Bot, ShieldCheck, ArrowRight, Github } from 'lucide-react';

export default function LandingPage() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-12">
      <Header />

      <section className="mt-16 md:mt-28 grid md:grid-cols-2 gap-12 items-center">
        <div>
          <span className="inline-flex items-center gap-2 text-xs uppercase tracking-widest text-accent">
            <Lock className="w-3.5 h-3.5" /> Privacy Track · Colosseum Hackathon
          </span>
          <h1 className="mt-4 text-5xl md:text-6xl font-semibold leading-[1.05]">
            Private payment rails<br />
            <span className="bg-gradient-to-r from-accent to-accent2 bg-clip-text text-transparent">
              for autonomous agents.
            </span>
          </h1>
          <p className="mt-6 text-lg text-zinc-400 max-w-lg">
            Ohlarr drops into any HTTP API in 4 lines of code. Powered by{' '}
            <strong className="text-white">x402</strong> and{' '}
            <strong className="text-white">MagicBlock Private Ephemeral Rollups</strong>{' '}
            (Intel TDX TEE) on Solana — amounts and intent stay encrypted, settlement stays verifiable.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-accent text-white font-medium hover:bg-accent/90 transition glow"
            >
              See it live <ArrowRight className="w-4 h-4" />
            </Link>
            <a
              href="https://github.com/thesithunyein/ohlarr"
              className="inline-flex items-center gap-2 px-5 py-3 rounded-xl border border-zinc-800 hover:border-zinc-600 transition"
            >
              <Github className="w-4 h-4" /> View source
            </a>
          </div>
        </div>

        <CodeShowcase />
      </section>

      <section className="mt-28 grid md:grid-cols-3 gap-6">
        <Feature
          icon={<Lock className="w-5 h-5" />}
          title="Encrypted by default"
          body="State lives inside Intel TDX. Public observers see opaque commits — only Permission members read amounts."
        />
        <Feature
          icon={<Zap className="w-5 h-5" />}
          title="One-RTT payments"
          body="Settle inside the Ephemeral Rollup at L1.5 latency. No waiting for finality on the base layer."
        />
        <Feature
          icon={<Bot className="w-5 h-5" />}
          title="Agent-native"
          body="Standard HTTP 402. Drop a middleware on the seller, wrap fetch() on the buyer. No custom protocols."
        />
      </section>

      <section className="mt-28">
        <div className="rounded-2xl border border-zinc-800 bg-haze p-8 md:p-12">
          <div className="flex items-start gap-4">
            <ShieldCheck className="w-6 h-6 text-accent2 mt-1" />
            <div>
              <h2 className="text-2xl font-semibold">Built on the right primitives.</h2>
              <p className="mt-3 text-zinc-400 max-w-2xl">
                Ohlarr uses MagicBlock&apos;s ER + PER + Permission Program in concert. The agent
                handshake follows Coinbase&apos;s x402 spec verbatim, so any LangChain / CrewAI /
                MCP agent works out of the box.
              </p>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}

function Header() {
  return (
    <header className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent to-accent2" />
        <span className="text-lg font-semibold tracking-tight">Ohlarr</span>
      </div>
      <nav className="hidden md:flex gap-8 text-sm text-zinc-400">
        <Link href="/dashboard" className="hover:text-white">Dashboard</Link>
        <a href="#" className="hover:text-white">Docs</a>
        <a href="https://github.com/thesithunyein/ohlarr" className="hover:text-white">GitHub</a>
      </nav>
    </header>
  );
}

function Feature({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-haze p-6">
      <div className="w-9 h-9 rounded-lg bg-accent/15 text-accent grid place-items-center">
        {icon}
      </div>
      <h3 className="mt-4 font-medium">{title}</h3>
      <p className="mt-2 text-sm text-zinc-400">{body}</p>
    </div>
  );
}

function CodeShowcase() {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-haze p-1 glow">
      <div className="rounded-xl bg-ink p-5 font-mono text-[12.5px] leading-relaxed">
        <div className="flex gap-1.5 mb-4">
          <span className="w-2.5 h-2.5 rounded-full bg-zinc-700" />
          <span className="w-2.5 h-2.5 rounded-full bg-zinc-700" />
          <span className="w-2.5 h-2.5 rounded-full bg-zinc-700" />
          <span className="ml-3 text-xs text-zinc-500">seller.ts</span>
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

function Footer() {
  return (
    <footer className="mt-32 pb-8 text-xs text-zinc-500 flex justify-between border-t border-zinc-900 pt-8">
      <span>© {new Date().getFullYear()} Ohlarr · MIT License</span>
      <span>Built for the Privacy Track — powered by MagicBlock</span>
    </footer>
  );
}
