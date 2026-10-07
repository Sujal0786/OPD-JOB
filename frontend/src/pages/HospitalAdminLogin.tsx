import React, { useState } from 'react';
import { api } from '../services/api';
import { LoginResponse } from '../types';
import { 
  Building2, 
  Lock, 
  Mail, 
  ShieldAlert, 
  ShieldCheck, 
  ArrowLeft, 
  Eye, 
  EyeOff, 
  CheckCircle2,
  Stethoscope,
  Activity,
  ArrowRight
} from 'lucide-react';
import { LanguageToggle } from '../components/LanguageToggle';

interface HospitalAdminLoginProps {
  onSuccess: (user: LoginResponse) => void;
  onBackToHome: () => void;
}

export const HospitalAdminLogin: React.FC<HospitalAdminLoginProps> = ({ onSuccess, onBackToHome }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError(null);
      const res = await api.login(email.trim(), password);
      onSuccess(res);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Invalid credentials. Please verify your hospital staff email and password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-emerald-50/20 to-slate-100 flex flex-col justify-between font-sans text-slate-800">
      {/* Top Navbar matching the rest of the application */}
      <header className="bg-gradient-to-r from-emerald-800 via-teal-800 to-emerald-900 text-white shadow-md sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-2.5 sm:py-3 flex items-center justify-between gap-2">
          <div className="flex items-center space-x-2.5 sm:space-x-3 min-w-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-white/15 border border-white/20 text-white flex items-center justify-center shadow-xs flex-shrink-0">
              <Building2 className="w-5 h-5 text-emerald-200" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center space-x-1.5">
                <span className="font-black text-sm sm:text-base md:text-lg text-white tracking-tight truncate block leading-tight">
                  Hospital Admin
                </span>
                <span className="bg-emerald-500/30 text-emerald-100 text-[10px] font-bold px-1.5 py-0.5 rounded border border-emerald-400/30 uppercase tracking-wider flex-shrink-0">
                  STAFF
                </span>
              </div>
              <span className="text-[11px] text-emerald-200/90 font-medium block truncate leading-tight hidden xs:block">
                OPD Token & Queue Desk Control
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-2 flex-shrink-0">
            <LanguageToggle />

            <button
              type="button"
              onClick={onBackToHome}
              className="text-xs font-bold text-white bg-white/10 hover:bg-white/20 border border-white/20 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl transition flex items-center space-x-1.5 cursor-pointer shadow-xs flex-shrink-0 active:scale-95"
            >
              <ArrowLeft className="w-3.5 h-3.5 text-emerald-200" />
              <span className="hidden xs:inline">Citizen Portal</span>
              <span className="xs:hidden">Citizen</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Login Center Area */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6 lg:p-8">
        <div className="max-w-md w-full">
          <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-lg border border-slate-200 space-y-6">
            {/* Header Title with consistent emerald badge icon */}
            <div className="text-center space-y-2">
              <div className="w-14 h-14 bg-emerald-100 text-emerald-700 rounded-2xl flex items-center justify-center mx-auto shadow-xs border border-emerald-200">
                <ShieldCheck className="w-7 h-7" />
              </div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                Hospital Staff Login
              </h1>
              <p className="text-xs text-slate-500 leading-relaxed">
                Secure access for Hospital Administrators, Receptionists, Doctors & Nurses
              </p>
            </div>

            {/* Error Notification */}
            {error && (
              <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl text-xs flex items-start space-x-2.5">
                <ShieldAlert className="w-4 h-4 flex-shrink-0 text-rose-600 mt-0.5" />
                <span className="leading-relaxed">{error}</span>
              </div>
            )}

            {/* Login Form with matching light input fields */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Official Staff Email *
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                  <input
                    type="email"
                    required
                    placeholder="doctor@hospital.com or admin@hospital.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:border-emerald-600 outline-none transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Password *
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-10 pr-10 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:border-emerald-600 outline-none transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-3.5 text-slate-400 hover:text-slate-700 transition cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white font-bold py-3.5 rounded-xl shadow-md transition text-sm flex items-center justify-center space-x-2 cursor-pointer active:scale-[0.99]"
              >
                {loading ? (
                  <span>Authenticating...</span>
                ) : (
                  <>
                    <span>Sign In to Hospital Dashboard</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            {/* Security Notice */}
            <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
              <span className="flex items-center space-x-1.5">
                <Activity className="w-3.5 h-3.5 text-emerald-600" />
                <span>Encrypted Tenant Isolation</span>
              </span>
              <span className="text-emerald-700 font-bold">256-bit SSL</span>
            </div>

            {/* Quick Demo Helper for System Testing */}
            <details className="text-xs text-slate-500 bg-slate-50 rounded-2xl border border-slate-200 p-3.5">
              <summary className="font-bold text-slate-700 cursor-pointer select-none flex items-center justify-between">
                <span>🔑 Credentials Quick Fill (Testing)</span>
                <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-black border border-emerald-200">TEST</span>
              </summary>
              <div className="mt-3 pt-2.5 border-t border-slate-200 space-y-2 text-[11px]">
                <div className="flex items-center justify-between bg-white p-2.5 rounded-xl border border-slate-200">
                  <div>
                    <p className="font-bold text-slate-900">Platform Super Admin</p>
                    <p className="font-mono text-slate-500">superadmin@citycare.com</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setEmail('superadmin@citycare.com');
                      setPassword('Admin@1234');
                    }}
                    className="bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold px-2.5 py-1 rounded-lg border border-emerald-200 transition cursor-pointer"
                  >
                    Autofill
                  </button>
                </div>
              </div>
            </details>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 py-4 text-center text-xs text-slate-500 bg-white">
        <p>Hospital Administration Portal • Restricted Access for Authorized Personnel Only</p>
      </footer>
    </div>
  );
};
