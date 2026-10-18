import React, { useState, useRef, useEffect } from 'react';
import { api } from '../services/api';
import { LoginResponse } from '../types';
import { 
  Building2, 
  ArrowRight, 
  Eye, 
  EyeOff, 
  Plus, 
  LayoutGrid, 
  Clock, 
  HeartPulse, 
  ShieldCheck, 
  QrCode, 
  Camera, 
  Upload, 
  AlertCircle, 
  X,
  Phone,
  Mail,
  HelpCircle,
  Stethoscope,
  Sparkles,
  CheckCircle2,
  Activity,
  ArrowUpRight
} from 'lucide-react';

interface LandingPageProps {
  onLoginSuccess: (user: LoginResponse) => void;
  onSelectHospital: (slug: string) => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  onLoginSuccess,
  onSelectHospital,
}) => {
  // Mobile active view tab: 'STAFF' | 'PATIENT'
  const [mobileTab, setMobileTab] = useState<'STAFF' | 'PATIENT'>('STAFF');

  // Staff Login Form state
  const [emailOrUsername, setEmailOrUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const usernameInputRef = useRef<HTMLInputElement | null>(null);

  // QR Scanner modal state
  const [showScanner, setShowScanner] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [scannerStatus, setScannerStatus] = useState<string>('Point camera at QR code');
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const scanIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Support Modal state
  const [showSupportModal, setShowSupportModal] = useState(false);

  // Interactive selected feature card for mobile sheet/toast
  const [activeFeature, setActiveFeature] = useState<number | null>(null);

  const focusLoginForm = () => {
    setMobileTab('STAFF');
    setTimeout(() => {
      usernameInputRef.current?.focus();
      usernameInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 50);
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoginLoading(true);
      setLoginError(null);
      const res = await api.login(emailOrUsername.trim(), password);
      onLoginSuccess(res);
    } catch (err: unknown) {
      setLoginError(err instanceof Error ? err.message : 'Invalid credentials. Please verify your hospital staff email and password.');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleResolveHospital = async (query: string) => {
    const clean = query.trim();
    if (!clean) return;

    try {
      setCameraError(null);

      let candidate = clean;
      if (candidate.includes('slug=')) {
        const urlParams = new URLSearchParams(candidate.split('?')[1]);
        candidate = urlParams.get('slug') || candidate;
      } else if (candidate.includes('/h/')) {
        candidate = candidate.split('/h/')[1].split('/')[0].split('?')[0];
      } else if (candidate.includes('/patient/')) {
        candidate = candidate.split('/patient/')[1].split('/')[0].split('?')[0];
      }

      // Check if 6-digit access code (digits only)
      if (/^\d{6}$/.test(candidate)) {
        const hospital = await api.resolveHospitalByCode(candidate);
        if (hospital?.slug) {
          onSelectHospital(hospital.slug);
          return;
        }
      }

      // Resolve by slug
      const hospital = await api.resolveHospitalBySlug(candidate);
      if (hospital?.slug) {
        onSelectHospital(hospital.slug);
        return;
      }

      throw new Error(`Hospital not recognized from QR code: "${clean}"`);
    } catch (err: unknown) {
      setCameraError(err instanceof Error ? err.message : 'Hospital not found from QR code.');
    }
  };

  const stopCameraStream = () => {
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  const startCameraStream = async () => {
    setCameraError(null);
    setScannerStatus('Starting camera...');
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera access is not supported on this browser or device.');
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      mediaStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true');
        await videoRef.current.play();
      }
      setScannerStatus('Align QR code within the frame to scan');

      // Native BarcodeDetector auto-detection loop
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ('BarcodeDetector' in window) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const barcodeDetector = new (window as any).BarcodeDetector({ formats: ['qr_code'] });
        scanIntervalRef.current = setInterval(async () => {
          if (videoRef.current && videoRef.current.readyState >= 2) {
            try {
              const barcodes = await barcodeDetector.detect(videoRef.current);
              if (barcodes.length > 0 && barcodes[0].rawValue) {
                stopCameraStream();
                setShowScanner(false);
                handleResolveHospital(barcodes[0].rawValue);
              }
            } catch {
              // Frame scanning quiet fallback
            }
          }
        }, 300);
      }
    } catch (err: unknown) {
      setCameraError(
        err instanceof Error ? err.message : 'Unable to access camera. Please allow camera permissions or upload a QR image.'
      );
      stopCameraStream();
    }
  };

  // Clean up or trigger camera stream when scanner modal toggles
  useEffect(() => {
    if (showScanner) {
      startCameraStream();
    } else {
      stopCameraStream();
    }
    return () => {
      stopCameraStream();
    };
  }, [showScanner]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setCameraError(null);
      setScannerStatus('Analyzing QR code image...');

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ('BarcodeDetector' in window) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const barcodeDetector = new (window as any).BarcodeDetector({ formats: ['qr_code'] });
        const img = new Image();
        img.src = URL.createObjectURL(file);
        await new Promise((resolve) => (img.onload = resolve));
        const barcodes = await barcodeDetector.detect(img);
        if (barcodes.length > 0 && barcodes[0].rawValue) {
          stopCameraStream();
          setShowScanner(false);
          handleResolveHospital(barcodes[0].rawValue);
          return;
        }
      }

      // Fallback: Read QR via public QR decoding API
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('https://api.qrserver.com/v1/read-qr-code/', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      const qrData = data?.[0]?.symbol?.[0]?.data;
      if (qrData) {
        stopCameraStream();
        setShowScanner(false);
        handleResolveHospital(qrData);
      } else {
        setCameraError('No valid QR code detected in the selected image. Please try another photo or scan with camera.');
      }
    } catch {
      setCameraError('Could not decode QR code from the selected image.');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-white via-slate-50/40 to-slate-100/40 text-slate-800 font-sans flex flex-col justify-between pb-20 sm:pb-8 selection:bg-emerald-100 selection:text-emerald-900">
      
      {/* 1. Header / Navbar */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-100 shadow-2xs">
        <div className="max-w-7xl mx-auto px-3.5 sm:px-6 lg:px-8 py-3 flex items-center justify-between gap-2">
          
          {/* Logo & Brand Tag */}
          <div className="flex items-center space-x-2.5 min-w-0">
            {/* Heart with Medical Cross Brand Icon */}
            <div className="w-9 h-9 rounded-xl bg-emerald-600/10 border border-emerald-600/20 text-emerald-700 flex items-center justify-center shadow-2xs flex-shrink-0">
              <svg 
                viewBox="0 0 24 24" 
                className="w-5 h-5 fill-emerald-600 stroke-emerald-600 stroke-1"
              >
                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                <path 
                  d="M12 7.5v6M9 10.5h6" 
                  className="stroke-white stroke-2 fill-none" 
                  strokeLinecap="round" 
                />
              </svg>
            </div>
            
            <span className="font-black text-lg sm:text-xl text-slate-900 tracking-tight truncate">
              OPD-JOB
            </span>

            <span className="bg-emerald-50 text-emerald-800 text-[10px] sm:text-[11px] font-bold px-2 sm:px-2.5 py-0.5 rounded-full border border-emerald-200/80 shadow-2xs hidden md:inline-flex items-center whitespace-nowrap">
              Smart OPD Token System
            </span>
          </div>

          {/* Right Action Buttons */}
          <div className="flex items-center space-x-2 flex-shrink-0">
            {/* Patient Portal / QR Scanner Icon Button */}
            <button
              type="button"
              onClick={() => {
                setShowScanner(true);
              }}
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl border border-emerald-200 bg-emerald-50/70 hover:bg-emerald-100 text-emerald-700 flex items-center justify-center transition cursor-pointer shadow-2xs active:scale-95"
              title="Patient Portal: Scan QR Code"
            >
              <Camera className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>

            {/* Doctor Login Primary Button */}
            <button
              type="button"
              onClick={focusLoginForm}
              className="bg-[#064e3b] hover:bg-[#043d2e] text-white font-black text-xs sm:text-sm px-3.5 sm:px-5 py-2 sm:py-2.5 rounded-xl shadow-xs transition cursor-pointer active:scale-95 flex items-center space-x-1"
            >
              <Stethoscope className="w-3.5 h-3.5 sm:hidden" />
              <span>Doctor Login</span>
            </button>
          </div>
        </div>

        {/* Mobile Interactive Tab Bar (App-like Switcher) */}
        <div className="sm:hidden px-3.5 pb-2.5 pt-0.5">
          <div className="grid grid-cols-2 p-1 bg-slate-100/90 rounded-2xl border border-slate-200/80 shadow-2xs">
            <button
              type="button"
              onClick={() => setMobileTab('STAFF')}
              className={`py-2 text-xs font-black rounded-xl transition cursor-pointer flex items-center justify-center space-x-1.5 ${
                mobileTab === 'STAFF'
                  ? 'bg-white text-emerald-900 shadow-xs border border-slate-200/60'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Stethoscope className="w-3.5 h-3.5 text-emerald-600" />
              <span>Doctor / Staff</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setMobileTab('PATIENT');
                setShowScanner(true);
              }}
              className={`py-2 text-xs font-black rounded-xl transition cursor-pointer flex items-center justify-center space-x-1.5 ${
                mobileTab === 'PATIENT'
                  ? 'bg-white text-emerald-900 shadow-xs border border-slate-200/60'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Camera className="w-3.5 h-3.5 text-emerald-600" />
              <span>Patient Portal</span>
            </button>
          </div>
        </div>
      </header>

      {/* 2. Main Hero Section */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-3.5 sm:px-6 lg:px-8 py-5 sm:py-10 lg:py-14">
        
        {/* On Mobile: Render Staff Login Card first when 'STAFF' tab is active, or Dedicated QR Card when 'PATIENT' is active */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-12 items-center">
          
          {/* Left Column: Hero Text & Information */}
          <div className={`lg:col-span-7 xl:col-span-7 space-y-4 sm:space-y-6 ${mobileTab === 'PATIENT' ? 'hidden sm:block' : ''}`}>
            <div className="inline-flex items-center space-x-2 text-emerald-700 bg-emerald-50 border border-emerald-200/80 px-3 py-1 rounded-full text-xs font-bold tracking-wide w-fit">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>For Doctors & Hospital Staff</span>
            </div>

            <h1 className="text-2xl xs:text-3xl sm:text-4xl lg:text-5xl font-black text-slate-900 tracking-tight leading-[1.15]">
              Manage OPD Sessions <br className="hidden xs:inline" />
              <span className="text-slate-900">with Ease</span>
            </h1>

            <p className="text-slate-600 text-xs sm:text-base leading-relaxed max-w-lg">
              Login to your hospital dashboard to manage OPD sessions, view queues, update token status and more.
            </p>

            {/* Desktop CTAs */}
            <div className="hidden sm:flex items-center space-x-3 pt-1">
              <button
                type="button"
                onClick={focusLoginForm}
                className="bg-[#064e3b] hover:bg-[#043d2e] text-white font-extrabold px-6 py-3 rounded-2xl shadow-md hover:shadow-lg transition flex items-center justify-center space-x-2 text-sm cursor-pointer group active:scale-95"
              >
                <span>Doctor Login</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>

              <button
                type="button"
                onClick={() => setShowScanner(true)}
                className="text-xs sm:text-sm font-bold text-emerald-800 bg-emerald-50/80 hover:bg-emerald-100 border border-emerald-200/80 px-4 py-3 rounded-2xl transition cursor-pointer flex items-center space-x-2 shadow-2xs active:scale-95"
              >
                <Camera className="w-4 h-4 text-emerald-600" />
                <span>Patient Portal (Scan QR)</span>
              </button>
            </div>

            {/* Quick Live Health Ticker */}
            <div className="pt-2 flex items-center space-x-2 text-[11px] text-slate-500">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              <span>Live real-time sync across reception, doctor room & patient mobile</span>
            </div>
          </div>

          {/* Right Column: Interactive Card */}
          <div className="lg:col-span-5 xl:col-span-5 relative flex items-center justify-center">
            
            {/* Soft Ambient Glow */}
            <div className="absolute -inset-4 sm:-inset-6 bg-gradient-to-tr from-emerald-100/50 via-teal-100/30 to-sky-100/40 rounded-3xl -z-10 blur-xl opacity-70"></div>
            
            {/* Doctor Photo Backdrop on Desktop */}
            <div 
              className="absolute right-0 top-1/2 -translate-y-1/2 w-72 sm:w-80 h-96 sm:h-[420px] rounded-3xl opacity-30 lg:opacity-45 pointer-events-none -z-5 overflow-hidden hidden sm:block"
              style={{
                backgroundImage: 'url(/doctor-hero.jpg)',
                backgroundSize: 'cover',
                backgroundPosition: 'center right',
                maskImage: 'linear-gradient(to left, rgba(0,0,0,1) 40%, rgba(0,0,0,0) 100%)',
                WebkitMaskImage: 'linear-gradient(to left, rgba(0,0,0,1) 40%, rgba(0,0,0,0) 100%)'
              }}
            ></div>

            {/* IF MOBILE TAB IS 'PATIENT', SHOW DEDICATED QR SCAN CARD */}
            {mobileTab === 'PATIENT' ? (
              <div className="bg-white/95 backdrop-blur-md rounded-3xl p-6 sm:p-7 shadow-xl border border-slate-100 max-w-sm w-full mx-auto relative z-10 space-y-4 animate-in fade-in zoom-in-95 duration-150 text-center">
                <div className="w-14 h-14 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center mx-auto shadow-2xs">
                  <Camera className="w-7 h-7" />
                </div>
                
                <div className="space-y-1">
                  <h2 className="font-black text-slate-900 text-lg sm:text-xl tracking-tight">
                    Scan Hospital QR Code
                  </h2>
                  <p className="text-xs text-slate-500 leading-relaxed max-w-xs mx-auto">
                    Scan prescription or hospital counter QR code to view your live token & queue status.
                  </p>
                </div>

                {cameraError && (
                  <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs flex items-center space-x-2 text-left">
                    <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-500" />
                    <span className="leading-tight">{cameraError}</span>
                  </div>
                )}

                <div className="space-y-2.5 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowScanner(true)}
                    className="w-full bg-[#064e3b] hover:bg-[#043d2e] text-white font-black py-3.5 rounded-2xl text-sm shadow-md transition cursor-pointer active:scale-95 flex items-center justify-center space-x-2"
                  >
                    <Camera className="w-5 h-5 text-emerald-300" />
                    <span>Open Camera to Scan QR</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 rounded-xl text-xs flex items-center justify-center space-x-2 cursor-pointer transition active:scale-95"
                  >
                    <Upload className="w-4 h-4 text-slate-500" />
                    <span>Upload QR Photo from Gallery</span>
                  </button>
                </div>

                <div className="pt-2 text-[11px] text-slate-400">
                  ⚡ Instant queue tracking • No registration required
                </div>
              </div>
            ) : (
              /* HOSPITAL STAFF LOGIN CARD */
              <div className="bg-white/95 backdrop-blur-md rounded-3xl p-5 sm:p-7 shadow-xl sm:shadow-2xl border border-slate-100 max-w-sm w-full mx-auto relative z-10 transition-all animate-in fade-in zoom-in-95 duration-150">
                
                {/* Card Top Icon Badge */}
                <div className="w-12 h-12 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center mx-auto mb-2.5 shadow-2xs">
                  <Plus className="w-6 h-6 stroke-[3]" />
                </div>

                {/* Title & Subtitle */}
                <h2 className="text-center font-black text-slate-900 text-base sm:text-lg tracking-tight">
                  Hospital Staff Login
                </h2>
                <p className="text-center text-xs text-slate-500 mb-4 sm:mb-5">
                  Access your OPD dashboard
                </p>

                {/* Error Alert */}
                {loginError && (
                  <div className="mb-3.5 p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs flex items-center space-x-2 animate-in fade-in">
                    <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-500" />
                    <span className="leading-tight">{loginError}</span>
                  </div>
                )}

                {/* Login Form */}
                <form onSubmit={handleLoginSubmit} className="space-y-3">
                  <div>
                    <input
                      ref={usernameInputRef}
                      type="text"
                      required
                      value={emailOrUsername}
                      onChange={(e) => setEmailOrUsername(e.target.value)}
                      placeholder="Hospital ID / Username"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm text-slate-800 placeholder-slate-400 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition shadow-2xs"
                    />
                  </div>

                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Password"
                      className="w-full pl-3.5 pr-10 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm text-slate-800 placeholder-slate-400 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition shadow-2xs"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition cursor-pointer p-1"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>

                  <button
                    type="submit"
                    disabled={loginLoading}
                    className="w-full mt-1.5 bg-[#064e3b] hover:bg-[#043d2e] disabled:bg-slate-300 text-white font-black py-2.5 rounded-xl text-xs sm:text-sm shadow-md hover:shadow-lg transition cursor-pointer active:scale-98 flex items-center justify-center space-x-1.5"
                  >
                    {loginLoading ? (
                      <span>Authenticating...</span>
                    ) : (
                      <span>Login</span>
                    )}
                  </button>
                </form>

                {/* Quick 1-Tap Demo Button */}
                <div className="mt-3.5 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                  <span>Demo Hospital Account</span>
                  <button
                    type="button"
                    onClick={() => {
                      setEmailOrUsername('admin@shamcare.com');
                      setPassword('Hospital@1234');
                    }}
                    className="text-emerald-700 hover:text-emerald-800 font-extrabold hover:underline cursor-pointer bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200/80 active:scale-95"
                  >
                    1-Tap Autofill
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 3. Interactive "Why Choose OPD-JOB?" Section with App-style 2x2 Grid on Mobile */}
        <div className="mt-10 sm:mt-16 pt-6 sm:pt-8 border-t border-slate-200/60">
          <div className="flex items-center justify-between mb-5 sm:mb-8">
            <h2 className="text-lg sm:text-2xl font-black text-slate-900 tracking-tight">
              Why Choose OPD-JOB?
            </h2>
            <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200/60 hidden xs:inline-block">
              Modern Healthcare Platform
            </span>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
            
            {/* Feature 1 */}
            <div 
              onClick={() => setActiveFeature(activeFeature === 1 ? null : 1)}
              className={`p-3.5 sm:p-5 rounded-2xl border transition cursor-pointer active:scale-98 ${
                activeFeature === 1
                  ? 'bg-emerald-50 border-emerald-300 ring-2 ring-emerald-500/20 shadow-xs'
                  : 'bg-white border-slate-200/70 hover:border-emerald-300 hover:shadow-xs'
              }`}
            >
              <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl sm:rounded-2xl bg-emerald-100/80 text-emerald-700 flex items-center justify-center shadow-2xs mb-2.5">
                <LayoutGrid className="w-5 h-5" />
              </div>
              <h3 className="font-extrabold text-xs sm:text-base text-slate-900 leading-snug">
                Easy Queue Management
              </h3>
              <p className="text-[11px] sm:text-xs text-slate-500 leading-relaxed mt-1">
                Handle multiple sessions & shifts
              </p>
            </div>

            {/* Feature 2 */}
            <div 
              onClick={() => setActiveFeature(activeFeature === 2 ? null : 2)}
              className={`p-3.5 sm:p-5 rounded-2xl border transition cursor-pointer active:scale-98 ${
                activeFeature === 2
                  ? 'bg-teal-50 border-teal-300 ring-2 ring-teal-500/20 shadow-xs'
                  : 'bg-white border-slate-200/70 hover:border-teal-300 hover:shadow-xs'
              }`}
            >
              <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl sm:rounded-2xl bg-teal-100/80 text-teal-700 flex items-center justify-center shadow-2xs mb-2.5">
                <Clock className="w-5 h-5" />
              </div>
              <h3 className="font-extrabold text-xs sm:text-base text-slate-900 leading-snug">
                Real-time Updates
              </h3>
              <p className="text-[11px] sm:text-xs text-slate-500 leading-relaxed mt-1">
                Live token status & alerts
              </p>
            </div>

            {/* Feature 3 */}
            <div 
              onClick={() => setActiveFeature(activeFeature === 3 ? null : 3)}
              className={`p-3.5 sm:p-5 rounded-2xl border transition cursor-pointer active:scale-98 ${
                activeFeature === 3
                  ? 'bg-emerald-50 border-emerald-300 ring-2 ring-emerald-500/20 shadow-xs'
                  : 'bg-white border-slate-200/70 hover:border-emerald-300 hover:shadow-xs'
              }`}
            >
              <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl sm:rounded-2xl bg-emerald-100/80 text-emerald-700 flex items-center justify-center shadow-2xs mb-2.5">
                <HeartPulse className="w-5 h-5" />
              </div>
              <h3 className="font-extrabold text-xs sm:text-base text-slate-900 leading-snug">
                Better Patient Care
              </h3>
              <p className="text-[11px] sm:text-xs text-slate-500 leading-relaxed mt-1">
                Less waiting, more comfort
              </p>
            </div>

            {/* Feature 4 */}
            <div 
              onClick={() => setActiveFeature(activeFeature === 4 ? null : 4)}
              className={`p-3.5 sm:p-5 rounded-2xl border transition cursor-pointer active:scale-98 ${
                activeFeature === 4
                  ? 'bg-cyan-50 border-cyan-300 ring-2 ring-cyan-500/20 shadow-xs'
                  : 'bg-white border-slate-200/70 hover:border-cyan-300 hover:shadow-xs'
              }`}
            >
              <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl sm:rounded-2xl bg-cyan-100/80 text-cyan-700 flex items-center justify-center shadow-2xs mb-2.5">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h3 className="font-extrabold text-xs sm:text-base text-slate-900 leading-snug">
                Secure & Reliable
              </h3>
              <p className="text-[11px] sm:text-xs text-slate-500 leading-relaxed mt-1">
                Hospital data is always safe
              </p>
            </div>
          </div>

          {/* 4. Trust Banner */}
          <div className="mt-8 sm:mt-12 bg-gradient-to-r from-emerald-50/90 via-teal-50/60 to-cyan-50/50 rounded-2xl border border-emerald-100/80 p-4 sm:p-5 flex items-center justify-between shadow-2xs overflow-hidden relative">
            <div className="flex items-center space-x-3 z-10 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center flex-shrink-0 shadow-2xs">
                <Building2 className="w-5 h-5" />
              </div>
              <span className="font-extrabold text-xs sm:text-sm text-slate-800 tracking-tight truncate">
                Trusted by 100+ hospitals across India
              </span>
            </div>

            {/* Subtle ECG Heartbeat Pulse Line Graphic */}
            <div className="hidden xs:block opacity-40 pr-2 flex-shrink-0">
              <svg 
                className="w-36 sm:w-48 h-7 sm:h-8 text-emerald-600 stroke-current fill-none stroke-2" 
                viewBox="0 0 200 40"
              >
                <path d="M0 20 H60 L70 5 L80 35 L90 10 L100 25 L110 20 H200" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>
        </div>
      </main>

      {/* 5. Sticky Floating Mobile Action Bar (App-like feel) */}
      <div className="sm:hidden fixed bottom-3 inset-x-3.5 z-40">
        <div className="bg-slate-900/90 backdrop-blur-md text-white p-1.5 rounded-2xl shadow-xl flex items-center justify-between border border-white/10">
          <button
            type="button"
            onClick={() => {
              setMobileTab('STAFF');
              focusLoginForm();
            }}
            className={`flex-1 py-2 px-3 text-xs font-black rounded-xl transition cursor-pointer flex items-center justify-center space-x-1.5 active:scale-95 ${
              mobileTab === 'STAFF' ? 'bg-[#064e3b] text-white shadow-xs' : 'text-slate-300 hover:text-white'
            }`}
          >
            <Stethoscope className="w-3.5 h-3.5" />
            <span>Staff Login</span>
          </button>
          
          <div className="w-px h-6 bg-white/20 mx-1"></div>
          
          <button
            type="button"
            onClick={() => {
              setMobileTab('PATIENT');
              setShowScanner(true);
            }}
            className={`flex-1 py-2 px-3 text-xs font-black rounded-xl transition cursor-pointer flex items-center justify-center space-x-1.5 active:scale-95 ${
              mobileTab === 'PATIENT' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-300 hover:text-white'
            }`}
          >
            <Camera className="w-3.5 h-3.5 text-emerald-300" />
            <span>Scan QR (Patient)</span>
          </button>
        </div>
      </div>

      {/* 6. QR Code Camera Scanner Modal */}
      {showScanner && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/75 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-sm w-full p-5 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center space-x-2 text-slate-800">
                <Camera className="w-5 h-5 text-emerald-600" />
                <h3 className="font-black text-sm">Scan Hospital QR Code</h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  stopCameraStream();
                  setShowScanner(false);
                }}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="relative aspect-square bg-slate-950 rounded-2xl overflow-hidden flex items-center justify-center shadow-inner">
              <video
                ref={videoRef}
                className="w-full h-full object-cover"
                autoPlay
                muted
                playsInline
              />
              {/* Viewfinder Target Frame */}
              <div className="absolute inset-8 border-2 border-dashed border-emerald-400/90 rounded-2xl pointer-events-none animate-pulse flex items-center justify-center">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-400"></div>
              </div>
              <div className="absolute bottom-3 inset-x-3 text-center">
                <span className="bg-black/60 backdrop-blur-xs text-white text-[11px] font-medium px-2.5 py-1 rounded-full border border-white/10">
                  {scannerStatus}
                </span>
              </div>
            </div>

            {cameraError && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-500" />
                <span className="leading-tight">{cameraError}</span>
              </div>
            )}

            <div className="flex items-center space-x-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 rounded-xl text-xs flex items-center justify-center space-x-1.5 cursor-pointer transition active:scale-95"
              >
                <Upload className="w-3.5 h-3.5 text-slate-500" />
                <span>Upload QR Photo from Gallery</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 8. Support Modal */}
      {showSupportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-sm w-full p-5 sm:p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2 text-slate-800">
                <HelpCircle className="w-5 h-5 text-emerald-600" />
                <h3 className="font-black text-base">Support & Helpdesk</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowSupportModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-600">
              <div className="p-3 bg-emerald-50 rounded-2xl border border-emerald-100 flex items-center space-x-3 text-emerald-900">
                <Phone className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                <div>
                  <div className="font-bold">Hospital Helpline</div>
                  <div className="text-[11px] text-emerald-700">+91 98765 43210 (24x7 Support)</div>
                </div>
              </div>

              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 flex items-center space-x-3 text-slate-800">
                <Mail className="w-4 h-4 text-slate-500 flex-shrink-0" />
                <div>
                  <div className="font-bold">Email Support</div>
                  <div className="text-[11px] text-slate-500">support@opdjob.com</div>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowSupportModal(false)}
              className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2 rounded-xl text-xs transition cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
