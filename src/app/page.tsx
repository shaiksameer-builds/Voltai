import { getSessionUser } from '@/lib/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';

export default async function Home() {
  const user = await getSessionUser();
  if (user) redirect('/dashboard');

  return (
    <div className="relative min-h-screen bg-black overflow-hidden flex flex-col items-center justify-center">

      {/* ── Background Thunder Grid ── */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none select-none">
        {/* Radial yellow glow burst */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] rounded-full bg-yellow-400/[0.07] blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[350px] h-[350px] rounded-full bg-yellow-400/[0.12] blur-2xl" />

        {/* Grid lines */}
        <svg
          className="absolute inset-0 w-full h-full opacity-[0.07]"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <pattern id="grid" width="60" height="60" patternUnits="userSpaceOnUse">
              <path d="M 60 0 L 0 0 0 60" fill="none" stroke="#facc15" strokeWidth="0.6" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>

        {/* Large faded thunder bolt watermark */}
        <svg
          viewBox="0 0 200 280"
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[480px] h-[480px] opacity-[0.04] text-yellow-400"
          fill="currentColor"
        >
          <polygon points="120,10 40,140 100,140 80,270 160,110 100,110" />
        </svg>
      </div>

      {/* ── Hero Content ── */}
      <main className="relative z-10 flex flex-col items-center text-center px-6 max-w-3xl mx-auto">
        
        {/* Logo Mark */}
        <div className="relative mb-8 group">
          <div className="absolute -inset-4 rounded-full bg-yellow-400 blur-2xl opacity-25 group-hover:opacity-50 transition duration-700" />
          <div className="relative flex items-center justify-center w-24 h-24 rounded-3xl bg-zinc-950 border-2 border-yellow-400/60 shadow-2xl shadow-yellow-400/20">
            <svg viewBox="0 0 24 24" className="w-12 h-12 text-yellow-400" fill="currentColor">
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
            </svg>
          </div>
        </div>

        {/* Brand Name */}
        <h1 className="text-6xl sm:text-8xl font-black tracking-tighter text-white mb-2">
          VOLT<span className="text-yellow-400">AI</span>
        </h1>
        <p className="text-xs uppercase font-mono tracking-[0.4em] text-zinc-500 mb-6">
          Energy Intelligence Platform
        </p>

        {/* Tagline */}
        <p className="text-lg sm:text-xl text-zinc-400 leading-relaxed max-w-xl mb-10">
          Upload your energy data. Track solar production forecasts. Discover the{' '}
          <span className="text-yellow-400 font-semibold">optimal times</span> to run
          high-draw appliances and cut your electricity bills.
        </p>

        {/* Feature Pills */}
        <div className="flex flex-wrap gap-3 justify-center mb-12">
          {[
            '⚡ AI-Powered Forecasting',
            '📂 CSV Data Import',
            '📊 Real-Time Analytics',
            '💡 Smart Scheduling',
          ].map(pill => (
            <span
              key={pill}
              className="px-4 py-1.5 rounded-full text-xs font-semibold bg-zinc-900 border border-zinc-700 text-zinc-300"
            >
              {pill}
            </span>
          ))}
        </div>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row items-center gap-4">
          <Link
            href="/signup"
            className="group relative px-8 py-3.5 rounded-xl bg-yellow-400 text-black text-base font-bold shadow-2xl shadow-yellow-400/30 hover:shadow-yellow-400/60 hover:bg-yellow-300 transition-all duration-200 hover:-translate-y-0.5"
          >
            <span className="flex items-center gap-2">
              <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" /></svg>
              Get Started Free
            </span>
          </Link>
          <Link
            href="/login"
            className="px-8 py-3.5 rounded-xl bg-transparent border border-zinc-700 text-zinc-300 text-base font-medium hover:border-yellow-400 hover:text-yellow-400 transition-all duration-200"
          >
            Sign In →
          </Link>
        </div>
      </main>

      {/* Bottom Attribution */}
      <footer className="relative z-10 absolute bottom-6 text-zinc-700 text-xs font-mono tracking-wider">
        Powered by Open-Meteo Solar Forecasting
      </footer>
    </div>
  );
}
