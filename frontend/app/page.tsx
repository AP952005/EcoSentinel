'use client';
import Link from 'next/link';
import Image from 'next/image';
import { Avatar } from '@/components/ui/Avatar';
import { Leaf, Shield, Map, Search, MessageSquare, ArrowRight, Eye, Activity } from 'lucide-react';

const FEATURES = [
  {
    icon: Leaf,
    title: 'First Environmental Report',
    description: 'Automatically generate preliminary environmental assessments from project data, supporting documents and satellite observations.',
    color: 'text-emerald-400',
  },
  {
    icon: Map,
    title: 'Shadow Footprint Intelligence',
    description: 'Visualize Zone A (core footprint) and Zone B (investigation area), compare historical satellite composites and surface candidate changes.',
    color: 'text-teal-400',
  },
  {
    icon: Search,
    title: 'Challenge This Finding',
    description: 'Examine supporting evidence, contradictory evidence, data quality and alternative explanations before drawing any conclusions.',
    color: 'text-cyan-400',
  },
  {
    icon: Eye,
    title: 'Watchtower Monitoring',
    description: 'Continuous monitoring plans that distinguish new findings from failed scans and periods when satellite data is unavailable.',
    color: 'text-blue-400',
  },
  {
    icon: MessageSquare,
    title: 'Case-Grounded AI Chat',
    description: 'Ask questions about case evidence with citations to actual source documents and database records — not fabricated answers.',
    color: 'text-violet-400',
  },
  {
    icon: Shield,
    title: 'Evidence-First Design',
    description: 'Every finding links to its source or calculation. Acquisition dates, data quality and analysis method are always visible.',
    color: 'text-amber-400',
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-slate-950">
      {/* Nav */}
      <nav className="border-b border-slate-800 bg-slate-950/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-teal-500 to-cyan-600 flex items-center justify-center">
              <Leaf size={18} className="text-slate-950" />
            </div>
            <span className="font-bold text-slate-100">EcoSentinel</span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login" className="btn-ghost text-sm">Sign in</Link>
            <Link href="/register" className="btn-primary text-sm">Get started</Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-7xl mx-auto px-6 py-24 flex flex-col lg:flex-row items-center gap-16">
        <div className="flex-1">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-teal-500/10 border border-teal-500/20 text-teal-400 text-xs font-medium mb-6">
            <Activity size={12} className="animate-pulse" />
            Environmental Intelligence Platform
          </div>
          <h1 className="text-5xl lg:text-6xl font-bold text-slate-100 leading-tight mb-6">
            Know what was there.{' '}
            <span className="gradient-text">Understand what changed.</span>{' '}
            Investigate what matters.
          </h1>
          <p className="text-lg text-slate-400 leading-relaxed mb-8 max-w-xl">
            EcoSentinel connects project information, environmental observations and satellite data
            into a structured investigation workflow — with evidence you can trace back to its source.
          </p>
          <div className="flex items-center gap-4">
            <Link href="/register" className="btn-primary text-base px-6 py-3">
              Start investigating <ArrowRight size={16} />
            </Link>
            <Link href="/login" className="btn-secondary text-base px-6 py-3">
              Sign in
            </Link>
          </div>
          <p className="text-xs text-slate-600 mt-4">
            EcoSentinel supports environmental investigation. It does not replace officer judgment,
            statutory EIA processes or government decision-making.
          </p>
        </div>

        {/* Avatar hero */}
        <div className="flex-shrink-0 relative">
          <div className="w-64 h-64 rounded-full bg-gradient-to-br from-teal-500/10 to-cyan-600/5 border border-teal-500/10 flex items-center justify-center">
            <Avatar state="greeting" size={220} />
          </div>
          <div className="absolute -top-4 -right-4 eco-card px-3 py-2 text-xs text-teal-400 font-medium animate-fade-in-up">
            ● AI ready
          </div>
          <div className="absolute -bottom-4 -left-4 eco-card px-3 py-2 text-xs text-violet-400 font-medium">
            ⏺ REPLAY mode
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-7xl mx-auto px-6 py-20">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-slate-100 mb-4">
            The complete environmental investigation workflow
          </h2>
          <p className="text-slate-400 max-w-2xl mx-auto">
            From project intake to evidence-backed findings, every step is traceable and honest about its data sources.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {FEATURES.map(({ icon: Icon, title, description, color }) => (
            <div key={title} className="eco-card-hover p-6 group">
              <div className={`w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center mb-4 ${color}`}>
                <Icon size={20} />
              </div>
              <h3 className="font-semibold text-slate-200 mb-2">{title}</h3>
              <p className="text-sm text-slate-400 leading-relaxed">{description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-7xl mx-auto px-6 py-20">
        <div className="eco-card p-12 text-center bg-gradient-to-br from-teal-900/20 to-slate-900/60">
          <h2 className="text-3xl font-bold text-slate-100 mb-4">Ready to start your first investigation?</h2>
          <p className="text-slate-400 mb-8 max-w-lg mx-auto">
            Create an account and run the demo replay case to see the full workflow — from project intake to FER to challenge analysis.
          </p>
          <Link href="/register" className="btn-primary text-base px-8 py-3">
            Create free account <ArrowRight size={16} />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-800 py-8 text-center">
        <p className="text-xs text-slate-600">
          EcoSentinel v1.0.0 — Local development mode. Not connected to any Google Cloud service by default.{' '}
          <Link href="/deployment" className="text-teal-600 hover:text-teal-400">View architecture</Link>
        </p>
      </footer>
    </div>
  );
}
