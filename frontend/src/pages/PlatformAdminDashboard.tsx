import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { HospitalAdminSummary, LoginResponse } from '../types';
import { 
  Building2, 
  Users, 
  Stethoscope, 
  QrCode, 
  Plus, 
  Copy, 
  ExternalLink, 
  RefreshCw, 
  CheckCircle, 
  LogOut, 
  KeyRound, 
  MapPin, 
  Phone, 
  Calendar, 
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Printer,
  Edit,
  Trash2,
  AlertTriangle
} from 'lucide-react';

interface PlatformAdminDashboardProps {
  currentUser: LoginResponse;
  onLogout: () => void;
  onSelectHospitalDashboard: (hospitalId: string, hospitalName: string, hospitalSlug: string) => void;
  onOpenPatientPortal: (slug: string) => void;
}

export const PlatformAdminDashboard: React.FC<PlatformAdminDashboardProps> = ({
  currentUser,
  onLogout,
  onSelectHospitalDashboard,
  onOpenPatientPortal,
}) => {
  const [hospitals, setHospitals] = useState<HospitalAdminSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // New Hospital Registration Modal State
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [regForm, setRegForm] = useState({
    hospitalName: '',
    slug: '',
    address: '',
    phone: '',
    adminFullName: '',
    adminEmail: '',
    adminPassword: import.meta.env.DEV ? 'Admin@1234' : '',
  });
  const [newlyRegisteredHospital, setNewlyRegisteredHospital] = useState<LoginResponse | null>(null);
  const [copiedLink, setCopiedLink] = useState<string | null>(null);

  // Edit Hospital State
  const [editingHospital, setEditingHospital] = useState<HospitalAdminSummary | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editForm, setEditForm] = useState({
    name: '',
    address: '',
    phone: '',
    accessCode: '',
    status: 'ACTIVE' as 'ACTIVE' | 'SUSPENDED' | 'INACTIVE',
  });

  // Delete Hospital State
  const [deletingHospital, setDeletingHospital] = useState<HospitalAdminSummary | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleOpenEdit = (h: HospitalAdminSummary) => {
    setEditingHospital(h);
    setEditForm({
      name: h.name,
      address: h.address || '',
      phone: h.phone || '',
      accessCode: h.accessCode,
      status: (h.status as any) || 'ACTIVE',
    });
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingHospital) return;
    if (!editForm.name.trim()) {
      alert('Hospital name cannot be empty.');
      return;
    }
    try {
      setSavingEdit(true);
      await api.updateHospitalByAdmin(editingHospital.id, {
        name: editForm.name.trim(),
        address: editForm.address.trim() || undefined,
        phone: editForm.phone.trim() || undefined,
        accessCode: editForm.accessCode.trim() || undefined,
        status: editForm.status,
      });
      alert(`Hospital "${editForm.name}" updated successfully.`);
      setEditingHospital(null);
      await loadHospitals();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to update hospital');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingHospital) return;
    try {
      setIsDeleting(true);
      await api.deleteHospitalByAdmin(deletingHospital.id);
      alert(`Hospital "${deletingHospital.name}" has been permanently removed.`);
      setDeletingHospital(null);
      await loadHospitals();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to delete hospital');
    } finally {
      setIsDeleting(false);
    }
  };

  useEffect(() => {
    loadHospitals();
  }, []);

  const loadHospitals = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.getAdminHospitals();
      setHospitals(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load hospital tenants');
    } finally {
      setLoading(false);
    }
  };

  const handleNameChange = (name: string) => {
    const slugified = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)+/g, '');
    
    setRegForm({
      ...regForm,
      hospitalName: name,
      slug: slugified,
      adminEmail: regForm.adminEmail || (slugified ? `admin@${slugified}.com` : ''),
    });
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regForm.hospitalName.trim() || !regForm.slug.trim() || !regForm.adminEmail.trim()) {
      alert('Please fill out Hospital Name, Slug, and Administrator Email.');
      return;
    }

    try {
      setSubmitting(true);
      const res = await api.registerHospital({
        hospitalName: regForm.hospitalName.trim(),
        slug: regForm.slug.trim(),
        address: regForm.address.trim() || undefined,
        phone: regForm.phone.trim() || undefined,
        adminFullName: regForm.adminFullName.trim() || `${regForm.hospitalName} Admin`,
        adminEmail: regForm.adminEmail.trim(),
        adminPassword: regForm.adminPassword,
      });

      setNewlyRegisteredHospital(res);
      await loadHospitals();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedLink(id);
    setTimeout(() => setCopiedLink(null), 2500);
  };

  const handlePrintPoster = (h: HospitalAdminSummary) => {
    const patientUrl = `${window.location.origin}/h/${h.slug}`;
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&margin=10&data=${encodeURIComponent(patientUrl)}`;
    
    const printWin = window.open('', '_blank');
    if (!printWin) return;

    printWin.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${h.name} - OPD Token QR Poster</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; text-align: center; padding: 40px; color: #0f172a; }
            .badge { background: #047857; color: white; padding: 6px 16px; border-radius: 9999px; font-size: 13px; font-weight: bold; text-transform: uppercase; }
            h1 { font-size: 28px; font-weight: 900; margin: 15px 0 5px; color: #064e3b; }
            p { font-size: 15px; color: #475569; margin: 5px 0 25px; }
            .qr-card { display: inline-block; padding: 25px; border: 4px solid #059669; border-radius: 28px; background: white; box-shadow: 0 10px 25px rgba(0,0,0,0.08); }
            img { width: 320px; height: 320px; display: block; margin: 0 auto; }
            .code-box { margin-top: 25px; padding: 15px; background: #f0fdf4; border-radius: 16px; border: 1px dashed #10b981; }
            .code-title { font-size: 13px; font-weight: bold; color: #047857; }
            .code { font-size: 32px; font-weight: 900; letter-spacing: 6px; color: #064e3b; font-family: monospace; }
            .footer { margin-top: 35px; font-size: 12px; color: #64748b; }
          </style>
        </head>
        <body>
          <span class="badge">Official OPD Remote Token Service</span>
          <h1>${h.name}</h1>
          <p>Scan with your mobile camera to take an OPD Token and track your live turn</p>
          <div class="qr-card">
            <img src="${qrUrl}" alt="QR Code" />
          </div>
          <div class="code-box">
            <div class="code-title">OR ENTER 6-DIGIT ACCESS PIN</div>
            <div class="code">${h.accessCode}</div>
          </div>
          <div class="footer">
            Direct Link: ${patientUrl}<br/>
            ${h.address || ''} • Ph: ${h.phone || ''}
          </div>
          <script>
            window.onload = function() { window.print(); };
          </script>
        </body>
      </html>
    `);
    printWin.document.close();
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans">
      {/* Platform Admin Top Header */}
      <header className="bg-slate-900 text-white shadow-xl sticky top-0 z-40 border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex flex-wrap items-center justify-between gap-y-3">
          <div className="flex items-center space-x-3.5">
            <div className="bg-emerald-500/20 p-2.5 rounded-2xl border border-emerald-500/30">
              <ShieldCheck className="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-lg font-black tracking-tight">Platform Master Admin</h1>
                <span className="bg-amber-400/20 text-amber-300 font-extrabold text-[10px] px-2.5 py-0.5 rounded-md border border-amber-400/30">
                  SUPER ADMIN
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Logged in as: <strong className="text-slate-200">{currentUser.email}</strong> • Global Multi-Tenant Oversight
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={() => {
                setNewlyRegisteredHospital(null);
                setRegForm({
                  hospitalName: '',
                  slug: '',
                  address: '',
                  phone: '',
                  adminFullName: '',
                  adminEmail: '',
                  adminPassword: import.meta.env.DEV ? 'Admin@1234' : '',
                });
                setShowRegisterModal(true);
              }}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold px-4 py-2 rounded-xl text-xs flex items-center space-x-1.5 transition shadow-sm cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>+ Register New Hospital</span>
            </button>

            <button
              onClick={loadHospitals}
              className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition cursor-pointer"
              title="Refresh Hospital Directory"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>

            <button
              onClick={onLogout}
              className="bg-red-950/70 hover:bg-red-900 text-red-200 px-3 py-1.5 rounded-xl text-xs font-bold flex items-center space-x-1 border border-red-800/60 transition cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 flex-1 space-y-6">
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-2xl flex items-center justify-between text-sm shadow-xs">
            <span className="font-semibold">{error}</span>
            <button onClick={() => setError(null)} className="font-bold text-lg cursor-pointer">&times;</button>
          </div>
        )}

        {/* Overview Platform Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase text-slate-400">Total Registered Hospitals</p>
              <p className="text-3xl font-black text-slate-900 mt-1">{hospitals.length}</p>
              <p className="text-[11px] text-emerald-600 font-semibold mt-0.5">100% Tenant Isolated</p>
            </div>
            <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600">
              <Building2 className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase text-slate-400">Total Doctors Onboarded</p>
              <p className="text-3xl font-black text-slate-900 mt-1">
                {hospitals.reduce((acc, h) => acc + h.doctorCount, 0)}
              </p>
              <p className="text-[11px] text-slate-500 font-semibold mt-0.5">Across all hospital rosters</p>
            </div>
            <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600">
              <Stethoscope className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase text-slate-400">Today's Active OPD Queues</p>
              <p className="text-3xl font-black text-slate-900 mt-1">
                {hospitals.reduce((acc, h) => acc + h.activeSessionCount, 0)}
              </p>
              <p className="text-[11px] text-slate-500 font-semibold mt-0.5">Live consultation desks</p>
            </div>
            <div className="w-12 h-12 bg-purple-50 rounded-2xl flex items-center justify-center text-purple-600">
              <Users className="w-6 h-6" />
            </div>
          </div>
        </div>

        {/* Hospital Directory Header */}
        <div className="flex items-center justify-between pt-2">
          <div>
            <h2 className="text-lg font-black text-slate-900 flex items-center space-x-2">
              <Building2 className="w-5 h-5 text-emerald-600" />
              <span>Registered Hospital Tenants ({hospitals.length})</span>
            </h2>
            <p className="text-xs text-slate-500">
              Every hospital has a unique QR code, direct patient entry URL, and private dashboard credentials
            </p>
          </div>

          <button
            onClick={() => {
              setNewlyRegisteredHospital(null);
              setShowRegisterModal(true);
            }}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold px-3.5 py-1.5 rounded-xl text-xs flex items-center space-x-1.5 transition cursor-pointer shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Register Hospital</span>
          </button>
        </div>

        {/* Hospital Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {hospitals.map((h) => {
            const patientUrl = `${window.location.origin}/h/${h.slug}`;
            const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&margin=8&data=${encodeURIComponent(patientUrl)}`;

            return (
              <div
                key={h.id}
                className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm hover:shadow-md transition space-y-5 flex flex-col justify-between"
              >
                {/* Header & Badges */}
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center space-x-2">
                        <h3 className="text-lg font-black text-slate-900">{h.name}</h3>
                        <span className="bg-emerald-100 text-emerald-800 text-[10px] font-extrabold px-2 py-0.5 rounded-md uppercase">
                          {h.status}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5 flex items-center space-x-1">
                        <MapPin className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                        <span>{h.address || 'Address not specified'}</span>
                      </p>
                    </div>

                    <div className="text-right flex-shrink-0">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Kiosk PIN</span>
                      <span className="font-mono text-sm font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-200">
                        {h.accessCode}
                      </span>
                    </div>
                  </div>

                  {/* Operational Stats */}
                  <div className="grid grid-cols-3 gap-2 p-3 bg-slate-50 rounded-2xl border border-slate-100 text-xs text-center">
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 block">DOCTORS</span>
                      <span className="text-sm font-black text-slate-800">{h.doctorCount}</span>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 block">TODAY'S OPD</span>
                      <span className="text-sm font-black text-emerald-700">{h.activeSessionCount}</span>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 block">PHONE</span>
                      <span className="text-xs font-extrabold text-slate-800 truncate block">{h.phone || '—'}</span>
                    </div>
                  </div>

                  {/* QR Code and Patient URL Banner */}
                  <div className="flex items-center space-x-4 p-3.5 bg-emerald-50/60 rounded-2xl border border-emerald-100">
                    <div className="w-20 h-20 bg-white p-1 rounded-xl border border-emerald-200 flex-shrink-0 shadow-2xs">
                      <img src={qrImageUrl} alt={`${h.name} QR`} className="w-full h-full object-contain" />
                    </div>
                    <div className="flex-1 min-w-0 space-y-1.5">
                      <div>
                        <span className="text-[10px] font-black uppercase text-emerald-800 block">Patient Entry Portal</span>
                        <p className="text-xs font-mono text-emerald-900 truncate font-semibold">/h/{h.slug}</p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => handleCopy(patientUrl, h.id)}
                          className="bg-white hover:bg-emerald-100 text-emerald-800 border border-emerald-300 px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center space-x-1 transition cursor-pointer"
                        >
                          <Copy className="w-3 h-3 text-emerald-600" />
                          <span>{copiedLink === h.id ? 'Copied!' : 'Copy Link'}</span>
                        </button>
                        <button
                          onClick={() => handlePrintPoster(h)}
                          className="bg-white hover:bg-emerald-100 text-emerald-800 border border-emerald-300 px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center space-x-1 transition cursor-pointer"
                        >
                          <Printer className="w-3 h-3 text-emerald-600" />
                          <span>Print Poster</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Hospital Staff Credentials Card */}
                  <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black uppercase text-slate-400 flex items-center space-x-1">
                        <KeyRound className="w-3 h-3 text-slate-400" />
                        <span>Hospital Staff Login:</span>
                      </span>
                      <span className="text-[10px] font-bold text-slate-500">{h.adminName}</span>
                    </div>
                    <div className="flex items-center justify-between font-mono text-[11px] pt-1">
                      <span className="text-slate-700 font-semibold truncate">{h.adminEmail}</span>
                      {import.meta.env.DEV ? (
                        <span className="bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded font-bold">Admin@1234</span>
                      ) : (
                        <span className="bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-mono">••••••••</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Primary Action Launchers */}
                <div className="pt-2 border-t border-slate-100 space-y-2">
                  <div className="grid grid-cols-2 gap-2.5">
                    <button
                      onClick={() => onSelectHospitalDashboard(h.id, h.name, h.slug)}
                      className="bg-slate-900 hover:bg-slate-800 text-white font-extrabold py-2.5 px-3 rounded-xl text-xs flex items-center justify-center space-x-1.5 transition cursor-pointer shadow-xs"
                      title="Open and manage this hospital's live dashboard"
                    >
                      <Stethoscope className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Launch Desk</span>
                    </button>

                    <button
                      onClick={() => onOpenPatientPortal(h.slug)}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold py-2.5 px-3 rounded-xl text-xs flex items-center justify-center space-x-1.5 transition cursor-pointer shadow-xs"
                      title="Open patient booking interface for this hospital"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Patient View</span>
                    </button>
                  </div>

                  {/* Super Admin Control Toolbar */}
                  <div className="grid grid-cols-2 gap-2.5">
                    <button
                      onClick={() => handleOpenEdit(h)}
                      className="bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold py-2 px-3 rounded-xl text-xs flex items-center justify-center space-x-1.5 transition cursor-pointer border border-slate-200"
                      title="Edit hospital name, contact, status or Kiosk PIN"
                    >
                      <Edit className="w-3.5 h-3.5 text-slate-600" />
                      <span>Edit Details</span>
                    </button>

                    <button
                      onClick={() => setDeletingHospital(h)}
                      className="bg-red-50 hover:bg-red-100 text-red-700 font-bold py-2 px-3 rounded-xl text-xs flex items-center justify-center space-x-1.5 transition cursor-pointer border border-red-200"
                      title="Permanently remove this hospital tenant"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-red-600" />
                      <span>Remove Hospital</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </main>

      {/* ------------------------------------------------------------- */}
      {/* MODAL: REGISTER NEW HOSPITAL TENANT                            */}
      {/* ------------------------------------------------------------- */}
      {showRegisterModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-slate-200 space-y-5 animate-in fade-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2.5">
                <div className="p-2.5 bg-emerald-50 rounded-2xl text-emerald-600">
                  <Building2 className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-lg">Register New Hospital</h3>
                  <p className="text-xs text-slate-500">Instantly provision isolated tenant, QR code, and dashboard</p>
                </div>
              </div>
              <button
                onClick={() => setShowRegisterModal(false)}
                className="text-slate-400 hover:text-slate-600 font-bold text-xl cursor-pointer"
              >
                &times;
              </button>
            </div>

            {newlyRegisteredHospital ? (
              <div className="space-y-4">
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-center space-y-2">
                  <div className="w-12 h-12 bg-emerald-600 text-white rounded-full flex items-center justify-center mx-auto shadow-md">
                    <CheckCircle className="w-6 h-6" />
                  </div>
                  <h4 className="font-black text-slate-900 text-base">Hospital Successfully Registered!</h4>
                  <p className="text-xs text-slate-600">
                    <strong>{newlyRegisteredHospital.hospitalName}</strong> is now live on the platform with full tenant isolation.
                  </p>
                </div>

                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2 text-xs">
                  <div className="flex items-center justify-between py-1 border-b border-slate-200">
                    <span className="text-slate-500 font-semibold">Patient Portal Link:</span>
                    <span className="font-mono font-bold text-emerald-700">/h/{newlyRegisteredHospital.hospitalSlug}</span>
                  </div>
                  <div className="flex items-center justify-between py-1 border-b border-slate-200">
                    <span className="text-slate-500 font-semibold">Admin Login Email:</span>
                    <span className="font-mono font-bold text-slate-800">{newlyRegisteredHospital.email}</span>
                  </div>
                  <div className="flex items-center justify-between py-1">
                    <span className="text-slate-500 font-semibold">Admin Password:</span>
                    <span className="font-mono font-bold text-slate-800">{regForm.adminPassword}</span>
                  </div>
                </div>

                <div className="space-y-2 pt-2">
                  <button
                    onClick={() => {
                      setShowRegisterModal(false);
                      onSelectHospitalDashboard(
                        newlyRegisteredHospital.hospitalId,
                        newlyRegisteredHospital.hospitalName,
                        newlyRegisteredHospital.hospitalSlug
                      );
                    }}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black py-3 rounded-2xl text-xs flex items-center justify-center space-x-1.5 transition cursor-pointer shadow-md"
                  >
                    <Stethoscope className="w-4 h-4" />
                    <span>Launch {newlyRegisteredHospital.hospitalName} Dashboard Now ➔</span>
                  </button>

                  <button
                    onClick={() => {
                      setShowRegisterModal(false);
                      onOpenPatientPortal(newlyRegisteredHospital.hospitalSlug);
                    }}
                    className="w-full bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold py-2.5 rounded-2xl text-xs flex items-center justify-center space-x-1.5 transition cursor-pointer border border-slate-200"
                  >
                    <ExternalLink className="w-4 h-4" />
                    <span>Open Patient Booking App (/h/{newlyRegisteredHospital.hospitalSlug})</span>
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleRegisterSubmit} className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Hospital Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Fortis Super Care Hospital"
                    value={regForm.hospitalName}
                    onChange={(e) => handleNameChange(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Unique URL Slug (Patient link identifier) *
                  </label>
                  <div className="flex items-center">
                    <span className="px-3 py-2.5 bg-slate-100 border border-r-0 border-slate-300 rounded-l-xl text-xs font-mono text-slate-500">
                      /h/
                    </span>
                    <input
                      type="text"
                      required
                      placeholder="fortis-care"
                      value={regForm.slug}
                      onChange={(e) => setRegForm({ ...regForm, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })}
                      className="flex-1 px-3.5 py-2.5 border border-slate-300 rounded-r-xl text-xs font-mono font-bold text-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">Address / City</label>
                    <input
                      type="text"
                      placeholder="e.g. Sector 62, Noida"
                      value={regForm.address}
                      onChange={(e) => setRegForm({ ...regForm, address: e.target.value })}
                      className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">Contact Phone</label>
                    <input
                      type="text"
                      placeholder="e.g. +91 9876543210"
                      value={regForm.phone}
                      onChange={(e) => setRegForm({ ...regForm, phone: e.target.value })}
                      className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 space-y-3">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-500">Initial Administrator Credentials</h4>
                  
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">Administrator Full Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Dr. Rajesh Gupta (Medical Director)"
                      value={regForm.adminFullName}
                      onChange={(e) => setRegForm({ ...regForm, adminFullName: e.target.value })}
                      className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">Admin Email *</label>
                      <input
                        type="email"
                        required
                        placeholder="admin@fortis.com"
                        value={regForm.adminEmail}
                        onChange={(e) => setRegForm({ ...regForm, adminEmail: e.target.value })}
                        className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-xs font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">Admin Password *</label>
                      <input
                        type="text"
                        required
                        value={regForm.adminPassword}
                        onChange={(e) => setRegForm({ ...regForm, adminPassword: e.target.value })}
                        className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-xs font-mono font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-100 flex items-center justify-end space-x-2.5">
                  <button
                    type="button"
                    onClick={() => setShowRegisterModal(false)}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold px-5 py-2.5 rounded-xl text-xs transition cursor-pointer shadow-sm disabled:opacity-50"
                  >
                    {submitting ? 'Registering Tenant...' : 'Confirm & Register Hospital'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL: EDIT HOSPITAL DETAILS                                 */}
      {/* ------------------------------------------------------------- */}
      {editingHospital && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-slate-200 space-y-5 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2.5">
                <div className="p-2.5 bg-emerald-50 rounded-2xl text-emerald-600">
                  <Edit className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-lg">Edit Hospital Details</h3>
                  <p className="text-xs text-slate-500">
                    Tenant Slug: <span className="font-mono font-bold text-emerald-700">/h/{editingHospital.slug}</span>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setEditingHospital(null)}
                className="text-slate-400 hover:text-slate-600 font-bold text-xl cursor-pointer"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Hospital Name *</label>
                <input
                  type="text"
                  required
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Physical Address / City</label>
                <input
                  type="text"
                  placeholder="e.g. GT Road, Ludhiana, Punjab"
                  value={editForm.address}
                  onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                  className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Official Phone</label>
                  <input
                    type="text"
                    placeholder="e.g. +91 9876543210"
                    value={editForm.phone}
                    onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                    className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Kiosk Access PIN</label>
                  <input
                    type="text"
                    maxLength={10}
                    placeholder="e.g. 202303"
                    value={editForm.accessCode}
                    onChange={(e) => setEditForm({ ...editForm, accessCode: e.target.value })}
                    className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-xs font-mono font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Operating Status</label>
                <select
                  value={editForm.status}
                  onChange={(e) => setEditForm({ ...editForm, status: e.target.value as any })}
                  className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                >
                  <option value="ACTIVE">ACTIVE (Accepting Patients & Staff)</option>
                  <option value="SUSPENDED">SUSPENDED (Temporarily Paused)</option>
                  <option value="INACTIVE">INACTIVE (Decommissioned)</option>
                </select>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setEditingHospital(null)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold px-5 py-2.5 rounded-xl text-xs shadow-md transition cursor-pointer disabled:opacity-50"
                >
                  {savingEdit ? 'Saving Changes...' : 'Save Hospital Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL: REMOVE / DELETE HOSPITAL CONFIRMATION                 */}
      {/* ------------------------------------------------------------- */}
      {deletingHospital && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-2xl border border-red-200 space-y-5 animate-in fade-in zoom-in-95">
            <div className="flex items-start justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center flex-shrink-0">
                  <AlertTriangle className="w-7 h-7" />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-lg">Remove Hospital Tenant?</h3>
                  <p className="text-xs text-slate-500">
                    Slug: <strong className="text-red-700 font-mono">/h/{deletingHospital.slug}</strong>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setDeletingHospital(null)}
                className="text-slate-400 hover:text-slate-600 font-bold text-xl cursor-pointer"
              >
                &times;
              </button>
            </div>

            <div className="space-y-3">
              <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-xs text-red-900 space-y-1.5 leading-relaxed">
                <p className="font-extrabold text-sm text-red-800">
                  Permanent Destruction Warning
                </p>
                <p>
                  You are about to permanently delete <strong>{deletingHospital.name}</strong>.
                </p>
                <p className="text-[11px] text-red-700">
                  This will erase all staff accounts, <strong>{deletingHospital.doctorCount} doctors</strong>, active/past OPD sessions, waiting queues, and patient records associated with this hospital.
                </p>
              </div>

              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 text-[11px] text-slate-600 space-y-1">
                <div>• Hospital Admin: <span className="font-mono font-semibold">{deletingHospital.adminEmail}</span></div>
                <div>• Patient Access Code: <span className="font-mono font-bold text-slate-800">{deletingHospital.accessCode}</span></div>
              </div>
            </div>

            <div className="pt-2 flex items-center justify-end space-x-2.5">
              <button
                type="button"
                onClick={() => setDeletingHospital(null)}
                className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="bg-red-600 hover:bg-red-700 text-white font-extrabold px-5 py-2.5 rounded-xl text-xs shadow-md transition cursor-pointer flex items-center space-x-1.5 disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4" />
                <span>{isDeleting ? 'Deleting Hospital...' : 'Confirm & Delete Hospital'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
