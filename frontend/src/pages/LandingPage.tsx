import React, { useState, useRef, useEffect } from 'react';
import { api } from '../services/api';
import { LoginResponse } from '../types';
import {
  Eye,
  EyeOff,
  AlertCircle,
  Stethoscope,
  ShieldCheck,
  LayoutGrid,
  Clock,
  HeartPulse,
  Activity,
  ArrowRight,
  Building2,
  Users,
  Zap,
  Lock,
  CheckCircle2,
  Star,
  QrCode,
  BellRing,
  Sunrise,
  Sparkles,
} from 'lucide-react';

interface LandingPageProps {
  onLoginSuccess: (user: LoginResponse) => void;
  onSelectHospital: (slug: string) => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onLoginSuccess }) => {
  const [emailOrUsername, setEmailOrUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const usernameInputRef = useRef<HTMLInputElement | null>(null);

  // Animated visibility for stats
  const [statsVisible, setStatsVisible] = useState(false);
  const statsRef = useRef<HTMLDivElement | null>(null);

  // Logo dancing & smile animation
  const [logoDancing, setLogoDancing] = useState(false);
  const [smileDrawn, setSmileDrawn] = useState(false);

  useEffect(() => {
    // Exactly 1.5 seconds after entering the site, symbols dance and smile curve sweeps across
    const danceTimer = setTimeout(() => {
      setLogoDancing(true);
      const smileTimer = setTimeout(() => {
        setSmileDrawn(true);
      }, 750);
      return () => clearTimeout(smileTimer);
    }, 1500);

    return () => clearTimeout(danceTimer);
  }, []);

  const triggerLogoDance = () => {
    setLogoDancing(false);
    setSmileDrawn(false);
    setTimeout(() => {
      setLogoDancing(true);
      setTimeout(() => {
        setSmileDrawn(true);
      }, 750);
    }, 50);
  };

  const logoLetters = [
    { char: 'O', className: 'text-slate-900' },
    { char: 'P', className: 'text-slate-900' },
    { char: 'D', className: 'text-slate-900' },
    { char: '-', className: 'text-emerald-500 font-black px-0.5' },
    { char: 'J', className: 'text-emerald-600 font-extrabold' },
    { char: 'O', className: 'text-emerald-600 font-extrabold' },
    { char: 'B', className: 'text-emerald-600 font-extrabold' },
  ];

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setStatsVisible(true);
      },
      { threshold: 0.3 }
    );
    if (statsRef.current) observer.observe(statsRef.current);
    return () => observer.disconnect();
  }, []);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoginLoading(true);
      setLoginError(null);
      const res = await api.login(emailOrUsername.trim(), password);
      onLoginSuccess(res);
    } catch (err: unknown) {
      setLoginError(
        err instanceof Error
          ? err.message
          : 'Invalid credentials. Please verify your hospital staff email and password.'
      );
    } finally {
      setLoginLoading(false);
    }
  };

  const features = [
    {
      icon: LayoutGrid,
      title: 'Smart Queue Management',
      desc: 'Handle multiple OPD sessions & shifts effortlessly',
    },
    {
      icon: Clock,
      title: 'Real-time Updates',
      desc: 'Live token status, alerts & instant sync',
    },
    {
      icon: HeartPulse,
      title: 'Better Patient Care',
      desc: 'Reduce wait times & improve care delivery',
    },
    {
      icon: ShieldCheck,
      title: 'Secure & Compliant',
      desc: '256-bit SSL, encrypted data isolation',
    },
  ];

  const highlights = [
    {
      badge: 'Step 1 • Touchless Entry',
      badgeColor: 'bg-emerald-500/10 text-emerald-300 border-emerald-400/30',
      icon: QrCode,
      iconGradient: 'from-emerald-400 to-teal-500',
      title: 'Scan QR Check-In',
      desc: 'Patients scan the QR code at clinic reception to reserve their OPD token instantly without paper tickets or waiting in line.',
      pillText: 'Instant Token Assigned',
      pillSub: 'Zero App Download',
      pillType: 'qr',
    },
    {
      badge: 'Step 2 • Real-Time Queue',
      badgeColor: 'bg-cyan-500/10 text-cyan-300 border-cyan-400/30',
      icon: BellRing,
      iconGradient: 'from-teal-400 to-cyan-500',
      title: 'Live Mobile Tracking',
      desc: 'Real-time turn updates and token movement on phone screens keep clinic waiting rooms calm, quiet, and crowd-free.',
      pillText: 'Serving #18 • 2 Ahead',
      pillSub: 'Sub-Second Sync',
      pillType: 'live',
    },
    {
      badge: 'Step 3 • Consultation Chamber',
      badgeColor: 'bg-blue-500/10 text-blue-300 border-blue-400/30',
      icon: Stethoscope,
      iconGradient: 'from-cyan-400 to-blue-500',
      title: 'Doctor Desk Station',
      desc: 'Dedicated chamber interface for doctors to call, hold, or complete patient consultations seamlessly with 1-click controls.',
      pillText: 'Chamber 102 • Active Call',
      pillSub: 'Doctor Friendly',
      pillType: 'doctor',
    },
    {
      badge: 'Step 4 • OPD Orchestration',
      badgeColor: 'bg-amber-500/10 text-amber-300 border-amber-400/30',
      icon: Sunrise,
      iconGradient: 'from-amber-400 to-orange-500',
      title: 'Morning & Evening Shifts',
      desc: 'Independent morning & evening OPD sessions with automatic scheduling, dedicated queues, and full-day consultation history.',
      pillText: '☀️ Morning • 🌙 Evening',
      pillSub: 'Zero Conflict',
      pillType: 'shift',
    },
  ];

  return (
    <div className="min-h-screen bg-[#f8fafc] font-sans text-slate-800 selection:bg-emerald-100 selection:text-emerald-900 overflow-x-hidden">

      {/* ══════════════ HEADER ══════════════ */}
      <header className="fixed top-0 inset-x-0 z-50 bg-white/80 backdrop-blur-xl border-b border-slate-200/60 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex items-center justify-between">

          {/* Logo */}
          <div
            className="flex items-center space-x-3 cursor-pointer group"
            onClick={() => {
              window.scrollTo({ top: 0, behavior: 'smooth' });
              triggerLogoDance();
            }}
            onMouseEnter={triggerLogoDance}
            title="OPD-JOB • Click to play animation"
          >
            {/* Logo Mark Icon with Realistic Cardiac Heartbeat */}
            <div
              className={`w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-500 via-teal-500 to-emerald-600 flex items-center justify-center shadow-md shadow-emerald-500/20 transition-all duration-300 relative ${
                logoDancing ? 'animate-icon-dance shadow-emerald-500/35 ring-2 ring-emerald-400/40' : 'group-hover:scale-105'
              }`}
            >
              <svg viewBox="0 0 24 24" className="w-5 h-5 animate-heartbeat origin-center">
                <path
                  d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
                  fill="white"
                />
                <path d="M12 7.5v6M9 10.5h6" stroke="#059669" strokeWidth="2.2" strokeLinecap="round" fill="none" />
              </svg>
            </div>

            {/* Logo Text With Dancing Symbols & Drawn Smile Curve */}
            <div className="relative select-none py-1">
              <div className="flex items-baseline text-xl font-black tracking-tight">
                {logoLetters.map((l, idx) => (
                  <span
                    key={idx}
                    className={`inline-block transition-transform duration-200 ${l.className} ${
                      logoDancing ? 'animate-letter-dance' : ''
                    }`}
                    style={{
                      animationDelay: `${idx * 65}ms`,
                    }}
                  >
                    {l.char}
                  </span>
                ))}
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse ml-1 inline-block align-baseline" />
              </div>

              {/* Graceful Animated Smile Curve Underneath OPD-JOB */}
              <svg
                className="absolute -bottom-2 left-0 w-[105%] h-3 overflow-visible pointer-events-none"
                viewBox="0 0 100 14"
                fill="none"
              >
                <defs>
                  <linearGradient id="opdSmileGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#10b981" />
                    <stop offset="50%" stopColor="#06b6d4" />
                    <stop offset="100%" stopColor="#10b981" />
                  </linearGradient>
                </defs>
                <path
                  d="M 2 2.5 Q 50 14 96 3"
                  stroke="url(#opdSmileGrad)"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  className={`transition-all duration-700 ease-out ${
                    smileDrawn
                      ? 'opacity-100 [stroke-dashoffset:0]'
                      : 'opacity-0 [stroke-dashoffset:120]'
                  }`}
                  style={{
                    strokeDasharray: 120,
                    filter: 'drop-shadow(0 2px 4px rgba(16, 185, 129, 0.45))',
                  }}
                />
                {/* Left dimple dot */}
                <circle
                  cx="2"
                  cy="2.5"
                  r="1.8"
                  fill="#10b981"
                  className={`transition-all duration-300 ease-out ${
                    smileDrawn ? 'opacity-100 scale-100' : 'opacity-0 scale-0'
                  }`}
                />
                {/* Right dimple dot */}
                <circle
                  cx="96"
                  cy="3"
                  r="2"
                  fill="#06b6d4"
                  className={`transition-all duration-300 delay-150 ease-out ${
                    smileDrawn ? 'opacity-100 scale-100' : 'opacity-0 scale-0'
                  }`}
                />
              </svg>
            </div>
          </div>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center space-x-1 text-sm font-semibold text-slate-600 bg-slate-100/70 p-1 rounded-2xl border border-slate-200/60 backdrop-blur-sm">
            <a href="#highlights" className="px-3.5 py-1.5 rounded-xl hover:text-slate-900 hover:bg-white transition-all duration-200">How It Works</a>
            <a href="#features" className="px-3.5 py-1.5 rounded-xl hover:text-slate-900 hover:bg-white transition-all duration-200">Features</a>
            <a href="#security" className="px-3.5 py-1.5 rounded-xl hover:text-slate-900 hover:bg-white transition-all duration-200">Security</a>
          </nav>

          {/* CTA */}
          <button
            type="button"
            onClick={() => {
              window.scrollTo({ top: 0, behavior: 'smooth' });
              setTimeout(() => usernameInputRef.current?.focus(), 100);
            }}
            className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs px-4 sm:px-5 py-2.5 rounded-xl shadow-sm transition-all duration-200 flex items-center space-x-2 cursor-pointer active:scale-95"
          >
            <Stethoscope className="w-3.5 h-3.5 text-emerald-400" />
            <span>Staff Portal</span>
            <ArrowRight className="w-3.5 h-3.5 text-slate-400 hidden sm:inline" />
          </button>
        </div>
      </header>

      {/* ══════════════ HERO ══════════════ */}
      <section className="min-h-screen flex items-center pt-24 sm:pt-28 pb-16 relative overflow-hidden">

        {/* Ambient background lighting */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {/* Soft radiant top radial glow */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[500px] bg-gradient-to-b from-emerald-100/60 via-teal-50/20 to-transparent blur-3xl opacity-80" />
          <div className="absolute bottom-10 -right-40 w-[500px] h-[500px] bg-gradient-to-tl from-cyan-100/40 via-emerald-50/20 to-transparent blur-3xl opacity-60" />
          {/* Subtle modern dot grid */}
          <div
            className="absolute inset-0 opacity-[0.3]"
            style={{
              backgroundImage: 'radial-gradient(circle, #cbd5e1 1px, transparent 1px)',
              backgroundSize: '28px 28px',
            }}
          />
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-14 items-center">

            {/* ── Left: Text (7 cols on lg) ── */}
            <div className="lg:col-span-7 space-y-7 lg:space-y-8">

              {/* Eyebrow badge */}
              <div className="inline-flex items-center space-x-2 bg-white/90 border border-slate-200/80 px-3.5 py-1.5 rounded-full text-xs font-semibold text-slate-700 shadow-xs backdrop-blur-md">
                <span className="flex h-2 w-2 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span className="text-emerald-700 font-bold">Smart Healthcare Platform</span>
                <span className="text-slate-300">•</span>
                <span className="text-slate-500 hidden sm:inline">Zero Waiting Crowds</span>
              </div>

              {/* Headline */}
              <div className="space-y-3">
                <h1 className="text-4xl sm:text-5xl lg:text-[3.6rem] font-black text-slate-900 tracking-tight leading-[1.08]">
                  Intelligent OPD &amp; Queue Flow for{' '}
                  <span className="bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 bg-clip-text text-transparent">
                    Modern Hospitals
                  </span>
                </h1>
                <p className="text-slate-500 text-base sm:text-lg leading-relaxed max-w-xl font-normal">
                  Empower reception desks, streamline doctor consultation chambers, and provide patients with real-time live turn tracking on their phones.
                </p>
              </div>

              {/* Feature Micro-Cards Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-2 gap-3 pt-1">
                <div className="flex items-center space-x-3 bg-white/90 border border-slate-200/80 p-3 rounded-2xl shadow-xs backdrop-blur-xs">
                  <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0">
                    <Zap className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-extrabold text-slate-800">Sub-Second Sync</div>
                    <div className="text-[11px] text-slate-400">SSE Live Stream</div>
                  </div>
                </div>

                <div className="flex items-center space-x-3 bg-white/90 border border-slate-200/80 p-3 rounded-2xl shadow-xs backdrop-blur-xs">
                  <div className="w-9 h-9 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center flex-shrink-0">
                    <QrCode className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-extrabold text-slate-800">Touchless QR Tokens</div>
                    <div className="text-[11px] text-slate-400">Zero App Download</div>
                  </div>
                </div>

                <div className="flex items-center space-x-3 bg-white/90 border border-slate-200/80 p-3 rounded-2xl shadow-xs backdrop-blur-xs">
                  <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
                    <Stethoscope className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-extrabold text-slate-800">Doctor Chamber Mode</div>
                    <div className="text-[11px] text-slate-400">1-Click Patient Calling</div>
                  </div>
                </div>

                <div className="flex items-center space-x-3 bg-white/90 border border-slate-200/80 p-3 rounded-2xl shadow-xs backdrop-blur-xs">
                  <div className="w-9 h-9 rounded-xl bg-cyan-50 text-cyan-600 flex items-center justify-center flex-shrink-0">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-extrabold text-slate-800">Tenant Isolation</div>
                    <div className="text-[11px] text-slate-400">256-bit Encrypted</div>
                  </div>
                </div>
              </div>

              {/* Live indicator */}
              <div className="flex items-center space-x-2 text-xs sm:text-sm text-slate-500 font-medium pt-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>Live real-time sync across reception, doctor chamber &amp; patient mobile</span>
              </div>
            </div>

            {/* ── Right: Login Card (5 cols on lg) ── */}
            <div className="lg:col-span-5 flex justify-center lg:justify-end">
              <div className="w-full max-w-[430px]">

                {/* Card */}
                <div className="relative bg-white rounded-3xl shadow-2xl shadow-slate-300/40 border border-slate-200/80 overflow-hidden">

                  {/* Top gradient accent line */}
                  <div className="h-1.5 w-full bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-400" />

                  <div className="p-7 sm:p-8">

                    {/* Card header */}
                    <div className="text-center mb-7">
                      <div className="w-12 h-12 mx-auto mb-3.5 bg-emerald-50 border border-emerald-200/60 rounded-2xl flex items-center justify-center shadow-xs text-emerald-600">
                        <Lock className="w-6 h-6" />
                      </div>
                      <h2 className="text-2xl font-black text-slate-900 tracking-tight">Hospital Staff Portal</h2>
                      <p className="text-xs text-slate-400 mt-1">
                        Secure access for doctors, receptionists &amp; administrators
                      </p>
                    </div>

                    {/* Error */}
                    {loginError && (
                      <div className="mb-5 p-3.5 bg-red-50 border border-red-200 rounded-2xl flex items-start space-x-2.5">
                        <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                        <p className="text-xs text-red-600 leading-relaxed">{loginError}</p>
                      </div>
                    )}

                    {/* Form */}
                    <form onSubmit={handleLoginSubmit} className="space-y-4">

                      {/* Username / Email */}
                      <div className="space-y-1.5">
                        <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                          Staff ID / Email
                        </label>
                        <div
                          className={`relative rounded-2xl border transition-all duration-200 ${
                            focusedField === 'email'
                              ? 'border-emerald-500 ring-4 ring-emerald-500/10 bg-white'
                              : 'border-slate-200 bg-slate-50/60 hover:border-slate-300'
                          }`}
                        >
                          <Users
                            className={`absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 transition-colors duration-200 ${
                              focusedField === 'email' ? 'text-emerald-600' : 'text-slate-400'
                            }`}
                          />
                          <input
                            ref={usernameInputRef}
                            type="text"
                            required
                            value={emailOrUsername}
                            onChange={(e) => setEmailOrUsername(e.target.value)}
                            onFocus={() => setFocusedField('email')}
                            onBlur={() => setFocusedField(null)}
                            placeholder="admin@hospital.com or staff ID"
                            className="w-full pl-10 pr-4 py-3 bg-transparent rounded-2xl text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:outline-none font-medium"
                          />
                        </div>
                      </div>

                      {/* Password */}
                      <div className="space-y-1.5">
                        <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                          Password
                        </label>
                        <div
                          className={`relative rounded-2xl border transition-all duration-200 ${
                            focusedField === 'password'
                              ? 'border-emerald-500 ring-4 ring-emerald-500/10 bg-white'
                              : 'border-slate-200 bg-slate-50/60 hover:border-slate-300'
                          }`}
                        >
                          <Lock
                            className={`absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 transition-colors duration-200 ${
                              focusedField === 'password' ? 'text-emerald-600' : 'text-slate-400'
                            }`}
                          />
                          <input
                            type={showPassword ? 'text' : 'password'}
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            onFocus={() => setFocusedField('password')}
                            onBlur={() => setFocusedField(null)}
                            placeholder="••••••••••••"
                            className="w-full pl-10 pr-11 py-3 bg-transparent rounded-2xl text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:outline-none font-medium"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition cursor-pointer p-1"
                          >
                            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>

                      {/* Submit */}
                      <button
                        type="submit"
                        disabled={loginLoading}
                        className="w-full mt-2 bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 hover:from-emerald-700 hover:to-teal-700 disabled:from-slate-300 disabled:to-slate-300 text-white font-extrabold py-3.5 rounded-2xl shadow-md shadow-emerald-500/20 hover:shadow-lg hover:shadow-emerald-500/30 transition-all duration-200 cursor-pointer active:scale-[0.98] flex items-center justify-center space-x-2 text-sm disabled:cursor-not-allowed disabled:shadow-none"
                      >
                        {loginLoading ? (
                          <>
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            <span>Signing in...</span>
                          </>
                        ) : (
                          <>
                            <span>Sign In to Dashboard</span>
                            <ArrowRight className="w-4 h-4" />
                          </>
                        )}
                      </button>
                    </form>

                    {/* Security footer inside card */}
                    <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                      <div className="flex items-center space-x-1.5">
                        <Activity className="w-3.5 h-3.5 text-emerald-500" />
                        <span>256-bit SSL Encrypted</span>
                      </div>
                      <span className="font-semibold text-slate-500">HIPAA Compliant</span>
                    </div>
                  </div>
                </div>

                {/* Below-card note */}
                <p className="text-center text-[11px] text-slate-400 mt-3.5 flex items-center justify-center space-x-1.5">
                  <Lock className="w-3 h-3 text-slate-400" />
                  <span>Authorized hospital staff &amp; administrators only</span>
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════ PRODUCT HIGHLIGHTS (Replaces generic stats) ══════════════ */}
      <section id="highlights" ref={statsRef} className="py-20 sm:py-24 bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 relative overflow-hidden border-y border-emerald-900/30">
        {/* Subtle mesh glows */}
        <div className="absolute -top-32 left-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-32 right-1/4 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Ambient dot pattern */}
        <div
          className="absolute inset-0 opacity-[0.12] pointer-events-none"
          style={{
            backgroundImage: 'radial-gradient(circle, #10b981 1px, transparent 1px)',
            backgroundSize: '24px 24px',
          }}
        />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          {/* Section Header */}
          <div className="text-center max-w-2xl mx-auto mb-14">
            <div className="inline-flex items-center space-x-2 bg-emerald-500/10 border border-emerald-500/20 px-3.5 py-1 rounded-full text-xs font-bold text-emerald-300 mb-3">
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
              <span>The Smart OPD Experience</span>
            </div>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black text-white tracking-tight">
              Designed to Transform Clinic Flow
            </h2>
            <p className="mt-2 text-slate-400 text-xs sm:text-sm">
              Replace overcrowded waiting halls with a streamlined, digital token experience for patients, doctors &amp; reception.
            </p>
          </div>

          {/* Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {highlights.map((item, i) => {
              const Icon = item.icon;
              return (
                <div
                  key={i}
                  className={`group relative bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 hover:border-emerald-400/40 rounded-3xl p-6 sm:p-7 backdrop-blur-md transition-all duration-500 flex flex-col justify-between hover:-translate-y-1.5 hover:shadow-2xl hover:shadow-emerald-950/50 ${
                    statsVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
                  }`}
                  style={{ transitionDelay: `${i * 120}ms` }}
                >
                  {/* Top accent glow line */}
                  <div className="absolute top-0 inset-x-8 h-px bg-gradient-to-r from-transparent via-emerald-400/30 to-transparent group-hover:via-emerald-400/70 transition-all duration-300" />

                  <div>
                    {/* Badge */}
                    <div className="flex items-center justify-between mb-4">
                      <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${item.badgeColor}`}>
                        {item.badge}
                      </span>
                      <span className="text-[10px] font-mono font-semibold text-slate-500">
                        0{i + 1}
                      </span>
                    </div>

                    {/* Icon Bubble */}
                    <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${item.iconGradient} flex items-center justify-center text-white shadow-lg shadow-emerald-950/40 mb-4 group-hover:scale-105 transition-transform duration-300`}>
                      <Icon className="w-6 h-6" />
                    </div>

                    {/* Title & Desc */}
                    <h3 className="text-lg font-black text-white tracking-tight mb-2 group-hover:text-emerald-300 transition-colors">
                      {item.title}
                    </h3>
                    <p className="text-slate-400 text-xs sm:text-sm leading-relaxed mb-6">
                      {item.desc}
                    </p>
                  </div>

                  {/* Visual Pill / Mock UI element */}
                  <div className="pt-4 border-t border-white/5 mt-auto">
                    <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-black/30 border border-white/10 text-xs">
                      <div className="flex items-center space-x-2 truncate">
                        {item.pillType === 'live' && (
                          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse flex-shrink-0" />
                        )}
                        <span className="font-semibold text-slate-200 text-[11px] truncate">{item.pillText}</span>
                      </div>
                      <span className="text-[10px] font-mono text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded border border-emerald-400/20 flex-shrink-0 ml-1">
                        {item.pillSub}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ══════════════ FEATURES ══════════════ */}
      <section id="features" className="py-20 sm:py-28 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

          {/* Section header */}
          <div className="text-center mb-14">
            <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3.5 py-1.5 rounded-full uppercase tracking-wider">
              Platform Features
            </span>
            <h2 className="mt-4 text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
              Everything your hospital needs
            </h2>
            <p className="mt-3 text-slate-500 max-w-xl mx-auto text-base leading-relaxed">
              Built specifically for hospital administrators, doctors, and reception staff to streamline OPD operations.
            </p>
          </div>

          {/* Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((f, i) => {
              const Icon = f.icon;
              return (
                <div
                  key={i}
                  className="group relative bg-white rounded-2xl border border-slate-100 p-7 shadow-sm hover:shadow-2xl hover:shadow-emerald-100/60 hover:-translate-y-2 transition-all duration-300 overflow-hidden cursor-default"
                >
                  {/* Hover glow fill */}
                  <div className="absolute inset-0 bg-gradient-to-br from-emerald-50/80 to-teal-50/60 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-2xl" />

                  <div className="relative z-10 space-y-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-emerald-100 to-teal-100 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                      <Icon className="w-6 h-6 text-emerald-700" />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900 text-base mb-1.5">{f.title}</h3>
                      <p className="text-slate-500 text-sm leading-relaxed">{f.desc}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ══════════════ SECURITY ══════════════ */}
      <section id="security" className="py-20 bg-slate-950 relative overflow-hidden">
        {/* Ambient glows */}
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-14 items-center">

            {/* Left text */}
            <div className="space-y-6">
              <span className="text-[11px] font-bold text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 px-3.5 py-1.5 rounded-full uppercase tracking-wider">
                Enterprise Security
              </span>
              <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight leading-tight">
                Hospital data stays <br />
                <span className="text-emerald-400">safe &amp; private</span>
              </h2>
              <p className="text-slate-400 text-base leading-relaxed">
                We take hospital data security seriously. Every tenant is fully isolated, all communications are encrypted, and we comply with healthcare data regulations.
              </p>
              <div className="space-y-3.5">
                {[
                  'Multi-tenant data isolation per hospital',
                  'AES-256 encryption at rest & in transit',
                  'JWT-based role access controls',
                  'Audit logs for every admin action',
                ].map((item) => (
                  <div key={item} className="flex items-center space-x-3 text-slate-300 text-sm">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Right: System monitor card */}
            <div>
              <div className="bg-slate-900/80 border border-slate-700/50 rounded-3xl p-8 backdrop-blur-sm">
                <div className="flex items-center space-x-3 mb-6">
                  <div className="w-10 h-10 bg-emerald-500/20 border border-emerald-500/30 rounded-xl flex items-center justify-center">
                    <Activity className="w-5 h-5 text-emerald-400" />
                  </div>
                  <div>
                    <div className="text-white font-bold text-sm">System Monitor</div>
                    <div className="text-slate-400 text-xs">All systems operational</div>
                  </div>
                  <div className="ml-auto flex items-center space-x-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-xs text-emerald-400 font-medium">Live</span>
                  </div>
                </div>

                {/* ECG line */}
                <div className="mb-6 overflow-hidden rounded-xl bg-slate-800/60 p-4">
                  <svg className="w-full h-14 text-emerald-500" viewBox="0 0 300 60" fill="none">
                    <path
                      d="M0 30 H60 L70 10 L80 50 L90 5 L100 55 L110 30 H150 L160 10 L170 50 L180 5 L190 55 L200 30 H300"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M0 30 H60 L70 10 L80 50 L90 5 L100 55 L110 30 H150 L160 10 L170 50 L180 5 L190 55 L200 30 H300"
                      stroke="currentColor"
                      strokeWidth="6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="opacity-15"
                    />
                  </svg>
                </div>

                {/* Status rows */}
                {[
                  { label: 'API Response Time', value: '< 50ms' },
                  { label: 'Database Connection', value: 'Healthy' },
                  { label: 'Data Encryption', value: 'AES-256' },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="flex items-center justify-between py-3 border-b border-slate-800/60 last:border-0"
                  >
                    <span className="text-slate-400 text-xs">{item.label}</span>
                    <span className="text-xs font-semibold text-emerald-400">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════ TRUST STRIP ══════════════ */}
      <section className="py-10 bg-gradient-to-r from-slate-50 to-white border-t border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="flex items-center space-x-4">
              <div className="w-11 h-11 bg-emerald-100 rounded-xl flex items-center justify-center">
                <Building2 className="w-6 h-6 text-emerald-700" />
              </div>
              <div>
                <div className="font-black text-slate-900 text-base">Trusted by hospitals across India</div>
                <div className="text-slate-400 text-xs mt-0.5">Built for clinics & multi-specialty hospitals</div>
              </div>
            </div>

            <div className="flex items-center space-x-8">
              {[
                { Icon: Star, val: '4.8/5', sub: 'User Rating' },
                { Icon: Zap, val: '99.9%', sub: 'Uptime' },
                { Icon: ShieldCheck, val: 'Secure', sub: 'Encrypted' },
              ].map(({ Icon, val, sub }, i) => (
                <div key={i} className="text-center">
                  <div className="flex items-center justify-center space-x-1 mb-0.5">
                    <Icon className="w-4 h-4 text-emerald-500" />
                    <span className="font-black text-slate-900 text-sm">{val}</span>
                  </div>
                  <div className="text-slate-400 text-xs">{sub}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════ FOOTER ══════════════ */}
      <footer className="bg-slate-950 py-8 border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center space-x-2.5">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
              <svg viewBox="0 0 24 24" className="w-4 h-4">
                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" fill="white" />
              </svg>
            </div>
            <span className="font-black text-white tracking-tight">OPD-JOB</span>
          </div>
          <p className="text-slate-500 text-xs text-center leading-relaxed">
            Hospital Administration Portal — Restricted access for authorized personnel only.
          </p>
          <p className="text-slate-600 text-xs">© 2026 OPD-JOB. All rights reserved.</p>
        </div>
      </footer>

      {/* ══════════════ MOBILE STICKY CTA ══════════════ */}
      <div className="sm:hidden fixed bottom-4 inset-x-4 z-50">
        <button
          type="button"
          onClick={() => {
            window.scrollTo({ top: 0, behavior: 'smooth' });
            setTimeout(() => usernameInputRef.current?.focus(), 600);
          }}
          className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-bold py-4 rounded-2xl shadow-2xl shadow-emerald-900/50 flex items-center justify-center space-x-2.5 text-sm cursor-pointer active:scale-[0.98] transition-all"
        >
          <Stethoscope className="w-4 h-4" />
          <span>Hospital Staff — Sign In</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

    </div>
  );
};
