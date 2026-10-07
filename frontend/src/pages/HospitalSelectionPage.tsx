import React, { useState, useRef, useEffect } from 'react';
import { api } from '../services/api';
import { 
  Building2, 
  QrCode, 
  ArrowRight, 
  Search, 
  Camera, 
  Upload, 
  AlertCircle, 
  CheckCircle2, 
  Sparkles, 
  ShieldCheck, 
  Clock, 
  Users, 
  X,
  RefreshCw,
  Lock,
  Home
} from 'lucide-react';
import { LanguageToggle } from '../components/LanguageToggle';

interface HospitalSelectionPageProps {
  onSelectHospital: (slug: string) => void;
  onStaffLoginClick?: () => void;
}

export const HospitalSelectionPage: React.FC<HospitalSelectionPageProps> = ({
  onSelectHospital,
  onStaffLoginClick,
}) => {
  const [searchSlugOrCode, setSearchSlugOrCode] = useState<string>('');
  const [resolving, setResolving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // QR Scanner State
  const [showScanner, setShowScanner] = useState<boolean>(false);
  const [scannerStatus, setScannerStatus] = useState<string>('');
  const [cameraPermissionError, setCameraPermissionError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const scanIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Resolve Hospital by entered Slug or Access Code
  const handleResolveHospital = async (query: string) => {
    const clean = query.trim();
    if (!clean) {
      setError('Please enter your hospital slug or 6-digit access code.');
      return;
    }

    try {
      setResolving(true);
      setError(null);

      // Check if it's a full URL or path (e.g. pasted URL or QR result)
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

      throw new Error(`Hospital "${clean}" not found. Please verify the slug or access code on your prescription slip.`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Hospital not found. Please check your slug or access code.');
    } finally {
      setResolving(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleResolveHospital(searchSlugOrCode);
  };

  // Start Camera Stream for QR Scanner
  const startCamera = async () => {
    setCameraPermissionError(null);
    setScannerStatus('Starting camera...');
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera access is not supported in this browser environment. You can upload a photo of the QR code instead.');
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      mediaStreamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      setScannerStatus('Align QR code within the frame to scan');

      // Check if BarcodeDetector is available
      if ('BarcodeDetector' in window) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const barcodeDetector = new (window as any).BarcodeDetector({ formats: ['qr_code'] });
        scanIntervalRef.current = setInterval(async () => {
          if (videoRef.current && videoRef.current.readyState >= 2) {
            try {
              const barcodes = await barcodeDetector.detect(videoRef.current);
              if (barcodes.length > 0) {
                const rawValue = barcodes[0].rawValue;
                if (rawValue) {
                  stopCamera();
                  setShowScanner(false);
                  handleResolveHospital(rawValue);
                }
              }
            } catch {
              // Frame scanning quiet fallback
            }
          }
        }, 300);
      } else {
        setScannerStatus('Point camera at QR code, or take/upload a photo below for instant recognition.');
      }
    } catch (err: unknown) {
      setCameraPermissionError(
        err instanceof Error ? err.message : 'Unable to access camera. Please allow camera permissions or upload a QR image.'
      );
      stopCamera();
    }
  };

  const stopCamera = () => {
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  // Clean up camera on unmount or modal close
  useEffect(() => {
    if (showScanner) {
      startCamera();
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [showScanner]);

  // Handle Photo/Image File Upload for QR Decoding
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setResolving(true);
      setError(null);
      setScannerStatus('Analyzing QR code image...');

      // Try native BarcodeDetector if available
      if ('BarcodeDetector' in window) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const barcodeDetector = new (window as any).BarcodeDetector({ formats: ['qr_code'] });
        const img = new Image();
        img.src = URL.createObjectURL(file);
        await new Promise((resolve) => (img.onload = resolve));
        const barcodes = await barcodeDetector.detect(img);
        if (barcodes.length > 0 && barcodes[0].rawValue) {
          stopCamera();
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
      if (data && data[0]?.symbol?.[0]?.data) {
        const decoded = data[0].symbol[0].data;
        stopCamera();
        setShowScanner(false);
        handleResolveHospital(decoded);
        return;
      }

      throw new Error('No QR code detected in the uploaded image. Please try a clearer picture or enter the hospital slug manually.');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to scan QR code image. Please type your hospital slug.');
    } finally {
      setResolving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-emerald-50/20 to-slate-100 flex flex-col font-sans text-slate-800">
      {/* Floating Top Pill Navbar matching media_1791394408054.png */}
      <header className="sticky top-3 z-30 px-3 sm:px-6 max-w-xl mx-auto w-full pt-1">
        <div className="bg-white/90 backdrop-blur-xl border border-slate-200/80 shadow-lg shadow-slate-200/50 rounded-full px-4 sm:px-5 py-2 sm:py-2.5 flex items-center justify-between gap-2">
          {/* Left: Green Live Pulse Indicator + OPD Token */}
          <div className="flex items-center space-x-2.5 min-w-0">
            <span className="relative flex h-3 w-3 flex-shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
            </span>
            <div className="flex items-center space-x-1.5 truncate">
              <span className="font-black text-sm sm:text-base text-slate-900 tracking-tight">
                OPD Token
              </span>
              <span className="hidden xs:inline-block bg-emerald-50 text-emerald-700 text-[10px] font-extrabold px-1.5 py-0.5 rounded-full border border-emerald-200">
                LIVE
              </span>
            </div>
          </div>

          {/* Right: Language Switcher & Staff Login Pill */}
          <div className="flex items-center space-x-2 flex-shrink-0">
            <LanguageToggle />
            {onStaffLoginClick && (
              <button
                type="button"
                onClick={onStaffLoginClick}
                className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs px-3.5 py-1.5 rounded-full shadow-sm transition active:scale-95 cursor-pointer flex items-center space-x-1"
                title="Hospital Staff & Doctor Login"
              >
                <span>Staff Login</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Welcome & Hospital Access Area */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-3.5 sm:px-6 py-5 sm:py-8 pb-32 flex flex-col justify-center space-y-6 sm:space-y-8">
        {/* Hero Title */}
        <div className="text-center space-y-2.5 sm:space-y-3">
          <div className="inline-flex items-center space-x-2 bg-emerald-100 text-emerald-800 text-xs font-extrabold px-3.5 py-1.5 rounded-full shadow-2xs border border-emerald-200">
            <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
            <span>Digital OPD Token Generation</span>
          </div>
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-black text-slate-900 tracking-tight leading-snug">
            Open Your Hospital's OPD Token Panel
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 max-w-xl mx-auto leading-relaxed">
            Enter your hospital's slug or 6-digit access code, or scan your hospital's OPD QR code to book and track your live token.
          </p>
        </div>

        {/* Global Error Banner */}
        {error && (
          <div className="p-3.5 sm:p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl text-xs sm:text-sm flex items-start justify-between shadow-xs">
            <div className="flex items-start space-x-2.5">
              <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Unable to open hospital</p>
                <p className="text-xs text-rose-700 mt-0.5">{error}</p>
              </div>
            </div>
            <button
              onClick={() => setError(null)}
              className="text-rose-500 hover:text-rose-800 font-bold text-base ml-2 cursor-pointer"
            >
              &times;
            </button>
          </div>
        )}

        {/* The 2 Primary Access Cards (Search Slug/Code OR Scan QR) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6">
          {/* Option 1: Search Hospital Slug or Access Code */}
          <div className="bg-white rounded-3xl p-5 sm:p-7 border border-slate-200 shadow-sm hover:shadow-md transition flex flex-col justify-between space-y-4 sm:space-y-5">
            <div className="space-y-3">
              <div className="w-11 h-11 sm:w-12 sm:h-12 bg-emerald-100 text-emerald-700 rounded-2xl flex items-center justify-center shadow-xs">
                <Search className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-black text-slate-900">
                  Search Hospital Slug or Code
                </h2>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  Enter your hospital's dedicated slug or 6-digit access code from your appointment slip or hospital board.
                </p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3.5">
              <div className="relative">
                <Building2 className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                <input
                  id="hospital-search-input"
                  type="text"
                  required
                  placeholder="Enter hospital slug or 6-digit code"
                  value={searchSlugOrCode}
                  onChange={(e) => setSearchSlugOrCode(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:bg-white focus:border-emerald-600 outline-none transition"
                />
              </div>

              <button
                type="submit"
                disabled={resolving || !searchSlugOrCode.trim()}
                className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white font-black py-3.5 rounded-xl shadow-md transition text-sm flex items-center justify-center space-x-2 cursor-pointer active:scale-[0.99]"
              >
                {resolving ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Resolving Hospital...</span>
                  </>
                ) : (
                  <>
                    <span>Open Hospital OPD Panel</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            <div className="text-[11px] text-slate-400 pt-2 border-t border-slate-100 flex items-center justify-between">
              <span>Direct isolated clinic portal</span>
              <span className="font-bold text-emerald-700">Instant Access</span>
            </div>
          </div>

          {/* Option 2: Scan Hospital QR Code */}
          <div className="bg-white rounded-3xl p-5 sm:p-7 border border-slate-200 shadow-sm hover:shadow-md transition flex flex-col justify-between space-y-4 sm:space-y-5">
            <div className="space-y-3">
              <div className="w-11 h-11 sm:w-12 sm:h-12 bg-teal-100 text-teal-700 rounded-2xl flex items-center justify-center shadow-xs">
                <QrCode className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-black text-slate-900">
                  Scan Hospital QR Code
                </h2>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  Use your camera to scan the OPD QR code displayed at the hospital reception, entrance banner, or appointment card.
                </p>
              </div>
            </div>

            <div className="space-y-2.5">
              <button
                type="button"
                onClick={() => setShowScanner(true)}
                className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-3.5 rounded-xl shadow-md transition text-sm flex items-center justify-center space-x-2.5 cursor-pointer active:scale-[0.99]"
              >
                <Camera className="w-4 h-4 text-emerald-400" />
                <span>Open Camera QR Scanner</span>
              </button>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold py-2.5 rounded-xl transition text-xs flex items-center justify-center space-x-2 cursor-pointer border border-slate-200"
              >
                <Upload className="w-3.5 h-3.5 text-slate-500" />
                <span>Upload or Take QR Photo</span>
              </button>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleFileUpload}
                className="hidden"
              />
            </div>

            <div className="text-[11px] text-slate-400 pt-2 border-t border-slate-100 flex items-center justify-between">
              <span>Automatic QR recognition</span>
              <span className="font-bold text-teal-700">Camera & Photo</span>
            </div>
          </div>
        </div>

        {/* Feature Highlights Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 pt-2">
          <div className="bg-white/80 rounded-2xl p-3.5 sm:p-4 border border-slate-200/80 shadow-2xs flex items-center space-x-3.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center flex-shrink-0">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <p className="font-bold text-xs text-slate-900">Wait From Home</p>
              <p className="text-[11px] text-slate-500">Track real-time room turns live</p>
            </div>
          </div>

          <div className="bg-white/80 rounded-2xl p-3.5 sm:p-4 border border-slate-200/80 shadow-2xs flex items-center space-x-3.5">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center flex-shrink-0">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <p className="font-bold text-xs text-slate-900">No Reception Lines</p>
              <p className="text-[11px] text-slate-500">Direct entry to doctor room</p>
            </div>
          </div>

          <div className="bg-white/80 rounded-2xl p-3.5 sm:p-4 border border-slate-200/80 shadow-2xs flex items-center space-x-3.5">
            <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center flex-shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <p className="font-bold text-xs text-slate-900">100% Free For Citizens</p>
              <p className="text-[11px] text-slate-500">Zero booking charge</p>
            </div>
          </div>
        </div>
      </main>

      {/* QR Camera Scanner Modal */}
      {showScanner && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Camera className="w-5 h-5 text-emerald-600" />
                <h3 className="font-black text-base text-slate-900">Scan Hospital QR Code</h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  stopCamera();
                  setShowScanner(false);
                }}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Video Viewfinder Container */}
            <div className="relative bg-slate-950 rounded-2xl overflow-hidden aspect-square flex items-center justify-center">
              <video
                ref={videoRef}
                playsInline
                muted
                className="w-full h-full object-cover"
              />

              {/* Target Scan Reticle Overlay */}
              <div className="absolute inset-8 border-2 border-emerald-400/80 rounded-2xl pointer-events-none flex items-center justify-center shadow-lg">
                <div className="w-full h-0.5 bg-emerald-400 animate-pulse"></div>
              </div>

              {cameraPermissionError && (
                <div className="absolute inset-0 bg-slate-900/90 flex flex-col items-center justify-center p-6 text-center space-y-3">
                  <AlertCircle className="w-8 h-8 text-rose-400" />
                  <p className="text-xs text-slate-200">{cameraPermissionError}</p>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="bg-emerald-600 text-white font-bold text-xs px-4 py-2 rounded-xl transition"
                  >
                    Upload QR Photo Instead
                  </button>
                </div>
              )}
            </div>

            <p className="text-xs text-center text-slate-500 font-medium">
              {scannerStatus || 'Point camera directly at the hospital QR code'}
            </p>

            <button
              type="button"
              onClick={() => {
                stopCamera();
                setShowScanner(false);
              }}
              className="w-full py-2.5 text-xs font-bold text-slate-600 hover:text-slate-900 bg-slate-100 rounded-xl transition cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="border-t border-slate-200 py-6 pb-28 text-center text-xs text-slate-500 bg-white mt-auto">
        <div className="max-w-7xl mx-auto px-4">
          <p className="font-semibold text-slate-700">Digital OPD Remote Token Platform</p>
          <p className="text-[11px] text-slate-400 mt-1">
            Hospitals manage their queues via isolated administration panels. Citizens access OPD directly via hospital slug or QR code.
          </p>
        </div>
      </footer>

      {/* Floating Glassmorphic Bottom Dock matching media_1791394345222.png */}
      <nav aria-label="Quick Navigation" className="fixed bottom-4 inset-x-0 z-40 px-4 pointer-events-none">
        <div className="max-w-md mx-auto bg-white/90 backdrop-blur-2xl border border-white/80 shadow-2xl shadow-emerald-950/20 rounded-full px-4 sm:px-6 py-1.5 sm:py-2 flex items-center justify-around pointer-events-auto relative">
          {/* Home Button */}
          <button
            type="button"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="flex flex-col items-center justify-center text-slate-600 hover:text-emerald-700 active:scale-95 transition py-1 px-2 cursor-pointer group"
          >
            <Home className="w-5 h-5 group-hover:scale-110 transition-transform" />
            <span className="text-[10px] font-bold mt-0.5">Home</span>
          </button>

          {/* Search Hospital Code */}
          <button
            type="button"
            onClick={() => {
              const input = document.getElementById('hospital-search-input');
              if (input) {
                input.focus();
                input.scrollIntoView({ behavior: 'smooth', block: 'center' });
              }
            }}
            className="flex flex-col items-center justify-center text-slate-600 hover:text-emerald-700 active:scale-95 transition py-1 px-2 cursor-pointer group"
          >
            <Search className="w-5 h-5 group-hover:scale-110 transition-transform" />
            <span className="text-[10px] font-bold mt-0.5">Code</span>
          </button>

          {/* Center Elevated Scan QR Button */}
          <div className="relative -top-5 flex flex-col items-center">
            <button
              type="button"
              onClick={() => setShowScanner(true)}
              className="w-14 h-14 rounded-full bg-gradient-to-tr from-emerald-600 to-teal-500 text-white shadow-xl shadow-emerald-600/40 border-4 border-white flex items-center justify-center hover:scale-105 active:scale-95 transition-all cursor-pointer group"
              title="Scan Hospital QR Code"
            >
              <QrCode className="w-6 h-6 group-hover:rotate-6 transition-transform" />
            </button>
            <span className="text-[10px] font-black text-emerald-800 mt-1">Scan QR</span>
          </div>

          {/* Upload QR Photo Button */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex flex-col items-center justify-center text-slate-600 hover:text-emerald-700 active:scale-95 transition py-1 px-2 cursor-pointer group"
          >
            <Upload className="w-5 h-5 group-hover:scale-110 transition-transform" />
            <span className="text-[10px] font-bold mt-0.5">Upload</span>
          </button>

          {/* Staff Login Button */}
          {onStaffLoginClick && (
            <button
              type="button"
              onClick={onStaffLoginClick}
              className="flex flex-col items-center justify-center text-slate-600 hover:text-emerald-700 active:scale-95 transition py-1 px-2 cursor-pointer group"
            >
              <Lock className="w-5 h-5 group-hover:scale-110 transition-transform" />
              <span className="text-[10px] font-bold mt-0.5">Staff</span>
            </button>
          )}
        </div>
      </nav>
    </div>
  );
};
