import React, { useState } from 'react';
import { api } from '../services/api';
import { LoginResponse } from '../types';
import { Building2, Lock, Mail, ShieldAlert } from 'lucide-react';

interface StaffLoginProps {
  onSuccess: (user: LoginResponse) => void;
  onCancel: () => void;
}

export const StaffLogin: React.FC<StaffLoginProps> = ({ onSuccess, onCancel }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const fillDemo = (roleEmail: string) => {
    setEmail(roleEmail);
    setPassword('Staff@1234');
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl border border-slate-100 space-y-6">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 bg-emerald-100 text-emerald-700 rounded-2xl flex items-center justify-center mx-auto">
            <Building2 className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-black text-slate-900">Hospital Staff Portal</h2>
          <p className="text-xs text-slate-500">Authorized Reception, Nurse & Doctor access only</p>
        </div>

        {error && (
          <div className="p-3.5 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs flex items-center space-x-2">
            <ShieldAlert className="w-4 h-4 flex-shrink-0 text-red-500" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Staff Email</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
              <input
                type="email"
                required
                placeholder="admin@yourhospital.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:border-emerald-600 outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Password</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
              <input
                type="password"
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:border-emerald-600 outline-none"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white font-bold py-3 rounded-xl shadow-md transition text-sm"
          >
            {loading ? 'Authenticating...' : 'Sign In to Dashboard'}
          </button>
        </form>

        {/* Platform Administrator Credentials Reference */}
        <details className="text-xs text-slate-500 bg-slate-50 rounded-2xl border border-slate-200 p-3.5">
          <summary className="font-bold text-slate-700 cursor-pointer select-none flex items-center justify-between">
            <span>🔐 Platform Super Admin Credentials</span>
            <span className="text-[10px] bg-purple-100 text-purple-800 px-2 py-0.5 rounded font-black">MASTER</span>
          </summary>
          <div className="mt-3 pt-2.5 border-t border-slate-200/80 space-y-2 text-[11px]">
            <div className="flex items-center justify-between bg-white p-2.5 rounded-xl border border-slate-200">
              <div>
                <p className="font-bold text-slate-800">Master Super Admin</p>
                <p className="font-mono text-slate-500">superadmin@citycare.com • Admin@1234</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setEmail('superadmin@citycare.com');
                  setPassword('Admin@1234');
                }}
                className="bg-purple-50 hover:bg-purple-100 text-purple-800 font-bold px-2.5 py-1 rounded-lg border border-purple-300 transition cursor-pointer"
              >
                Autofill
              </button>
            </div>
            <p className="text-[10px] text-slate-400 italic">
              Hospital Admins & Staff use dynamic credentials created during hospital registration.
            </p>
          </div>
        </details>

        <button
          onClick={onCancel}
          className="w-full text-slate-500 hover:text-slate-800 text-xs font-semibold py-2 text-center border-t border-slate-100 transition cursor-pointer"
        >
          ← Return to Patient Booking Portal
        </button>
      </div>
    </div>
  );
};
