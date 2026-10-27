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

  const stats = [
    { value: '10+', label: 'Hospitals Live' },
    { value: '5K+', label: 'Tokens Managed' },
    { value: '99.9%', label: 'Uptime Guaranteed' },
    { value: '24/7', label: 'Support Available' },
  ];

  return (
    <div className="min-h-screen bg-[#f8fafc] font-sans text-slate-800 selection:bg-emerald-100 selection:text-emerald-900 overflow-x-hidden">

      {/* ══════════════ HEADER ══════════════ */}
      <header className="fixed top-0 inset-x-0 z-50 bg-white/80 backdrop-blur-xl border-b border-slate-100/80 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex items-center justify-between">

          {/* Logo */}
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-md shadow-emerald-200">
              <svg viewBox="0 0 24 24" className="w-5 h-5">
                <path
                  d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
                  fill="white"
                />
                <path d="M12 7.5v6M9 10.5h6" stroke="#10b981" strokeWidth="2" strokeLinecap="round" fill="none" />
              </svg>
            </div>
            <div className="flex items-center space-x-2">
              <span className="font-black text-lg text-slate-900 tracking-tight">OPD-JOB</span>
              <span className="hidden sm:inline text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                Smart OPD Token System
              </span>
            </div>
          </div>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center space-x-8 text-sm font-medium text-slate-500">
            <a href="#features" className="hover:text-emerald-700 transition-colors">Features</a>
            <a href="#stats" className="hover:text-emerald-700 transition-colors">Statistics</a>
            <a href="#security" className="hover:text-emerald-700 transition-colors">Security</a>
          </nav>

          {/* CTA */}
          <button
            type="button"
            onClick={() => {
              window.scrollTo({ top: 0, behavior: 'smooth' });
              setTimeout(() => usernameInputRef.current?.focus(), 100);
            }}
            className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold text-sm px-5 py-2.5 rounded-xl shadow-md shadow-emerald-200/60 transition-all duration-200 flex items-center space-x-2 cursor-pointer active:scale-95"
          >
            <Stethoscope className="w-4 h-4" />
            <span>Staff Login</span>
          </button>
        </div>
      </header>

      {/* ══════════════ HERO ══════════════ */}
      <section className="min-h-screen flex items-center pt-20 pb-12 relative overflow-hidden">

        {/* Background blobs */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute -top-40 -right-40 w-[700px] h-[700px] rounded-full bg-gradient-to-bl from-emerald-100/70 via-teal-50/40 to-transparent blur-3xl" />
          <div className="absolute -bottom-40 -left-40 w-[600px] h-[600px] rounded-full bg-gradient-to-tr from-cyan-100/50 via-emerald-50/30 to-transparent blur-3xl" />
          {/* Dot grid */}
          <div
            className="absolute inset-0 opacity-[0.4]"
            style={{
              backgroundImage: 'radial-gradient(circle, #d1fae5 1px, transparent 1px)',
              backgroundSize: '32px 32px',
            }}
          />
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">

            {/* ── Left: Text ── */}
            <div className="space-y-7 lg:space-y-9">

              {/* Eyebrow badge */}
              <div className="inline-flex items-center space-x-2 bg-white border border-emerald-200 text-emerald-700 px-4 py-1.5 rounded-full text-xs font-bold shadow-sm shadow-emerald-100/60">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>For Hospital Administrators & Medical Staff</span>
              </div>

              {/* Headline */}
              <div className="space-y-2">
                <h1 className="text-4xl sm:text-5xl lg:text-[3.6rem] font-black text-slate-900 tracking-tight leading-[1.06]">
                  Manage OPD
                </h1>
                <h1 className="text-4xl sm:text-5xl lg:text-[3.6rem] font-black tracking-tight leading-[1.06] bg-gradient-to-r from-emerald-600 via-teal-500 to-cyan-500 bg-clip-text text-transparent">
                  Sessions with Ease
                </h1>
              </div>

              {/* Sub-text */}
              <p className="text-slate-500 text-base sm:text-lg leading-relaxed max-w-lg">
                The all-in-one platform for hospitals to manage OPD queues, assign tokens, track sessions and deliver better patient experiences — in real time.
              </p>

              {/* Tags */}
              <div className="flex flex-wrap gap-2.5">
                {['HIPAA Compliant', '256-bit SSL', 'Real-time Sync', 'Multi-tenant'].map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center space-x-1.5 text-xs font-semibold text-slate-600 bg-white border border-slate-200 px-3.5 py-1.5 rounded-lg shadow-xs"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                    <span>{tag}</span>
                  </span>
                ))}
              </div>

              {/* Live indicator */}
              <div className="flex items-center space-x-2 text-sm text-slate-400 font-medium">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>Live real-time sync across reception, doctor room & patient mobile</span>
              </div>
            </div>

            {/* ── Right: Login Card ── */}
            <div className="flex justify-center lg:justify-end">
              <div className="w-full max-w-[420px]">

                {/* Card */}
                <div className="relative bg-white rounded-3xl shadow-2xl shadow-slate-300/40 border border-slate-100 overflow-hidden">

                  {/* Top gradient accent bar */}
                  <div className="h-1.5 w-full bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-400" />

                  <div className="px-8 pt-8 pb-9">

                    {/* Card header */}
                    <div className="text-center mb-8">
                      <div className="w-16 h-16 mx-auto mb-5 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-200">
                        <ShieldCheck className="w-8 h-8 text-white" />
                      </div>
                      <h2 className="text-2xl font-black text-slate-900 tracking-tight">Hospital Staff Login</h2>
                      <p className="text-sm text-slate-400 mt-1.5 leading-relaxed">
                        Secure access for authorized hospital personnel
                      </p>
                    </div>

                    {/* Error */}
                    {loginError && (
                      <div className="mb-5 p-4 bg-red-50 border border-red-100 rounded-2xl flex items-start space-x-3">
                        <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                        <p className="text-xs text-red-600 leading-relaxed">{loginError}</p>
                      </div>
                    )}

                    {/* Form */}
                    <form onSubmit={handleLoginSubmit} className="space-y-4">

                      {/* Username / Email */}
                      <div className="space-y-1.5">
                        <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-widest">
                          Staff ID / Email
                        </label>
                        <div
                          className={`relative rounded-2xl border-2 transition-all duration-200 ${
                            focusedField === 'email'
                              ? 'border-emerald-500 shadow-lg shadow-emerald-100/60 bg-white'
                              : 'border-slate-200 bg-slate-50/70 hover:border-slate-300'
                          }`}
                        >
                          <Users
                            className={`absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 transition-colors duration-200 ${
                              focusedField === 'email' ? 'text-emerald-500' : 'text-slate-400'
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
                            placeholder="admin@hospital.com or username"
                            className="w-full pl-11 pr-4 py-3.5 bg-transparent rounded-2xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none"
                          />
                        </div>
                      </div>

                      {/* Password */}
                      <div className="space-y-1.5">
                        <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-widest">
                          Password
                        </label>
                        <div
                          className={`relative rounded-2xl border-2 transition-all duration-200 ${
                            focusedField === 'password'
                              ? 'border-emerald-500 shadow-lg shadow-emerald-100/60 bg-white'
                              : 'border-slate-200 bg-slate-50/70 hover:border-slate-300'
                          }`}
                        >
                          <Lock
                            className={`absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 transition-colors duration-200 ${
                              focusedField === 'password' ? 'text-emerald-500' : 'text-slate-400'
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
                            className="w-full pl-11 pr-12 py-3.5 bg-transparent rounded-2xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition cursor-pointer p-1"
                          >
                            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>

                      {/* Submit */}
                      <button
                        type="submit"
                        disabled={loginLoading}
                        className="w-full mt-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 disabled:from-slate-300 disabled:to-slate-300 text-white font-bold py-4 rounded-2xl shadow-lg shadow-emerald-200 hover:shadow-xl hover:shadow-emerald-200/60 transition-all duration-200 cursor-pointer active:scale-[0.98] flex items-center justify-center space-x-2 text-sm disabled:cursor-not-allowed disabled:shadow-none"
                      >
                        {loginLoading ? (
                          <>
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            <span>Authenticating...</span>
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
                    <div className="mt-6 pt-5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                      <div className="flex items-center space-x-1.5">
                        <Activity className="w-3.5 h-3.5 text-emerald-500" />
                        <span>End-to-end encrypted</span>
                      </div>
                      <span className="font-bold text-emerald-600">256-bit SSL</span>
                    </div>
                  </div>
                </div>

                {/* Below-card note */}
                <p className="text-center text-xs text-slate-400 mt-4 flex items-center justify-center space-x-1.5">
                  <Lock className="w-3 h-3" />
                  <span>Restricted to authorized hospital administrators &amp; staff only</span>
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════ STATS ══════════════ */}
      <section id="stats" ref={statsRef} className="py-16 bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 relative overflow-hidden">
        {/* subtle pattern overlay */}
        <div
          className="absolute inset-0 opacity-10 pointer-events-none"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M0 40L40 0H20L0 20M40 40V20L20 40'/%3E%3C/g%3E%3C/svg%3E\")",
          }}
        />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
            {stats.map((stat, i) => (
              <div
                key={i}
                className={`text-center transition-all duration-700 ${
                  statsVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
                }`}
                style={{ transitionDelay: `${i * 100}ms` }}
              >
                <div className="text-3xl sm:text-4xl font-black text-white tracking-tight">{stat.value}</div>
                <div className="text-emerald-100 text-sm font-medium mt-1">{stat.label}</div>
              </div>
            ))}
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
