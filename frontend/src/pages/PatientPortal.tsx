import React, { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '../services/api';
import { HospitalProfile, OpdSession, TokenResponse, LoginResponse } from '../types';
import { 
  Building2, 
  Stethoscope, 
  User, 
  Phone, 
  MapPin, 
  Clock, 
  Volume2, 
  ArrowLeft, 
  ArrowRight, 
  Ticket, 
  Users, 
  CheckCircle2, 
  Gift, 
  RefreshCw, 
  Sparkles,
  QrCode,
  ShieldCheck,
  BellRing,
  Search,
  Calendar
} from 'lucide-react';

interface PatientPortalProps {
  initialSlug?: string;
  currentUser?: LoginResponse | null;
  onDashboardClick?: () => void;
}

type ViewState = 'HOME' | 'DOCTOR_LIST' | 'CONFIRM_TOKEN' | 'MY_TOKEN' | 'VIEW_QUEUE';

export const PatientPortal: React.FC<PatientPortalProps> = ({ 
  initialSlug = '',
  currentUser,
  onDashboardClick
}) => {
  const [lang, setLang] = useState<'EN' | 'HI'>('EN');
  const [viewState, setViewState] = useState<ViewState>('HOME');
  const [hospital, setHospital] = useState<HospitalProfile | null>(null);
  const [sessions, setSessions] = useState<OpdSession[]>([]);
  const [selectedSession, setSelectedSession] = useState<OpdSession | null>(null);

  // Patient Registration Details
  const [patientName, setPatientName] = useState('');
  const [patientPhone, setPatientPhone] = useState('');
  const [patientLocation, setPatientLocation] = useState('');
  const [patientAge, setPatientAge] = useState('');
  const [patientGender, setPatientGender] = useState('MALE');
  const [reason, setReason] = useState('');

  // Token Lookup state for My Token
  const [lookupQuery, setLookupQuery] = useState('');
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupTokensList, setLookupTokensList] = useState<TokenResponse[]>([]);

  // Active Live Token
  const [activeToken, setActiveToken] = useState<TokenResponse | null>(null);
  const [retryingSms, setRetryingSms] = useState(false);
  const [smsRetryStatus, setSmsRetryStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sseRef = useRef<EventSource | null>(null);

  const handleRetrySms = async () => {
    if (!activeToken || retryingSms) return;
    try {
      setRetryingSms(true);
      setSmsRetryStatus(null);
      const updated = await api.retryTokenSms(activeToken.bookingReference);
      setActiveToken(updated);
      if (updated.smsSent) {
        setSmsRetryStatus(lang === 'HI' ? 'संदेश सफलतापूर्वक भेजा गया!' : 'SMS sent successfully!');
      } else {
        setSmsRetryStatus(updated.smsError || (lang === 'HI' ? 'संदेश भेजने में पुनः विफल।' : 'SMS delivery failed again.'));
      }
    } catch (err: unknown) {
      setSmsRetryStatus(err instanceof Error ? err.message : 'Failed to retry SMS');
    } finally {
      setRetryingSms(false);
    }
  };

  // Web Speech Audio Assistance
  const speakText = (text: string, langCode: 'en-IN' | 'hi-IN' = 'en-IN') => {
    try {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = lang === 'HI' ? 'hi-IN' : langCode;
        utterance.rate = 0.95;
        window.speechSynthesis.speak(utterance);
      }
    } catch (e) {
      console.log('TTS Error:', e);
    }
  };

  // Turn Alert Chime
  const playTurnChime = () => {
    try {
      const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
      osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.15); // E5
      osc.frequency.setValueAtTime(783.99, ctx.currentTime + 0.3); // G5
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.6);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.6);
    } catch (e) {
      console.log('Chime error:', e);
    }
  };

  // Load hospital context and today's sessions
  useEffect(() => {
    loadHospitalData(initialSlug);
  }, [initialSlug]);

  const refreshSessions = useCallback(async (hId?: string) => {
    const id = hId || hospital?.id;
    if (!id) return;
    try {
      const freshSessions = await api.getPatientTodaySessions(id);
      setSessions(freshSessions);
      setSelectedSession((prev) => {
        if (!prev) return freshSessions[0] || null;
        const matched = freshSessions.find((s) => s.id === prev.id);
        return matched || prev;
      });
    } catch {
      // Quiet background refresh fallback
    }
  }, [hospital?.id]);

  const loadHospitalData = async (slugToLoad: string) => {
    try {
      setLoading(true);
      setError(null);
      let targetSlug = slugToLoad?.trim();
      if (!targetSlug) {
        const params = new URLSearchParams(window.location.search);
        targetSlug = params.get('slug') || params.get('hospital') || '';
      }

      let h: HospitalProfile | null = null;
      if (targetSlug) {
        h = await api.resolveHospitalBySlug(targetSlug);
      } else {
        throw new Error('No hospital specified. Please choose a hospital from the directory.');
      }

      setHospital(h);
      const sess = await api.getPatientTodaySessions(h.id);
      setSessions(sess);
      if (sess.length > 0 && !selectedSession) {
        setSelectedSession(sess[0]);
      }

      // Check tenant-scoped saved token reference
      const tokenKey = `opd_patient_token_ref_${h.id}`;
      const savedBookingRef = localStorage.getItem(tokenKey) || localStorage.getItem('opd_patient_token_ref') || localStorage.getItem('citycare_patient_token_ref');
      if (savedBookingRef) {
        api.getTokenByReference(savedBookingRef)
          .then(t => setActiveToken(t))
          .catch(() => {
            localStorage.removeItem(tokenKey);
            localStorage.removeItem('opd_patient_token_ref');
            localStorage.removeItem('citycare_patient_token_ref');
          });
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Hospital not found');
    } finally {
      setLoading(false);
    }
  };

  // Live Queue Synchronization: Cross-tab BroadcastChannel, Storage Events, Tab Focus, and Background Polling
  useEffect(() => {
    if (!hospital?.id) return;

    // 1. Cross-tab BroadcastChannel sync
    let bc: BroadcastChannel | null = null;
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        bc = new BroadcastChannel(`opd_queue_sync_${hospital.id}`);
        bc.onmessage = () => {
          refreshSessions(hospital.id);
        };
      }
    } catch (_) {}

    // 2. Storage event listener (when another tab updates localStorage)
    const handleStorage = (e: StorageEvent) => {
      if (e.key === `opd_last_token_sync_${hospital.id}` || e.key === 'opd_last_token_sync') {
        refreshSessions(hospital.id);
      }
    };
    window.addEventListener('storage', handleStorage);

    // 3. Tab visibility and focus listener (instantly refreshes when patient switches to tab)
    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === 'visible') {
        refreshSessions(hospital.id);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityOrFocus);
    window.addEventListener('focus', handleVisibilityOrFocus);

    // 4. Background polling (every 3 seconds when tab is active)
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        refreshSessions(hospital.id);
      }
    }, 3000);

    return () => {
      if (bc) bc.close();
      window.removeEventListener('storage', handleStorage);
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
      window.removeEventListener('focus', handleVisibilityOrFocus);
      clearInterval(interval);
    };
  }, [hospital?.id, refreshSessions]);

  // SSE Subscription for live patient token
  useEffect(() => {
    if (!activeToken) return;

    if (sseRef.current) {
      sseRef.current.close();
    }

    const sse = new EventSource(`/api/v1/patient/tokens/${activeToken.bookingReference}/stream`);
    sseRef.current = sse;

    sse.addEventListener('TOKEN_UPDATED', (e) => {
      try {
        const updated: TokenResponse = JSON.parse(e.data);
        if (updated.status === 'CALLED' && activeToken.status !== 'CALLED') {
          playTurnChime();
          speakText(
            lang === 'HI'
              ? `टोकन नंबर ${updated.tokenNumber}, आपकी बारी आ गई है। कृपया कमरा नंबर ${updated.doctorRoomNumber} में जाएं।`
              : `Token number ${updated.tokenNumber}, it is your turn. Please enter room ${updated.doctorRoomNumber}.`
          );
        }
        setActiveToken(updated);
      } catch (err) {
        console.error('SSE JSON error', err);
      }
    });

    sse.onerror = () => {
      api.getTokenByReference(activeToken.bookingReference)
        .then(t => setActiveToken(t))
        .catch(console.error);
    };

    return () => {
      sse.close();
    };
  }, [activeToken?.bookingReference, lang]);

  // Handle Token Booking
  const handleConfirmBooking = async () => {
    if (!hospital || !selectedSession) return;
    if (!patientName.trim()) {
      alert(lang === 'HI' ? 'कृपया अपना नाम दर्ज करें' : 'Please enter patient name');
      return;
    }
    if (patientPhone.length < 10) {
      alert(lang === 'HI' ? 'कृपया 10 अंकों का मोबाइल नंबर दर्ज करें' : 'Please enter valid 10-digit phone number');
      return;
    }
    if (!patientLocation.trim()) {
      alert(lang === 'HI' ? 'कृपया अपना शहर / गाँव / पता दर्ज करें' : 'Please enter your location (City/Village/Address)');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const token = await api.bookToken({
        hospitalId: hospital.id,
        opdSessionId: selectedSession.id,
        patientName: patientName.trim(),
        patientPhone: patientPhone.trim(),
        patientLocation: patientLocation.trim(),
        patientAge: parseInt(patientAge) || 30,
        patientGender,
        reasonForVisit: reason.trim(),
        idempotencyKey: `online-${Date.now()}-${patientPhone}`,
      });

      setActiveToken(token);
      localStorage.setItem(`opd_patient_token_ref_${hospital.id}`, token.bookingReference);
      localStorage.setItem('opd_patient_token_ref', token.bookingReference);
      localStorage.removeItem('citycare_patient_token_ref');

      // Instant cross-tab sync: Notify Hospital Dashboard tab without requiring manual page refresh
      try {
        if (typeof BroadcastChannel !== 'undefined') {
          const bc = new BroadcastChannel(`opd_queue_sync_${hospital.id}`);
          bc.postMessage({
            type: 'TOKEN_CREATED',
            hospitalId: hospital.id,
            sessionId: selectedSession.id,
            tokenNumber: token.tokenNumber,
            patientName: token.patientName,
            tokenType: token.tokenType,
            doctorName: token.doctorName,
            timestamp: Date.now(),
          });
          bc.close();
        }
      } catch (e) {
        // Quiet fallback
      }
      localStorage.setItem(`opd_last_token_sync_${hospital.id}`, `${Date.now()}_${token.tokenNumber}`);
      localStorage.removeItem('citycare_last_token_sync');

      setViewState('MY_TOKEN');

      speakText(
        lang === 'HI'
          ? `आपका टोकन नंबर ${token.tokenNumber} बुक हो गया है। डॉक्टर ${token.doctorName}।`
          : `Your token number ${token.tokenNumber} is confirmed for Doctor ${token.doctorName}.`
      );
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Booking failed');
    } finally {
      setLoading(false);
    }
  };

  const handleLookupToken = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lookupQuery.trim() || !hospital) return;
    try {
      setLookupLoading(true);
      setError(null);
      setLookupTokensList([]);
      const clean = lookupQuery.trim();

      // Check if user entered phone number (10 digits)
      const digitsOnly = clean.replace(/\D/g, '');
      if (digitsOnly.length === 10) {
        const tokens = await api.getTokensByPhone(hospital.slug, digitsOnly);
        if (tokens.length === 1) {
          setActiveToken(tokens[0]);
          localStorage.setItem(`opd_patient_token_ref_${hospital.id}`, tokens[0].bookingReference);
          localStorage.setItem('opd_patient_token_ref', tokens[0].bookingReference);
          localStorage.removeItem('citycare_patient_token_ref');
        } else if (tokens.length > 1) {
          setLookupTokensList(tokens);
        } else {
          setError(lang === 'HI' ? 'इस मोबाइल नंबर के लिए आज कोई सक्रिय टोकन नहीं मिला।' : 'No active token found for this phone number today.');
        }
      } else {
        const token = await api.getTokenByReference(clean);
        setActiveToken(token);
        localStorage.setItem(`opd_patient_token_ref_${hospital.id}`, token.bookingReference);
        localStorage.setItem('opd_patient_token_ref', token.bookingReference);
        localStorage.removeItem('citycare_patient_token_ref');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : (lang === 'HI' ? 'टोकन नहीं मिला' : 'Token reference not found'));
    } finally {
      setLookupLoading(false);
    }
  };

  const t = {
    EN: {
      digitalPortal: 'Digital OPD Portal • Direct Home Token System',
      bookFromHomeTitle: 'Book Your Doctor Token From Home',
      bookFromHomeSub: 'No lines at reception. Book token, wait at home, arrive when turn is near.',
      listen: 'LISTEN',
      freeBanner: '100% FREE OPD TOKENS',
      freeSub: 'Zero booking fees • Always 100% free for all citizens',
      viewDocsAndBook: 'View Doctors & Book',
      docsAvailable: `${sessions.length} Doctors Available Today`,
      myToken: 'My Token',
      checkLiveToken: 'Check live token status',
      viewQueue: 'View Queue',
      realtimeStatus: 'Real-time room status',
      todayOpdDoctors: `TODAY'S OPD DOCTORS AT ${hospital?.name || 'HOSPITAL'}`,
      liveOpd: 'Live OPD',
      chooseDoctorTitle: 'Choose Doctor For Token',
      tapToBookNotice: 'Tap doctor photo to book OPD token:',
      availableToday: 'Available Today',
      currentToken: 'Current Token',
      peopleWaiting: 'People Waiting',
      nextAvailableToken: 'Next Available Token',
      walkInsNotice: 'Reception Walk-Ins in queue ahead',
      getTokenBtn: 'GET TOKEN 👉',
      confirmTokenTitle: 'Confirm Doctor Token',
      room: 'Room',
      todayOpdStatus: "TODAY'S OPD STATUS",
      confirmAndGetToken: (num: number) => `CONFIRM & GET OPD TOKEN #${num} ➔`,
      namePlaceholder: 'Full Name (e.g. Aman Kumar)',
      phonePlaceholder: '10-Digit Mobile Number',
      locationLabel: 'Location / City / Village / Address *',
      locationPlaceholder: 'e.g. Sector 14, Gurugram or Village Rampur',
      calledAlert: "IT IS YOUR TURN! Please enter the doctor's room now.",
      yourToken: 'Your OPD Token',
      patientsAhead: 'Patients Ahead',
      estWait: 'Estimated Wait',
      changeDoc: 'Book Another Token',
      directEntry: 'Generate token at home. Direct entry into doctor room when called.',
      speechPrompt: `Welcome to ${hospital?.name || 'the hospital'}. You can book your doctor OPD token from home. No need to stand in long queues at the reception.`,
    },
    HI: {
      digitalPortal: 'डिजिटल ओपीडी पोर्टल • घर से टोकन प्रणाली',
      bookFromHomeTitle: 'घर बैठे डॉक्टर का टोकन लें',
      bookFromHomeSub: 'अस्पताल में लाइन लगाने की ज़रूरत नहीं। घर बैठे टोकन लें, जब नंबर आए तभी अस्पताल पहुंचें।',
      listen: 'सुनें',
      freeBanner: '100% मुफ़्त ओपीडी टोकन (FREE)',
      freeSub: 'कोई शुल्क नहीं • सभी नागरिकों के लिए पूरी तरह फ्री',
      viewDocsAndBook: 'डॉक्टर देखें व टोकन लें',
      docsAvailable: `आज ${sessions.length} डॉक्टर उपलब्ध हैं`,
      myToken: 'मेरा टोकन',
      checkLiveToken: 'टोकन का लाइव स्टेटस देखें',
      viewQueue: 'कतार देखें',
      realtimeStatus: 'कमरे की लाइव स्थिति',
      todayOpdDoctors: `आज के ओपीडी डॉक्टर - ${hospital?.name || 'अस्पताल'}`,
      liveOpd: 'लाइव ओपीडी',
      chooseDoctorTitle: 'टोकन के लिए डॉक्टर चुनें',
      tapToBookNotice: 'ओपीडी टोकन के लिए डॉक्टर चुनें:',
      availableToday: 'आज उपलब्ध हैं',
      currentToken: 'अभी टोकन',
      peopleWaiting: 'इंतज़ार में',
      nextAvailableToken: 'अगला उपलब्ध टोकन',
      walkInsNotice: 'अस्पताल में पहले से आए मरीज़ आगे हैं',
      getTokenBtn: 'टोकन लें 👉',
      confirmTokenTitle: 'डॉक्टर टोकन की पुष्टि करें',
      room: 'कमरा नंबर',
      todayOpdStatus: 'आज की ओपीडी स्थिति (लाइव)',
      confirmAndGetToken: (num: number) => `पुष्टि करें और टोकन #${num} लें ➔`,
      namePlaceholder: 'मरीज़ का पूरा नाम (उदा. अमन कुमार)',
      phonePlaceholder: '10 अंकों का मोबाइल नंबर',
      locationLabel: 'स्थान / शहर / गाँव / पता *',
      locationPlaceholder: 'उदा. सेक्टर 14 या रामपुर गाँव',
      calledAlert: 'आपकी बारी आ गई है! कृपया डॉक्टर के कमरे में अंदर जाएं।',
      yourToken: 'आपका ओपीडी टोकन',
      patientsAhead: 'आपसे पहले मरीज़',
      estWait: 'अनुमानित समय',
      changeDoc: 'नया टोकन बुक करें',
      directEntry: 'घर बैठे टोकन बनाएं। नंबर आने पर सीधा डॉक्टर के कमरे में जाएं।',
      speechPrompt: `${hospital?.name || 'अस्पताल'} में आपका स्वागत है। आप घर बैठे अपने डॉक्टर का ओपीडी टोकन ले सकते हैं। अस्पताल में लाइन में खड़े होने की कोई आवश्यकता नहीं है।`,
    }
  }[lang];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {/* ========================================================================= */}
      {/* FULL-WIDTH RESPONSIVE NAVBAR PANEL (LAPTOP EDGE-TO-EDGE)                  */}
      {/* ========================================================================= */}
      <header className="bg-emerald-700 text-white shadow-md w-full sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            {viewState !== 'HOME' && (
              <button
                onClick={() => {
                  if (viewState === 'CONFIRM_TOKEN') {
                    setViewState('DOCTOR_LIST');
                  } else if (viewState === 'MY_TOKEN' && activeToken) {
                    setActiveToken(null);
                    setLookupQuery('');
                    setLookupTokensList([]);
                  } else {
                    setViewState('HOME');
                  }
                }}
                className="p-1.5 -ml-1.5 text-white hover:bg-emerald-800 rounded-xl transition cursor-pointer"
                title="Back"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-xs flex-shrink-0">
              <Building2 className="w-6 h-6 text-emerald-100" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="font-extrabold text-base md:text-xl leading-tight tracking-tight">
                  {hospital ? hospital.name : 'Hospital OPD'}
                </h1>
                <span className="bg-emerald-800/80 text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded border border-emerald-600/50">
                  OPD LIVE
                </span>
              </div>
              <p className="text-xs text-emerald-100 font-medium hidden sm:block">
                {t.digitalPortal}
              </p>
            </div>
          </div>

          {/* Header Action Controls */}
          <div className="flex items-center space-x-2 sm:space-x-2.5">
            <button
              onClick={() => setLang(lang === 'EN' ? 'HI' : 'EN')}
              className="bg-emerald-800/90 hover:bg-emerald-900 text-xs md:text-sm font-bold px-3 py-1.5 rounded-xl border border-emerald-600 transition flex items-center space-x-1 cursor-pointer shadow-xs"
            >
              <span>{lang === 'EN' ? 'हिंदी' : 'English'}</span>
            </button>

            {currentUser && onDashboardClick && (
              <button
                onClick={onDashboardClick}
                className="bg-white text-emerald-900 hover:bg-emerald-50 text-xs md:text-sm font-black px-3.5 py-1.5 rounded-xl transition flex items-center space-x-1.5 cursor-pointer shadow-md border border-emerald-300"
                title="Return to Staff Dashboard"
              >
                <Building2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>Dashboard ({currentUser.hospitalSlug || 'Staff'})</span>
              </button>
            )}
          </div>
        </div>

        {/* Contact & Location Strip directly under navbar */}
        <div className="bg-emerald-800/90 border-t border-emerald-600/40 px-4 sm:px-6 lg:px-8 py-2 text-xs text-emerald-100">
          <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-y-1 gap-x-4">
            {hospital?.address && (
              <div className="flex items-center space-x-1.5">
                <MapPin className="w-4 h-4 text-emerald-300 flex-shrink-0" />
                <span>{hospital.address}</span>
              </div>
            )}
            <div className="flex items-center space-x-1.5">
              <Clock className="w-4 h-4 text-emerald-300 flex-shrink-0" />
              <span>08:00 AM - 08:00 PM</span>
            </div>
            {hospital?.phone && (
              <div className="flex items-center space-x-1.5">
                <Phone className="w-4 h-4 text-emerald-300 flex-shrink-0" />
                <span>{hospital.phone}</span>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Area: Responsive container up to max-w-7xl on laptop / desktop */}
      <main className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 flex-1 space-y-6">
        {/* Global Error Banner */}
        {error && (
          <div className="p-3.5 bg-red-50 border border-red-200 text-red-700 text-xs md:text-sm rounded-xl flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="font-bold text-base ml-2">&times;</button>
          </div>
        )}

          {/* ========================================================================= */}
          {/* SCREEN 1: HOME PAGE */}
          {/* ========================================================================= */}
          {viewState === 'HOME' && (
            <>
              {/* Top Banners Responsive Row (Laptop: 2-column or stacked) */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Hero Banner Card (Spans 2 cols on desktop) */}
                <div className="md:col-span-2 bg-gradient-to-r from-emerald-50/70 to-teal-50/50 rounded-2xl p-5 border border-emerald-100/90 flex flex-col justify-between shadow-xs">
                  <div className="flex items-start justify-between">
                    <div className="pr-3">
                      <h2 className="text-base md:text-xl font-extrabold text-slate-900 leading-snug">
                        {t.bookFromHomeTitle}
                      </h2>
                      <p className="text-xs md:text-sm text-slate-600 mt-1.5 leading-relaxed">
                        {t.bookFromHomeSub}
                      </p>
                    </div>
                    <button
                      onClick={() => speakText(t.speechPrompt)}
                      className="flex-shrink-0 bg-white hover:bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs md:text-sm font-bold px-3 py-1.5 rounded-xl flex items-center space-x-1.5 transition shadow-xs cursor-pointer"
                    >
                      <Volume2 className="w-4 h-4 text-emerald-600" />
                      <span>{t.listen}</span>
                    </button>
                  </div>
                </div>

                {/* Free Tier Promotion Card */}
                <div className="bg-emerald-50/80 border border-emerald-200/90 rounded-2xl p-5 flex flex-col justify-between shadow-xs">
                  <div className="flex items-center justify-between">
                    <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center flex-shrink-0">
                      <Gift className="w-5 h-5" />
                    </div>
                    <span className="bg-emerald-700 text-white font-black text-xs md:text-sm px-3 py-1 rounded-lg shadow-xs">
                      100% FREE
                    </span>
                  </div>
                  <div className="mt-3">
                    <h4 className="text-xs md:text-sm font-black text-emerald-950 uppercase tracking-tight">
                      {t.freeBanner}
                    </h4>
                    <p className="text-xs text-emerald-800 font-medium mt-0.5">
                      {t.freeSub}
                    </p>
                  </div>
                </div>
              </div>

              {/* ===================================================================== */}
              {/* THE 3 PRIMARY ACTION CARDS (Laptop: 3-column equal grid) */}
              {/* ===================================================================== */}
              <div>
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider mb-3">
                  Quick Actions
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                  {/* 1. Generate Token / View Doctors & Book */}
                  <div
                    onClick={() => setViewState('DOCTOR_LIST')}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white p-5 rounded-2xl shadow-md cursor-pointer transition flex items-center justify-between group active:scale-[0.99]"
                  >
                    <div className="flex items-center space-x-3.5">
                      <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0">
                        👨‍⚕️
                      </div>
                      <div>
                        <h3 className="font-extrabold text-base md:text-lg leading-tight">
                          {t.viewDocsAndBook}
                        </h3>
                        <p className="text-xs text-emerald-100 mt-1">
                          {t.docsAvailable}
                        </p>
                      </div>
                    </div>
                    <ArrowRight className="w-5 h-5 text-emerald-100 group-hover:translate-x-1 transition-transform" />
                  </div>

                  {/* 2. My Token / View Token */}
                  <div
                    onClick={() => setViewState('MY_TOKEN')}
                    className="bg-white hover:bg-slate-50 border border-slate-200 p-5 rounded-2xl shadow-xs cursor-pointer transition flex items-center justify-between group"
                  >
                    <div className="flex items-center space-x-3.5">
                      <div className="w-12 h-12 rounded-2xl bg-pink-100 text-pink-700 flex items-center justify-center flex-shrink-0">
                        <Ticket className="w-6 h-6" />
                      </div>
                      <div>
                        <h4 className="font-bold text-base text-slate-900">{t.myToken}</h4>
                        <p className="text-xs text-slate-500 mt-0.5">{t.checkLiveToken}</p>
                      </div>
                    </div>
                    <ArrowRight className="w-5 h-5 text-slate-400 group-hover:translate-x-1 transition-transform" />
                  </div>

                  {/* 3. View Queue */}
                  <div
                    onClick={() => setViewState('VIEW_QUEUE')}
                    className="bg-white hover:bg-slate-50 border border-slate-200 p-5 rounded-2xl shadow-xs cursor-pointer transition flex items-center justify-between group"
                  >
                    <div className="flex items-center space-x-3.5">
                      <div className="w-12 h-12 rounded-2xl bg-blue-100 text-blue-700 flex items-center justify-center flex-shrink-0">
                        <Users className="w-6 h-6" />
                      </div>
                      <div>
                        <h4 className="font-bold text-base text-slate-900">{t.viewQueue}</h4>
                        <p className="text-xs text-slate-500 mt-0.5">{t.realtimeStatus}</p>
                      </div>
                    </div>
                    <ArrowRight className="w-5 h-5 text-slate-400 group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              </div>

              {/* Quick Cross-Device Token Lookup Banner */}
              <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-blue-50 border border-emerald-200/80 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-xs">
                <div className="flex items-center space-x-3.5 text-left w-full sm:w-auto">
                  <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center flex-shrink-0 shadow-xs">
                    <Search className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-extrabold text-sm text-slate-900 flex flex-wrap items-center gap-1.5">
                      <span>{lang === 'HI' ? "आज का ओपीडी टोकन खोजें" : "Search Today's OPD Token"}</span>
                      <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-md border border-emerald-200">
                        {lang === 'HI' ? 'केवल आज के लिए' : "Today's Date Only"}
                      </span>
                    </h4>
                    <p className="text-xs text-slate-600 mt-0.5">
                      {lang === 'HI' ? 'अपना 10-अंकों का मोबाइल नंबर डालकर आज का लाइव टोकन देखें (पुराने टोकन समाप्त हो जाते हैं)' : 'Enter your 10-digit mobile number to track today\'s live token (valid for today\'s OPD only)'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setViewState('MY_TOKEN')}
                  className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs md:text-sm px-4 py-2.5 rounded-xl transition shadow-xs flex items-center justify-center space-x-2 cursor-pointer flex-shrink-0 active:scale-95"
                >
                  <Search className="w-4 h-4" />
                  <span>{lang === 'HI' ? 'मोबाइल नंबर से खोजें ➔' : 'Search Today\'s Token ➔'}</span>
                </button>
              </div>

              {/* Doctors Catalog Grid on Homepage (Laptop: 3-column responsive grid) */}
              <div className="pt-2">
                <div className="flex items-center justify-between mb-3.5">
                  <h3 className="text-xs md:text-sm font-black text-slate-700 uppercase tracking-wider">
                    {t.todayOpdDoctors}
                  </h3>
                  <span className="inline-flex items-center space-x-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    <span>{t.liveOpd}</span>
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {sessions.map((s) => (
                    <div
                      key={s.id}
                      onClick={() => {
                        setSelectedSession(s);
                        setViewState('CONFIRM_TOKEN');
                      }}
                      className="bg-white rounded-2xl p-4 border border-slate-200 hover:border-emerald-500 shadow-xs cursor-pointer transition flex flex-col justify-between space-y-3"
                    >
                      <div className="flex items-start space-x-3.5">
                        <div className="relative flex-shrink-0">
                          <img
                            src={s.doctorPhotoUrl || "https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=300&auto=format&fit=crop&q=80"}
                            alt={s.doctorName}
                            className="w-16 h-16 rounded-2xl object-cover border border-slate-200 shadow-xs"
                          />
                          <span className="absolute -bottom-1 -right-1 bg-emerald-500 text-white rounded-full p-0.5 text-[10px]">
                            ✓
                          </span>
                        </div>

                        <div className="flex-1 min-w-0">
                          <h4 className="font-bold text-sm md:text-base text-slate-900 truncate">{s.doctorName}</h4>
                          <p className="text-xs text-emerald-700 font-semibold">{s.doctorSpecialty}</p>
                          <p className="text-[11px] text-slate-400 mt-0.5">{s.doctorRoomNumber}</p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                        <div className="space-x-2 text-slate-600">
                          <span>Serving: <b className="text-slate-800">{s.currentServingToken ? `#${s.currentServingToken}` : '—'}</b></span>
                          <span>Waiting: <b className="text-emerald-700">{s.waitingCount}</b></span>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedSession(s);
                            setViewState('CONFIRM_TOKEN');
                          }}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-3.5 py-1.5 rounded-xl shadow-xs transition"
                        >
                          Book Token
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* ========================================================================= */}
          {/* SCREEN 2: CHOOSE DOCTOR FOR TOKEN (Responsive Grid) */}
          {/* ========================================================================= */}
          {viewState === 'DOCTOR_LIST' && (
            <div className="space-y-4">
              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3 md:p-4 flex items-center justify-between text-xs md:text-sm text-emerald-900 font-medium">
                <span className="flex items-center space-x-2">
                  <span>⚡</span>
                  <span className="font-bold">{t.tapToBookNotice}</span>
                </span>
                <button
                  onClick={() => speakText(lang === 'HI' ? 'कृपया अपना डॉक्टर चुनें' : 'Please choose your doctor')}
                  className="text-emerald-700 hover:text-emerald-900 font-bold flex items-center space-x-1 cursor-pointer bg-white px-3 py-1 rounded-lg border border-emerald-200"
                >
                  <Volume2 className="w-4 h-4" />
                  <span>{t.listen}</span>
                </button>
              </div>

              {/* Grid: 1 col on mobile, 2 on tablet, 3 on laptop/desktop */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {sessions.map((s) => (
                  <div
                    key={s.id}
                    className="bg-white rounded-3xl p-5 shadow-sm border-2 border-slate-200/90 flex flex-col justify-between space-y-4 hover:border-emerald-500 transition"
                  >
                    <div className="space-y-3.5">
                      <div className="flex items-start space-x-3.5">
                        <div className="relative flex-shrink-0">
                          <img
                            src={s.doctorPhotoUrl || "https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=300&auto=format&fit=crop&q=80"}
                            alt={s.doctorName}
                            className="w-20 h-20 rounded-2xl object-cover border border-slate-200 shadow-xs"
                          />
                          <span className="absolute -bottom-1 -right-1 bg-emerald-500 text-white rounded-full p-1 text-xs">
                            ✓
                          </span>
                        </div>

                        <div className="flex-1 min-w-0">
                          <h3 className="font-extrabold text-base text-slate-900">{s.doctorName}</h3>
                          <p className="text-xs text-emerald-700 font-bold mt-0.5">❤️ {s.doctorSpecialty}</p>
                          <p className="text-[11px] text-slate-500">{s.doctorRoomNumber}</p>

                          <span className="inline-flex items-center space-x-1 mt-1.5 text-[11px] text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-full">
                            <span>🟢</span>
                            <span>{t.availableToday}</span>
                          </span>
                        </div>
                      </div>

                      {/* Stats Grid */}
                      <div className="grid grid-cols-2 gap-2 text-center text-xs">
                        <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                          <span className="text-slate-400 text-[10px] block uppercase font-bold tracking-wider">{t.currentToken}:</span>
                          <span className="font-black text-slate-800 text-base">
                            {s.currentServingToken ? `#${s.currentServingToken}` : '—'}
                          </span>
                        </div>
                        <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                          <span className="text-slate-400 text-[10px] block uppercase font-bold tracking-wider">{t.peopleWaiting}:</span>
                          <span className="font-black text-emerald-700 text-base">{s.waitingCount}</span>
                        </div>
                      </div>

                      {/* Next Token Callout Box */}
                      <div className="bg-amber-50/80 border border-amber-200 rounded-xl p-3 flex items-center justify-between text-xs">
                        <div>
                          <span className="font-extrabold text-amber-950 block">🎟️ {t.nextAvailableToken}:</span>
                          <span className="text-[10px] text-amber-800">
                            {s.totalWalkinCount > 0 
                              ? `(${s.totalWalkinCount} ${t.walkInsNotice})` 
                              : '(Direct Entry)'}
                          </span>
                        </div>
                        <span className="text-xl font-black text-amber-900 bg-white px-3 py-1 rounded-lg border border-amber-200 shadow-xs">
                          #{s.nextTokenSequence}
                        </span>
                      </div>
                    </div>

                    {/* Big CTA Button */}
                    <button
                      onClick={() => {
                        setSelectedSession(s);
                        setViewState('CONFIRM_TOKEN');
                      }}
                      className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold py-3.5 rounded-2xl shadow-md transition text-sm flex items-center justify-center space-x-2 cursor-pointer active:scale-[0.99]"
                    >
                      <span>{t.getTokenBtn}</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* SCREEN 3: CONFIRM & BOOK TOKEN (Laptop: 2-column split layout) */}
          {/* ========================================================================= */}
          {viewState === 'CONFIRM_TOKEN' && selectedSession && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Left Column on Laptop (5 cols): Doctor Info Card */}
              <div className="lg:col-span-5 bg-white rounded-3xl p-6 shadow-sm border border-slate-200 text-center space-y-4">
                <div className="relative inline-block mx-auto">
                  <img
                    src={selectedSession.doctorPhotoUrl || "https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=300&auto=format&fit=crop&q=80"}
                    alt={selectedSession.doctorName}
                    className="w-28 h-28 rounded-3xl object-cover border-2 border-emerald-500 shadow-md mx-auto"
                  />
                  <span className="absolute -bottom-1 -right-1 bg-red-500 text-white rounded-full p-1.5 text-xs shadow-xs">
                    ❤️
                  </span>
                </div>

                <div>
                  <h3 className="font-black text-xl text-slate-900">{selectedSession.doctorName}</h3>
                  <p className="text-sm text-emerald-700 font-bold">{selectedSession.doctorSpecialty}</p>
                  <p className="text-xs text-slate-500 mt-1">
                    🏥 {hospital?.name || 'City Care Hospital'} • {selectedSession.doctorRoomNumber}
                  </p>
                </div>

                <button
                  onClick={() => speakText(`${selectedSession.doctorName}. ${selectedSession.doctorSpecialty}. ${selectedSession.doctorRoomNumber}.`)}
                  className="inline-flex items-center space-x-2 text-xs md:text-sm text-slate-700 bg-slate-100 hover:bg-slate-200 px-4 py-2 rounded-full font-semibold transition cursor-pointer"
                >
                  <Volume2 className="w-4 h-4 text-emerald-600" />
                  <span>Listen to Doctor Info</span>
                </button>
              </div>

              {/* Right Column on Laptop (7 cols): Live OPD Status & Input Form */}
              <div className="lg:col-span-7 space-y-4">
                {/* Dark Live OPD Status Box */}
                <div className="bg-slate-900 text-white rounded-3xl p-6 shadow-lg space-y-4 border border-slate-800">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center space-x-2 text-xs font-bold uppercase tracking-wider text-emerald-400">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping"></span>
                      <span>{t.todayOpdStatus}</span>
                    </span>
                    <span className="text-xs text-slate-400 font-mono">Live Sync</span>
                  </div>

                  {/* 3 Stats Boxes */}
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div className="bg-slate-800/80 p-3 rounded-2xl border border-slate-700">
                      <span className="text-[10px] md:text-xs text-slate-400 block">{t.currentToken}</span>
                      <span className="text-xl md:text-2xl font-black text-emerald-400">
                        {selectedSession.currentServingToken ? `#${selectedSession.currentServingToken}` : '—'}
                      </span>
                    </div>
                    <div className="bg-amber-950/60 p-3 rounded-2xl border border-amber-600/40">
                      <span className="text-[10px] md:text-xs text-amber-300 block">{t.nextAvailableToken}</span>
                      <span className="text-xl md:text-2xl font-black text-amber-400">
                        #{selectedSession.nextTokenSequence}
                      </span>
                    </div>
                    <div className="bg-slate-800/80 p-3 rounded-2xl border border-slate-700">
                      <span className="text-[10px] md:text-xs text-slate-400 block">{t.peopleWaiting}</span>
                      <span className="text-xl md:text-2xl font-black text-white">
                        {selectedSession.waitingCount}
                      </span>
                    </div>
                  </div>

                  {/* Walk-in notice banner */}
                  {selectedSession.totalWalkinCount > 0 ? (
                    <div className="bg-blue-950/70 border border-blue-800/60 rounded-xl p-3 text-xs md:text-sm text-blue-200 flex items-center space-x-2.5">
                      <span className="text-lg">🎟️</span>
                      <span>
                        {selectedSession.totalWalkinCount} Reception Walk-In Patient(s) registered ahead at front desk
                      </span>
                    </div>
                  ) : (
                    <div className="bg-emerald-950/70 border border-emerald-800/60 rounded-xl p-3 text-xs md:text-sm text-emerald-200 flex items-center space-x-2.5">
                      <span className="text-lg">⚡</span>
                      <span>
                        No reception queue waiting • Direct entry when turn is called
                      </span>
                    </div>
                  )}

                  <p className="text-xs text-slate-400 text-center leading-relaxed">
                    {t.directEntry}
                  </p>
                </div>

                {/* Patient Input Fields */}
                <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 space-y-4">
                  <h4 className="text-xs md:text-sm font-bold text-slate-700 uppercase tracking-wider">
                    Patient Details
                  </h4>
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">Full Name *</label>
                        <input
                          type="text"
                          required
                          placeholder={t.namePlaceholder}
                          value={patientName}
                          onChange={(e) => setPatientName(e.target.value)}
                          className="w-full text-sm font-medium border border-slate-200 rounded-xl px-4 py-3 focus:border-emerald-600 outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">Mobile Number *</label>
                        <input
                          type="tel"
                          required
                          maxLength={10}
                          placeholder={t.phonePlaceholder}
                          value={patientPhone}
                          onChange={(e) => setPatientPhone(e.target.value.replace(/\D/g, ''))}
                          className="w-full text-sm font-medium border border-slate-200 rounded-xl px-4 py-3 focus:border-emerald-600 outline-none"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">
                        {t.locationLabel}
                      </label>
                      <div className="relative">
                        <MapPin className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                        <input
                          type="text"
                          required
                          placeholder={t.locationPlaceholder}
                          value={patientLocation}
                          onChange={(e) => setPatientLocation(e.target.value)}
                          className="w-full text-sm font-medium border border-slate-200 rounded-xl pl-10 pr-4 py-3 focus:border-emerald-600 outline-none"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Big Green Confirm CTA Button */}
                <button
                  onClick={handleConfirmBooking}
                  disabled={loading || !patientName.trim() || patientPhone.length < 10 || !patientLocation.trim()}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white font-black py-4 rounded-2xl shadow-xl transition text-base md:text-lg flex items-center justify-center space-x-2 cursor-pointer active:scale-[0.99]"
                >
                  <span>{loading ? 'Generating...' : t.confirmAndGetToken(selectedSession.nextTokenSequence)}</span>
                </button>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* SCREEN 4: MY TOKEN (Live Status & Queue Tracking) */}
          {/* ========================================================================= */}
          {viewState === 'MY_TOKEN' && (
            <div className="max-w-xl mx-auto space-y-5">
              {activeToken ? (
                <>
                  {/* Top Navigation Bar: Back & Search with Different Phone */}
                  <div className="flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => {
                        setActiveToken(null);
                        setLookupQuery('');
                        setLookupTokensList([]);
                        setViewState('MY_TOKEN');
                      }}
                      className="inline-flex items-center space-x-2 text-xs sm:text-sm font-bold text-emerald-800 bg-white hover:bg-emerald-50 border border-emerald-300 px-3.5 py-2 rounded-xl transition shadow-xs cursor-pointer active:scale-95"
                    >
                      <ArrowLeft className="w-4 h-4 text-emerald-700" />
                      <span>{lang === 'HI' ? 'अन्य नंबर से टोकन खोजें' : 'Search Another Phone / Token'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveToken(null);
                        setViewState('HOME');
                      }}
                      className="text-xs font-bold text-slate-500 hover:text-emerald-700 transition px-2 py-1 cursor-pointer"
                    >
                      {lang === 'HI' ? 'होम पेज' : 'Back to Home'}
                    </button>
                  </div>

                  {activeToken.status === 'CALLED' && (
                    <div className="p-5 bg-emerald-500 text-white rounded-3xl shadow-xl flex items-center space-x-4 animate-bounce">
                      <Volume2 className="w-10 h-10 flex-shrink-0" />
                      <div>
                        <h3 className="font-extrabold text-lg">{t.calledAlert}</h3>
                        <p className="text-xs md:text-sm text-emerald-100">{activeToken.doctorName} • {activeToken.doctorRoomNumber}</p>
                      </div>
                    </div>
                  )}

                  <div className="bg-white rounded-3xl p-6 md:p-8 shadow-md border border-slate-200 text-center relative overflow-hidden">
                    {/* Card Top Left: Today's OPD Date Badge */}
                    <div className="absolute top-4 left-4">
                      <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[11px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 shadow-2xs">
                        <Calendar className="w-3 h-3 text-emerald-600" />
                        <span>{lang === 'HI' ? 'आज की ओपीडी' : "Today's OPD"}</span>
                      </span>
                    </div>

                    <div className="absolute top-4 right-4">
                      <span className={`inline-flex items-center px-3.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                        activeToken.status === 'CALLED'
                          ? 'bg-emerald-100 text-emerald-700 animate-pulse'
                          : activeToken.status === 'IN_CONSULTATION'
                          ? 'bg-blue-100 text-blue-700'
                          : activeToken.status === 'COMPLETED'
                          ? 'bg-slate-100 text-slate-600'
                          : 'bg-amber-100 text-amber-700'
                      }`}>
                        {activeToken.status}
                      </span>
                    </div>

                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1 pt-3">{t.yourToken}</p>
                    <div className="text-6xl md:text-7xl font-black text-emerald-600 my-2">
                      #{activeToken.tokenNumber}
                    </div>
                    <p className="text-[11px] font-semibold text-emerald-700 mb-2 flex items-center justify-center space-x-1">
                      <Calendar className="w-3 h-3" />
                      <span>
                        {lang === 'HI'
                          ? 'आज का ओपीडी टोकन • केवल आज मान्य'
                          : "Today's Token • Valid for today's OPD only"}
                      </span>
                    </p>

                    <div className="mt-6 pt-5 border-t border-slate-100 text-left space-y-3 text-sm md:text-base">
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500">Doctor:</span>
                        <span className="font-bold text-slate-800">{activeToken.doctorName}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500">Room:</span>
                        <span className="font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-lg">{activeToken.doctorRoomNumber}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500">Serving Now:</span>
                        <span className="font-bold text-slate-800">
                          {activeToken.currentServingToken ? `#${activeToken.currentServingToken}` : 'Starting Soon'}
                        </span>
                      </div>
                      {activeToken.patientName && (
                        <div className="flex justify-between items-center">
                          <span className="text-slate-500">Patient:</span>
                          <span className="font-bold text-slate-800">👤 {activeToken.patientName}</span>
                        </div>
                      )}
                      {activeToken.patientLocation && (
                        <div className="flex justify-between items-center">
                          <span className="text-slate-500">Location:</span>
                          <span className="font-bold text-emerald-700">📍 {activeToken.patientLocation}</span>
                        </div>
                      )}
                    </div>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-2 gap-4 mt-6 pt-5 border-t border-slate-100">
                      <div className="bg-slate-50 p-4 rounded-2xl text-center">
                        <p className="text-xs md:text-sm text-slate-400 mb-1">{t.patientsAhead}</p>
                        <p className="text-3xl font-black text-slate-800">{activeToken.tokensAhead}</p>
                      </div>
                      <div className="bg-slate-50 p-4 rounded-2xl text-center">
                        <p className="text-xs md:text-sm text-slate-400 mb-1">{t.estWait}</p>
                        <p className="text-3xl font-black text-slate-800">~{activeToken.estimatedWaitMinutes}m</p>
                      </div>
                    </div>

                    {/* Notification Delivery Status Badge (No raw message text in UI) */}
                    {/* Notification Delivery Status Badge */}
                    {activeToken.smsSent ? (
                      <div className="bg-emerald-50/90 border border-emerald-200/90 rounded-2xl p-3.5 mt-4 text-left flex items-center justify-between shadow-2xs">
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center flex-shrink-0 shadow-xs">
                            <CheckCircle2 className="w-4 h-4" />
                          </div>
                          <div>
                            <p className="text-xs sm:text-sm font-bold text-emerald-950">
                              {lang === 'HI'
                                ? 'रजिस्टर मोबाइल नंबर पर संदर्भ संदेश भेज दिया गया है।'
                                : 'A message is also sent to registered phone number for reference.'}
                            </p>
                            {activeToken.patientPhone && (
                              <p className="text-[11px] text-emerald-800 font-semibold mt-0.5">
                                📱 +91 {activeToken.patientPhone}
                              </p>
                            )}
                          </div>
                        </div>
                        <span className="text-[10px] uppercase font-black bg-emerald-200 text-emerald-900 px-2 py-0.5 rounded-md flex-shrink-0 ml-2">
                          {lang === 'HI' ? 'संदेश भेजा गया' : 'MESSAGE SENT'}
                        </span>
                      </div>
                    ) : (
                      <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 mt-4 text-left shadow-2xs space-y-3">
                        <div className="flex items-start justify-between">
                          <div className="flex items-start space-x-3">
                            <div className="w-8 h-8 rounded-xl bg-rose-600 text-white flex items-center justify-center flex-shrink-0 shadow-xs mt-0.5">
                              <span className="text-sm font-black">✕</span>
                            </div>
                            <div>
                              <p className="text-xs sm:text-sm font-bold text-rose-950">
                                {lang === 'HI'
                                  ? 'रजिस्टर मोबाइल नंबर पर संदेश भेजने में विफल रहा।'
                                  : 'Failed to send message to registered phone number.'}
                              </p>
                              {activeToken.patientPhone && (
                                <p className="text-[11px] text-rose-700 font-medium mt-0.5">
                                  📱 +91 {activeToken.patientPhone}
                                </p>
                              )}
                              <p className="text-[11px] text-rose-800 bg-rose-100/90 px-2.5 py-1 rounded-lg mt-1.5 font-medium leading-snug">
                                ⚠️ {activeToken.smsError || (lang === 'HI' ? 'एसएमएस गेटवे एपीआई सर्वर पर कॉन्फ़िगर नहीं है।' : 'SMS Gateway API not configured on server.')}
                              </p>
                            </div>
                          </div>
                          <span className="text-[10px] uppercase font-black bg-rose-200 text-rose-900 px-2 py-0.5 rounded-md flex-shrink-0 ml-2">
                            {lang === 'HI' ? 'विफल' : 'FAILED TO SEND'}
                          </span>
                        </div>

                        {/* Retry SMS Button */}
                        <div className="pt-2 border-t border-rose-200/70 flex items-center justify-between">
                          <p className="text-[11px] text-rose-700 font-medium">
                            {lang === 'HI' ? 'संदेश भेजने का पुनः प्रयास करें?' : 'Want to retry SMS dispatch?'}
                          </p>
                          <button
                            type="button"
                            onClick={handleRetrySms}
                            disabled={retryingSms}
                            className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 disabled:bg-rose-300 text-white text-xs font-bold rounded-xl transition shadow-xs cursor-pointer active:scale-95"
                          >
                            <RefreshCw className={`w-3.5 h-3.5 ${retryingSms ? 'animate-spin' : ''}`} />
                            <span>
                              {retryingSms
                                ? (lang === 'HI' ? 'भेजा जा रहा है...' : 'Retrying...')
                                : (lang === 'HI' ? 'पुनः प्रयास करें' : 'Retry SMS')}
                            </span>
                          </button>
                        </div>
                        {smsRetryStatus && (
                          <p className="text-[11px] text-slate-700 bg-white/90 p-2 rounded-xl border border-rose-200 font-medium">
                            {smsRetryStatus}
                          </p>
                        )}
                      </div>
                    )}

                    <p className="text-xs md:text-sm text-slate-400 mt-4 leading-relaxed">
                      Please reach the consultation room when your token is near.
                    </p>
                  </div>

                  {/* Bottom Action Controls */}
                  <div className="space-y-2.5">
                    <button
                      type="button"
                      onClick={() => {
                        setActiveToken(null);
                        setLookupQuery('');
                        setLookupTokensList([]);
                        setViewState('MY_TOKEN');
                      }}
                      className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3.5 rounded-2xl transition text-sm flex items-center justify-center space-x-2 cursor-pointer shadow-md active:scale-[0.99]"
                    >
                      <Search className="w-4 h-4" />
                      <span>{lang === 'HI' ? 'अन्य मोबाइल नंबर से टोकन खोजें ➔' : 'Search Token With Another Phone Number ➔'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        if (hospital?.id) {
                          localStorage.removeItem(`opd_patient_token_ref_${hospital.id}`);
                        }
                        localStorage.removeItem('opd_patient_token_ref');
                        localStorage.removeItem('citycare_patient_token_ref');
                        setActiveToken(null);
                        setViewState('HOME');
                      }}
                      className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3 rounded-2xl transition text-sm flex items-center justify-center space-x-2 cursor-pointer border border-slate-300"
                    >
                      <RefreshCw className="w-4 h-4" />
                      <span>{t.changeDoc}</span>
                    </button>
                  </div>
                </>
              ) : (
                /* Token Lookup Form */
                <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200 space-y-5 text-center">
                  <div className="w-14 h-14 bg-emerald-100 text-emerald-700 rounded-2xl flex items-center justify-center mx-auto">
                    <Ticket className="w-7 h-7" />
                  </div>
                  <div>
                    <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-bold text-emerald-850 bg-emerald-50 border border-emerald-200 mb-2.5">
                      <Calendar className="w-3.5 h-3.5 text-emerald-600" />
                      <span>
                        {new Date().toLocaleDateString(lang === 'HI' ? 'hi-IN' : 'en-IN', {
                          weekday: 'short',
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric'
                        })}
                      </span>
                    </div>
                    <h3 className="font-black text-lg text-slate-900">
                      {lang === 'HI' ? 'आज का ओपीडी टोकन खोजें' : "Search Today's OPD Token"}
                    </h3>
                    <p className="text-xs md:text-sm text-slate-500 mt-1">
                      {lang === 'HI'
                        ? 'आज के लाइव नंबर के लिए 10 अंकों का मोबाइल नंबर डालें'
                        : 'Enter your 10-digit mobile phone number or booking reference to check live turn'}
                    </p>
                  </div>

                  {/* Informational Callout: Tokens only searchable on Today's basis */}
                  <div className="bg-amber-50/90 border border-amber-200 rounded-2xl p-3.5 text-left flex items-start space-x-2.5 text-xs text-amber-900 shadow-2xs">
                    <span className="text-base flex-shrink-0 mt-0.5">ℹ️</span>
                    <div>
                      <p className="font-extrabold text-amber-950">
                        {lang === 'HI'
                          ? 'टोकन केवल आज की तारीख के लिए उपलब्ध व सर्च किए जा सकते हैं'
                          : "Tokens are only searchable for Today's OPD"}
                      </p>
                      <p className="text-[11px] text-amber-800 font-medium mt-0.5 leading-relaxed">
                        {lang === 'HI'
                          ? 'ओपीडी टोकन केवल उसी दिन की डॉक्टर कंसल्टेशन के लिए मान्य होते हैं। पुराने या पिछले दिनों के टोकन स्वतः समाप्त हो जाते हैं।'
                          : "OPD tokens are valid exclusively for today's doctor session. Previous days' tokens expire automatically at midnight."}
                      </p>
                    </div>
                  </div>

                  <form onSubmit={handleLookupToken} className="space-y-3">
                    <input
                      type="text"
                      placeholder={lang === 'HI' ? 'आज के टोकन के लिए 10 अंकों का मोबाइल नंबर डालें' : "Enter 10-Digit Mobile Number for Today's Token"}
                      value={lookupQuery}
                      onChange={(e) => setLookupQuery(e.target.value)}
                      className="w-full text-sm font-semibold border border-slate-300 rounded-2xl px-4 py-3.5 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 outline-none text-center shadow-xs"
                    />
                    <button
                      type="submit"
                      disabled={lookupLoading}
                      className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black py-3.5 rounded-2xl transition text-sm cursor-pointer shadow-md disabled:opacity-50"
                    >
                      {lookupLoading
                        ? (lang === 'HI' ? 'टोकन खोज रहे हैं...' : 'Searching Today\'s Token...')
                        : (lang === 'HI' ? 'आज का टोकन खोजें ➔' : 'Find Today\'s Token ➔')}
                    </button>
                  </form>

                  {/* Multiple Tokens Found List */}
                  {lookupTokensList.length > 0 && (
                    <div className="pt-4 border-t border-slate-100 space-y-2 text-left">
                      <p className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                        Found {lookupTokensList.length} token(s) for this phone number today:
                      </p>
                      {lookupTokensList.map((t) => (
                        <div
                          key={t.id}
                          onClick={() => {
                            setActiveToken(t);
                            if (hospital?.id) {
                              localStorage.setItem(`opd_patient_token_ref_${hospital.id}`, t.bookingReference);
                            }
                            localStorage.setItem('opd_patient_token_ref', t.bookingReference);
                            localStorage.removeItem('citycare_patient_token_ref');
                          }}
                          className="p-3 rounded-2xl border border-slate-200 hover:border-emerald-500 bg-slate-50/50 hover:bg-white cursor-pointer transition flex items-center justify-between"
                        >
                          <div className="flex items-center space-x-3">
                            <span className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 font-black flex items-center justify-center text-sm">
                              #{t.tokenNumber}
                            </span>
                            <div>
                              <p className="font-extrabold text-sm text-slate-900">{t.patientName || 'Online Booking'}</p>
                              <p className="text-xs text-slate-500">{t.doctorName} • {t.doctorRoomNumber}</p>
                            </div>
                          </div>
                          <span className="text-xs font-bold text-emerald-600 hover:underline">
                            Open Turn ➔
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ========================================================================= */}
          {/* SCREEN 5: VIEW QUEUE (Laptop: Responsive Grid) */}
          {/* ========================================================================= */}
          {viewState === 'VIEW_QUEUE' && (
            <div className="space-y-4">
              <h3 className="text-xs md:text-sm font-bold text-slate-600 uppercase tracking-wider">
                Live Doctor Queue Status
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {sessions.map((s) => (
                  <div key={s.id} className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200 flex flex-col justify-between space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-bold text-base text-slate-900">{s.doctorName}</h4>
                        <p className="text-xs text-emerald-700 font-semibold">{s.doctorSpecialty}</p>
                      </div>
                      <span className="text-xs font-bold bg-emerald-50 text-emerald-800 px-2.5 py-1 rounded-lg border border-emerald-200">
                        {s.doctorRoomNumber}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-center text-xs">
                      <div className="bg-slate-50 p-2.5 rounded-xl">
                        <span className="text-[10px] text-slate-400 block">Serving</span>
                        <span className="font-bold text-slate-800 text-sm">
                          {s.currentServingToken ? `#${s.currentServingToken}` : '—'}
                        </span>
                      </div>
                      <div className="bg-slate-50 p-2.5 rounded-xl">
                        <span className="text-[10px] text-slate-400 block">Next</span>
                        <span className="font-bold text-amber-700 text-sm">#{s.nextTokenSequence}</span>
                      </div>
                      <div className="bg-slate-50 p-2.5 rounded-xl">
                        <span className="text-[10px] text-slate-400 block">Waiting</span>
                        <span className="font-bold text-slate-800 text-sm">{s.waitingCount}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </main>

        {/* Global Patient Portal Footer */}
        <footer className="bg-white border-t border-slate-200 py-6 text-center text-xs text-slate-500 mt-auto">
          <div className="max-w-7xl mx-auto px-4">
            <p className="font-semibold text-slate-700">{hospital?.name || 'City Care Hospital'} • Digital OPD Remote Token Platform</p>
            <p className="text-[11px] text-slate-400 mt-1">Live queue updates synchronized with hospital consultation room</p>
          </div>
        </footer>
      </div>
    );
  };
