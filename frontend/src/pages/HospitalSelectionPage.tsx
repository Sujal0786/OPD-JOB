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
  Lock
} from 'lucide-react';

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
      {/* Welcome Navbar */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center shadow-md">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <span className="font-black text-lg text-slate-900 tracking-tight block leading-tight">
                Digital OPD Token Generation Platform
              </span>
              <span className="text-[11px] font-bold text-emerald-600 block leading-none">
                Direct Citizen Token System • No Waiting in Queues
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <span className="hidden sm:inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-full text-xs font-bold text-emerald-800 bg-emerald-50 border border-emerald-200">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>OPD Active</span>
            </span>

            {onStaffLoginClick && (
              <button
                type="button"
                onClick={onStaffLoginClick}
                className="bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold px-3.5 py-2 rounded-xl transition flex items-center space-x-1.5 shadow-xs cursor-pointer active:scale-95"
                title="Hospital Staff & Doctor Login"
              >
                <Lock className="w-3.5 h-3.5 text-amber-400" />
                <span>Hospital Staff Login</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Welcome & Hospital Access Area */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-8 sm:py-12 flex flex-col justify-center space-y-8">
        {/* Hero Title */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center space-x-2 bg-emerald-100 text-emerald-800 text-xs font-extrabold px-3.5 py-1.5 rounded-full shadow-2xs">
            <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
            <span>Welcome to Digital OPD Token Generation</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
            Open Your Hospital's OPD Token Panel
          </h1>
          <p className="text-sm sm:text-base text-slate-600 max-w-xl mx-auto leading-relaxed">
            Enter your hospital's slug or access code, or scan your hospital's OPD QR code to book and track your live token.
          </p>
        </div>

        {/* Global Error Banner */}
        {error && (
          <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl text-xs sm:text-sm flex items-start justify-between shadow-xs">
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Option 1: Search Hospital Slug or Access Code */}
          <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200 shadow-md flex flex-col justify-between space-y-5">
            <div className="space-y-3">
              <div className="w-12 h-12 bg-emerald-100 text-emerald-700 rounded-2xl flex items-center justify-center shadow-xs">
                <Search className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-lg font-black text-slate-900">
                  Search Hospital Slug or Code
                </h2>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  Enter your hospital's dedicated slug (e.g. <span className="font-mono font-bold text-slate-700">apex-care</span>) or 6-digit access code from your appointment slip.
                </p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3.5">
              <div className="relative">
                <Building2 className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                <input
                  type="text"
                  required
                  placeholder="e.g. apex-care or 101202"
                  value={searchSlugOrCode}
                  onChange={(e) => setSearchSlugOrCode(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:bg-white focus:border-emerald-600 outline-none transition"
                />
              </div>

              <button
                type="submit"
                disabled={resolving || !searchSlugOrCode.trim()}
                className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white font-bold py-3.5 rounded-xl shadow-md transition text-sm flex items-center justify-center space-x-2 cursor-pointer active:scale-[0.99]"
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
          <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200 shadow-md flex flex-col justify-between space-y-5">
            <div className="space-y-3">
              <div className="w-12 h-12 bg-teal-100 text-teal-700 rounded-2xl flex items-center justify-center shadow-xs">
                <QrCode className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-lg font-black text-slate-900">
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
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4">
          <div className="bg-white/80 rounded-2xl p-4 border border-slate-200/80 shadow-2xs flex items-center space-x-3.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center flex-shrink-0">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <p className="font-bold text-xs text-slate-900">Wait From Home</p>
              <p className="text-[11px] text-slate-500">Track real-time room turns live</p>
            </div>
          </div>

          <div className="bg-white/80 rounded-2xl p-4 border border-slate-200/80 shadow-2xs flex items-center space-x-3.5">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center flex-shrink-0">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <p className="font-bold text-xs text-slate-900">No Reception Lines</p>
              <p className="text-[11px] text-slate-500">Direct entry to doctor room</p>
            </div>
          </div>

          <div className="bg-white/80 rounded-2xl p-4 border border-slate-200/80 shadow-2xs flex items-center space-x-3.5">
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
      <footer className="border-t border-slate-200 py-6 text-center text-xs text-slate-500 bg-white mt-auto">
        <div className="max-w-7xl mx-auto px-4">
          <p className="font-semibold text-slate-700">Digital OPD Remote Token Platform</p>
          <p className="text-[11px] text-slate-400 mt-1">
            Hospitals manage their queues via isolated administration panels. Citizens access OPD directly via hospital slug or QR code.
          </p>
        </div>
      </footer>
    </div>
  );
};
