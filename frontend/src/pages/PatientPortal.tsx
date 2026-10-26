import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { api, getTodayIstDateString } from '../services/api';
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
  Calendar,
  GraduationCap,
  DoorClosed,
  AlertCircle,
  Award,
  Sunrise,
  Sunset,
  PauseCircle,
  HeartPulse,
  Home,
  Info,
  X,
  ExternalLink
} from 'lucide-react';
import { LanguageToggle } from '../components/LanguageToggle';

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

  const isEveningSession = (s: { sessionName?: string; startTime?: string }) => {
    const name = (s.sessionName || '').toUpperCase();
    if (name.includes('EVENING') || name.includes('NIGHT')) return true;
    if (name.includes('MORNING')) return false;
    if (s.startTime) {
      const hr = parseInt(s.startTime.split(':')[0], 10);
      return hr >= 16;
    }
    return false;
  };

  const isMorningSession = (s: { sessionName?: string; startTime?: string }) => !isEveningSession(s);

  // Authoritative current session per doctor: citizens see the current live reality without choosing shifts
  const displayedSessions = useMemo(() => {
    const doctorMap = new Map<string, OpdSession>();
    
    // Group all sessions by doctor
    const byDoctor = new Map<string, OpdSession[]>();
    sessions.forEach((s) => {
      const docKey = s.doctorId || s.doctorName;
      if (!byDoctor.has(docKey)) {
        byDoctor.set(docKey, []);
      }
      byDoctor.get(docKey)!.push(s);
    });

    byDoctor.forEach((docSessions, docKey) => {
      // 1. If Evening OPD is OPEN, Evening is current
      const openEvening = docSessions.find(s => isEveningSession(s) && s.status === 'OPEN');
      if (openEvening) {
        doctorMap.set(docKey, openEvening);
        return;
      }

      // 2. If Morning OPD is OPEN, Morning is current
      const openMorning = docSessions.find(s => isMorningSession(s) && s.status === 'OPEN');
      if (openMorning) {
        doctorMap.set(docKey, openMorning);
        return;
      }

      // 3. If Evening is PAUSED and Morning is CLOSED, check whether evening has started or if it's evening time
      const morningSess = docSessions.find(s => isMorningSession(s));
      const eveningSess = docSessions.find(s => isEveningSession(s));
      if (morningSess && morningSess.status === 'CLOSED' && eveningSess && eveningSess.status === 'PAUSED') {
        const hr = new Date().getHours();
        if (hr >= 16 || (eveningSess.waitingCount && eveningSess.waitingCount > 0)) {
          doctorMap.set(docKey, eveningSess);
        } else {
          doctorMap.set(docKey, morningSess);
        }
        return;
      }

      // 4. If Morning is PAUSED (doctor taking a break in morning shift)
      if (morningSess && morningSess.status === 'PAUSED') {
        doctorMap.set(docKey, morningSess);
        return;
      }

      // 5. Default to morning or first session
      doctorMap.set(docKey, morningSess || eveningSess || docSessions[0]);
    });

    return Array.from(doctorMap.values());
  }, [sessions]);

  // Live search query for doctor/specialty search bar
  const [doctorSearchQuery, setDoctorSearchQuery] = useState('');
  // Hospital Info modal toggle
  const [showHospitalInfoModal, setShowHospitalInfoModal] = useState(false);

  const filteredSessions = useMemo(() => {
    if (!doctorSearchQuery.trim()) return displayedSessions;
    const q = doctorSearchQuery.toLowerCase().trim();
    return displayedSessions.filter(
      (s) =>
        s.doctorName?.toLowerCase().includes(q) ||
        s.doctorSpecialty?.toLowerCase().includes(q) ||
        s.doctorQualification?.toLowerCase().includes(q) ||
        s.doctorRoomNumber?.toLowerCase().includes(q)
    );
  }, [displayedSessions, doctorSearchQuery]);

  // Patient Registration Details
  const [patientName, setPatientName] = useState('');
  const [patientPhone, setPatientPhone] = useState('');
  const [patientLocation, setPatientLocation] = useState('');
  const [patientGender, setPatientGender] = useState<'MALE' | 'FEMALE'>('MALE');
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

  // Verifies whether a token is valid for today's active OPD session (Asia/Kolkata date)
  const isTokenActiveToday = (token: TokenResponse | null): boolean => {
    if (!token) return false;
    if (token.expired) return false;

    const todayIst = getTodayIstDateString();

    if (token.sessionDate) {
      return token.sessionDate === todayIst;
    }

    if (token.createdAt) {
      const created = new Date(token.createdAt);
      const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).formatToParts(created);
      const cYear = parts.find((p) => p.type === 'year')?.value;
      const cMonth = parts.find((p) => p.type === 'month')?.value;
      const cDay = parts.find((p) => p.type === 'day')?.value;
      return `${cYear}-${cMonth}-${cDay}` === todayIst;
    }

    return true;
  };

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

  const isRefreshingSessionsRef = useRef(false);
  const hasPendingRefreshRef = useRef(false);
  const sessionRequestIdRef = useRef(0);

  const refreshSessions = useCallback(async (hId?: string) => {
    const id = hId || hospital?.id;
    if (!id) return;

    if (isRefreshingSessionsRef.current) {
      // Coalesce: mark that a refresh arrived during the in-flight request
      hasPendingRefreshRef.current = true;
      return;
    }

    isRefreshingSessionsRef.current = true;
    hasPendingRefreshRef.current = false;
    const currentReqId = ++sessionRequestIdRef.current;
    try {
      const freshSessions = await api.getPatientTodaySessions(id);
      if (currentReqId === sessionRequestIdRef.current) {
        setSessions(freshSessions);
        setSelectedSession((prev) => {
          if (!prev) return freshSessions[0] || null;
          const matched = freshSessions.find((s) => s.id === prev.id);
          return matched || prev;
        });
      }
    } catch {
      // Quiet background refresh fallback
    } finally {
      isRefreshingSessionsRef.current = false;
      if (hasPendingRefreshRef.current) {
        hasPendingRefreshRef.current = false;
        // Safely execute the queued refresh to avoid losing events
        refreshSessions(id);
      }
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

      if (!targetSlug) {
        throw new Error('No hospital specified. Please choose a hospital from the directory.');
      }

      // Check session cache for immediate warm start
      const cacheKey = `citycare_cached_hospital_${targetSlug}`;
      let cachedHospital: HospitalProfile | null = null;
      try {
        const cachedRaw = sessionStorage.getItem(cacheKey);
        if (cachedRaw) {
          cachedHospital = JSON.parse(cachedRaw);
          if (cachedHospital?.id) {
            setHospital(cachedHospital);
          }
        }
      } catch {
        // Ignore cache parse error
      }

      let h: HospitalProfile;
      if (cachedHospital?.id) {
        // Parallel fetch: refresh hospital profile in background while sessions load immediately
        const [freshH, sess] = await Promise.all([
          api.resolveHospitalBySlug(targetSlug),
          api.getPatientTodaySessions(cachedHospital.id)
        ]);
        h = freshH;
        setHospital(freshH);
        setSessions(sess);
        if (sess.length > 0 && !selectedSession) {
          setSelectedSession(sess[0]);
        }
      } else {
        h = await api.resolveHospitalBySlug(targetSlug);
        setHospital(h);
        const sess = await api.getPatientTodaySessions(h.id);
        setSessions(sess);
        if (sess.length > 0 && !selectedSession) {
          setSelectedSession(sess[0]);
        }
      }

      try {
        sessionStorage.setItem(cacheKey, JSON.stringify(h));
      } catch {
        // Ignore storage quota errors
      }

      // Check tenant-scoped saved token reference
      const tokenKey = `opd_patient_token_ref_${h.id}`;
      const savedBookingRef = localStorage.getItem(tokenKey) || localStorage.getItem('opd_patient_token_ref') || localStorage.getItem('citycare_patient_token_ref');
      if (savedBookingRef) {
        api.getTokenByReference(savedBookingRef)
          .then(t => {
            if (isTokenActiveToday(t)) {
              setActiveToken(t);
            } else {
              // Stored token is from an expired day - clear cache so today shows clean state
              localStorage.removeItem(tokenKey);
              localStorage.removeItem('opd_patient_token_ref');
              localStorage.removeItem('citycare_patient_token_ref');
              setActiveToken(null);
            }
          })
          .catch(() => {
            localStorage.removeItem(tokenKey);
            localStorage.removeItem('opd_patient_token_ref');
            localStorage.removeItem('citycare_patient_token_ref');
            setActiveToken(null);
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

    // 4. Background fallback polling (every 30 seconds when tab is active and visible)
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        refreshSessions(hospital.id);
      }
    }, 30000);

    return () => {
      if (bc) bc.close();
      window.removeEventListener('storage', handleStorage);
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
      window.removeEventListener('focus', handleVisibilityOrFocus);
      clearInterval(interval);
    };
  }, [hospital?.id, refreshSessions]);

  const getSessionReopenNote = (sessionId: string) => {
    const custom = localStorage.getItem(`opd_session_reopen_${sessionId}`);
    if (custom && custom.trim()) return custom.trim();
    return null;
  };

  // SSE Subscription for live patient token
  useEffect(() => {
    if (!activeToken) return;

    if (sseRef.current) {
      sseRef.current.close();
    }

    const sse = new EventSource(api.getStreamUrl(`/api/v1/patient/tokens/${activeToken.bookingReference}/stream`));
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
    if (selectedSession.status !== 'OPEN') {
      alert(lang === 'HI' ? 'यह ओपीडी सत्र वर्तमान में बंद / रोका गया है। कृपया डॉक्टर द्वारा सत्र शुरू होने की प्रतीक्षा करें।' : 'This OPD session is currently paused or closed. Booking is not permitted until session is opened.');
      return;
    }
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
        patientGender,
        reasonForVisit: reason.trim(),
        idempotencyKey: `online-${hospital.id}-${selectedSession.id}-${patientPhone.trim()}`,
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
        if (isTokenActiveToday(token)) {
          localStorage.setItem(`opd_patient_token_ref_${hospital.id}`, token.bookingReference);
          localStorage.setItem('opd_patient_token_ref', token.bookingReference);
          localStorage.removeItem('citycare_patient_token_ref');
        } else {
          localStorage.removeItem(`opd_patient_token_ref_${hospital.id}`);
          localStorage.removeItem('opd_patient_token_ref');
          localStorage.removeItem('citycare_patient_token_ref');
        }
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
      docsAvailable: `${displayedSessions.length} Doctors Available Today`,
      myToken: 'My Token',
      checkLiveToken: 'Check live token status',
      viewQueue: 'View Queue',
      realtimeStatus: 'Real-time room status',
      todayOpdDoctors: 'Available Doctors',
      liveOpd: 'Live OPD',
      chooseDoctorTitle: 'Choose Doctor For Token',
      tapToBookNotice: 'Select an available doctor below to book your consultation:',
      availableToday: 'Available Today',
      currentToken: 'Current Token',
      peopleWaiting: 'People Waiting',
      nextAvailableToken: 'Next Available Token',
      walkInsNotice: 'Reception Walk-Ins in queue ahead',
      getTokenBtn: 'Book OPD Token',
      confirmTokenTitle: 'Confirm Doctor Token',
      room: 'Room',
      todayOpdStatus: "TODAY'S OPD STATUS",
      confirmAndGetToken: (num: number) => `Confirm & Generate OPD Token #${num}`,
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
      docsAvailable: `आज ${displayedSessions.length} डॉक्टर उपलब्ध हैं`,
      myToken: 'मेरा टोकन',
      checkLiveToken: 'टोकन का लाइव स्टेटस देखें',
      viewQueue: 'कतार देखें',
      realtimeStatus: 'कमरे की लाइव स्थिति',
      todayOpdDoctors: 'उपलब्ध डॉक्टर्स',
      liveOpd: 'लाइव ओपीडी',
      chooseDoctorTitle: 'टोकन के लिए डॉक्टर चुनें',
      tapToBookNotice: 'परामर्श के लिए नीचे उपलब्ध डॉक्टर का चयन करें:',
      availableToday: 'आज उपलब्ध हैं',
      currentToken: 'अभी टोकन',
      peopleWaiting: 'इंतज़ार में',
      nextAvailableToken: 'अगला उपलब्ध टोकन',
      walkInsNotice: 'अस्पताल में पहले से आए मरीज़ आगे हैं',
      getTokenBtn: 'ओपीडी टोकन बुक करें',
      confirmTokenTitle: 'डॉक्टर टोकन की पुष्टि करें',
      room: 'कमरा नंबर',
      todayOpdStatus: 'आज की ओपीडी स्थिति (लाइव)',
      confirmAndGetToken: (num: number) => `पुष्टि करें और टोकन #${num} जनरेट करें`,
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
      {/* ========================================================================= */}
      {/* FULL-WIDTH RESPONSIVE NAVBAR PANEL (LAPTOP EDGE-TO-EDGE)                  */}
      {/* ========================================================================= */}
      <header className="bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-2xs w-full sticky top-0 z-30 transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2.5 sm:py-3 flex items-center justify-between">
          <div className="flex items-center space-x-2.5 sm:space-x-3 flex-1 min-w-0 mr-2 sm:mr-4">
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
                className="p-1.5 -ml-1 text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition cursor-pointer flex-shrink-0"
                title="Back"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}

            {/* Medical Heart Emblem */}
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200/90 text-emerald-600 flex items-center justify-center shadow-2xs flex-shrink-0">
              <HeartPulse className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-600" />
            </div>

            <div className="min-w-0 flex-1">
              <h1 className="font-extrabold text-sm sm:text-base md:text-lg leading-snug tracking-tight text-slate-900 line-clamp-2 sm:line-clamp-none break-words">
                {hospital ? hospital.name : 'Hospital OPD'}
              </h1>
              <p className="text-[11px] sm:text-xs text-slate-500 font-medium truncate hidden sm:block">
                {hospital?.address ? `${hospital.address} • ` : ''}{t.digitalPortal}
              </p>
            </div>
          </div>

          {/* Header Action Controls */}
          <div className="flex items-center space-x-1.5 sm:space-x-2">
            <button
              onClick={() => setShowHospitalInfoModal(true)}
              className="p-2 text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 rounded-xl transition cursor-pointer border border-transparent hover:border-emerald-200/60"
              title="Hospital Information"
            >
              <Info className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>

            <LanguageToggle variant="light" />

            {currentUser && onDashboardClick && (
              <button
                onClick={onDashboardClick}
                className="bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-200 text-xs sm:text-sm font-bold px-3 py-1.5 rounded-xl transition flex items-center space-x-1.5 cursor-pointer shadow-2xs"
                title="Return to Staff Dashboard"
              >
                <Building2 className="w-3.5 h-3.5 text-emerald-600" />
                <span className="hidden sm:inline">Dashboard ({currentUser.hospitalSlug || 'Staff'})</span>
                <span className="sm:hidden">Staff</span>
              </button>
            )}
          </div>
        </div>

        {/* Contact & Location Strip directly under navbar */}
        <div className="bg-slate-50/80 border-t border-slate-100 px-4 sm:px-6 lg:px-8 py-1.5 text-[11px] sm:text-xs text-slate-500">
          <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-y-1 gap-x-4">
            {hospital?.address && (
              <div className="flex items-center space-x-1.5">
                <MapPin className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                <span className="text-slate-600 truncate max-w-[280px] sm:max-w-none">{hospital.address}</span>
              </div>
            )}
            <div className="flex items-center space-x-1.5">
              <Clock className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
              <span className="text-slate-600">08:00 AM - 08:00 PM</span>
            </div>
            {hospital?.phone && (
              <div className="flex items-center space-x-1.5">
                <Phone className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                <a href={`tel:${hospital.phone}`} className="text-slate-600 hover:text-emerald-700 font-medium">
                  {hospital.phone}
                </a>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Area: Responsive container up to max-w-7xl on laptop / desktop */}
      <main className="max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 pt-4 pb-20 sm:py-8 flex-1 space-y-5 sm:space-y-6">
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
              {/* Modern Hero Card (matches mockup) */}
              <div className="bg-gradient-to-br from-emerald-50/90 via-teal-50/60 to-emerald-100/40 rounded-3xl p-4 sm:p-6 border border-emerald-200/70 shadow-xs relative overflow-hidden">
                <div className="flex items-start justify-between relative z-10">
                  <div className="pr-3">
                    <h2 className="text-lg sm:text-2xl font-black text-slate-900 tracking-tight leading-snug">
                      {lang === 'HI' ? 'अपना ओपीडी टोकन बुक करें' : 'Book Your OPD Token'}
                    </h2>
                    <p className="text-xs sm:text-sm text-slate-600 font-medium mt-1">
                      {lang === 'HI' ? 'घर बैठे कतार में लगें, समय बचाएं' : 'Get in line, save time'}
                    </p>
                    {/* Heartbeat pulse wave SVG graphic */}
                    <div className="mt-2.5 flex items-center space-x-2">
                      <svg className="w-28 sm:w-36 h-5 text-emerald-500" viewBox="0 0 120 20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M0 10 h25 l4 -8 l6 16 l6 -14 l5 10 l4 -4 h50" />
                      </svg>
                      <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider bg-emerald-100/80 px-2 py-0.5 rounded-full border border-emerald-200">
                        Live OPD Active
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => speakText(t.speechPrompt)}
                    className="flex-shrink-0 bg-white hover:bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs sm:text-sm font-bold px-3 sm:px-3.5 py-1.5 sm:py-2 rounded-xl flex items-center space-x-1.5 transition shadow-xs cursor-pointer active:scale-95"
                  >
                    <Volume2 className="w-4 h-4 text-emerald-600" />
                    <span>{t.listen}</span>
                  </button>
                </div>
              </div>

              {/* Pill-shaped Live Search Bar with Instant Results Dropdown */}
              <div className="relative z-20">
                <Search className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={doctorSearchQuery}
                  onChange={(e) => setDoctorSearchQuery(e.target.value)}
                  placeholder={lang === 'HI' ? "डॉक्टर, विभाग या कमरा नंबर खोजें..." : "Search doctor, department, or room..."}
                  className="w-full pl-11 pr-10 py-3 bg-white border border-slate-200/90 rounded-2xl sm:rounded-full text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition shadow-xs"
                />
                {doctorSearchQuery && (
                  <button
                    onClick={() => setDoctorSearchQuery('')}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 rounded-full cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}

                {/* Instant Floating Search Results Panel */}
                {doctorSearchQuery.trim().length > 0 && (
                  <div className="absolute left-0 right-0 top-full mt-2 bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden z-50 max-h-96 overflow-y-auto animate-in fade-in slide-in-from-top-2 duration-150 text-left">
                    {/* Header with Results Count */}
                    <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-100 flex items-center justify-between text-xs text-slate-500 font-medium">
                      <span>
                        {filteredSessions.length > 0 
                          ? `${filteredSessions.length} doctor${filteredSessions.length > 1 ? 's' : ''} found`
                          : (lang === 'HI' ? 'कोई डॉक्टर नहीं मिला' : 'No doctors found')}
                      </span>
                      <button
                        onClick={() => setDoctorSearchQuery('')}
                        className="text-xs text-emerald-600 hover:text-emerald-700 font-bold cursor-pointer"
                      >
                        {lang === 'HI' ? 'बंद करें' : 'Close'}
                      </button>
                    </div>

                    {/* Quick Token Lookup Helper if user typed phone or token number */}
                    {/\d/.test(doctorSearchQuery) && (
                      <div
                        onClick={() => {
                          const q = doctorSearchQuery.trim();
                          setLookupQuery(q);
                          setDoctorSearchQuery('');
                          setViewState('MY_TOKEN');
                        }}
                        className="px-4 py-3 bg-amber-50/80 hover:bg-amber-100/80 border-b border-amber-200/60 cursor-pointer transition flex items-center justify-between"
                      >
                        <div className="flex items-center space-x-2.5">
                          <Ticket className="w-4 h-4 text-amber-700 flex-shrink-0" />
                          <div>
                            <p className="text-xs font-bold text-amber-950">
                              {lang === 'HI' ? `"${doctorSearchQuery}" के लिए लाइव टोकन खोजें` : `Search today's token for "${doctorSearchQuery}"`}
                            </p>
                            <p className="text-[10px] text-amber-700">Check live turn by mobile number or token ID</p>
                          </div>
                        </div>
                        <ArrowRight className="w-4 h-4 text-amber-700" />
                      </div>
                    )}

                    {/* Matching Doctor Results */}
                    {filteredSessions.length > 0 ? (
                      <div className="divide-y divide-slate-100">
                        {filteredSessions.map((s) => (
                          <div
                            key={s.id}
                            onClick={() => {
                              if (s.status === 'OPEN') {
                                setSelectedSession(s);
                                setDoctorSearchQuery('');
                                setViewState('CONFIRM_TOKEN');
                              }
                            }}
                            className="p-3 sm:p-4 hover:bg-emerald-50/50 cursor-pointer transition flex items-center justify-between gap-3"
                          >
                            <div className="flex items-center space-x-3 min-w-0">
                              <img
                                src={s.doctorPhotoUrl || "https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=300&auto=format&fit=crop&q=80"}
                                alt={s.doctorName}
                                className="w-11 h-11 rounded-xl object-cover ring-1 ring-slate-200 flex-shrink-0"
                              />
                              <div className="min-w-0">
                                <h4 className="font-bold text-sm text-slate-900 truncate">{s.doctorName}</h4>
                                <p className="text-xs text-emerald-800 font-semibold truncate">{s.doctorSpecialty}</p>
                                <div className="flex items-center gap-2 text-[10px] text-slate-500 mt-0.5">
                                  <span>Room {s.doctorRoomNumber}</span>
                                  <span>•</span>
                                  <span className={s.status === 'OPEN' ? 'text-emerald-700 font-bold' : 'text-slate-400'}>
                                    {s.status === 'OPEN' ? 'Available' : s.status}
                                  </span>
                                </div>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedSession(s);
                                setDoctorSearchQuery('');
                                setViewState('CONFIRM_TOKEN');
                              }}
                              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-3 py-1.5 rounded-xl shadow-2xs transition flex-shrink-0 flex items-center space-x-1 cursor-pointer"
                            >
                              <span>Book</span>
                              <ArrowRight className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-6 text-center text-xs text-slate-500">
                        <p className="font-semibold text-slate-700">No doctors found matching "{doctorSearchQuery}"</p>
                        <p className="text-[11px] text-slate-400 mt-1">Try searching by specialty (e.g. Cardiology, Orthopedic) or doctor name</p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Modern 2x2 Feature Grid (Mobile: 2 cols, Desktop/Laptop: 4 cols) */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
                {/* 1. My Tokens */}
                <div
                  onClick={() => setViewState('MY_TOKEN')}
                  className="bg-gradient-to-br from-amber-50/90 via-orange-50/50 to-amber-100/30 hover:from-amber-100/80 hover:to-orange-100/60 border border-amber-200/80 hover:border-amber-300 p-3.5 sm:p-4 rounded-2xl shadow-xs hover:shadow-md cursor-pointer transition flex flex-col justify-between group active:scale-[0.98]"
                >
                  <div className="flex items-start justify-between">
                    <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 text-white flex items-center justify-center shadow-xs">
                      <Ticket className="w-5 h-5 sm:w-6 sm:h-6" />
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                      activeToken && isTokenActiveToday(activeToken)
                        ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                        : 'bg-amber-100/80 text-amber-800 border-amber-200'
                    }`}>
                      {activeToken && isTokenActiveToday(activeToken)
                        ? `#${activeToken.tokenNumber} Active`
                        : (lang === 'HI' ? 'कोई टोकन नहीं' : 'No active token')}
                    </span>
                  </div>
                  <div className="mt-3 sm:mt-4">
                    <div className="flex items-center justify-between">
                      <h3 className="font-extrabold text-sm sm:text-base text-slate-900 group-hover:text-amber-900">
                        {lang === 'HI' ? 'मेरे टोकन' : 'My Tokens'}
                      </h3>
                      <ArrowRight className="w-4 h-4 text-amber-500 group-hover:translate-x-1 transition-transform" />
                    </div>
                    <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5 line-clamp-1">
                      {lang === 'HI' ? 'बुक किए गए टोकन देखें' : 'View your booked tokens'}
                    </p>
                  </div>
                </div>

                {/* 2. Queue Status */}
                <div
                  onClick={() => setViewState('VIEW_QUEUE')}
                  className="bg-gradient-to-br from-purple-50/90 via-indigo-50/50 to-purple-100/30 hover:from-purple-100/80 hover:to-indigo-100/60 border border-purple-200/80 hover:border-purple-300 p-3.5 sm:p-4 rounded-2xl shadow-xs hover:shadow-md cursor-pointer transition flex flex-col justify-between group active:scale-[0.98]"
                >
                  <div className="flex items-start justify-between">
                    <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 text-white flex items-center justify-center shadow-xs">
                      <Users className="w-5 h-5 sm:w-6 sm:h-6" />
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-purple-100/80 text-purple-800 border-purple-200 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse"></span>
                      <span>Live</span>
                    </span>
                  </div>
                  <div className="mt-3 sm:mt-4">
                    <div className="flex items-center justify-between">
                      <h3 className="font-extrabold text-sm sm:text-base text-slate-900 group-hover:text-purple-900">
                        {lang === 'HI' ? 'कतार की स्थिति' : 'Queue Status'}
                      </h3>
                      <ArrowRight className="w-4 h-4 text-purple-500 group-hover:translate-x-1 transition-transform" />
                    </div>
                    <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5 line-clamp-1">
                      {lang === 'HI' ? 'लाइव वेटिंग लाइन देखें' : 'Check current waiting line'}
                    </p>
                  </div>
                </div>

                {/* 3. Doctors */}
                <div
                  onClick={() => setViewState('DOCTOR_LIST')}
                  className="bg-gradient-to-br from-sky-50/90 via-cyan-50/50 to-sky-100/30 hover:from-sky-100/80 hover:to-cyan-100/60 border border-sky-200/80 hover:border-sky-300 p-3.5 sm:p-4 rounded-2xl shadow-xs hover:shadow-md cursor-pointer transition flex flex-col justify-between group active:scale-[0.98]"
                >
                  <div className="flex items-start justify-between">
                    <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-gradient-to-br from-sky-500 to-teal-600 text-white flex items-center justify-center shadow-xs">
                      <Stethoscope className="w-5 h-5 sm:w-6 sm:h-6" />
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-sky-100/80 text-sky-800 border-sky-200">
                      {displayedSessions.filter(s => s.status === 'OPEN').length} {lang === 'HI' ? 'उपलब्ध' : 'Available'}
                    </span>
                  </div>
                  <div className="mt-3 sm:mt-4">
                    <div className="flex items-center justify-between">
                      <h3 className="font-extrabold text-sm sm:text-base text-slate-900 group-hover:text-sky-900">
                        {lang === 'HI' ? 'डॉक्टर्स' : 'Doctors'}
                      </h3>
                      <ArrowRight className="w-4 h-4 text-sky-500 group-hover:translate-x-1 transition-transform" />
                    </div>
                    <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5 line-clamp-1">
                      {lang === 'HI' ? 'विशेषज्ञ डॉक्टर और बुकिंग' : 'Browse OPD specialists'}
                    </p>
                  </div>
                </div>

                {/* 4. Hospital Info */}
                <div
                  onClick={() => setShowHospitalInfoModal(true)}
                  className="bg-gradient-to-br from-emerald-50/90 via-teal-50/50 to-emerald-100/30 hover:from-emerald-100/80 hover:to-teal-100/60 border border-emerald-200/80 hover:border-emerald-300 p-3.5 sm:p-4 rounded-2xl shadow-xs hover:shadow-md cursor-pointer transition flex flex-col justify-between group active:scale-[0.98]"
                >
                  <div className="flex items-start justify-between">
                    <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white flex items-center justify-center shadow-xs">
                      <Building2 className="w-5 h-5 sm:w-6 sm:h-6" />
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-emerald-100/80 text-emerald-800 border-emerald-200">
                      {lang === 'HI' ? 'खुला है' : 'Open'}
                    </span>
                  </div>
                  <div className="mt-3 sm:mt-4">
                    <div className="flex items-center justify-between">
                      <h3 className="font-extrabold text-sm sm:text-base text-slate-900 group-hover:text-emerald-900">
                        {lang === 'HI' ? 'अस्पताल जानकारी' : 'Hospital Info'}
                      </h3>
                      <ArrowRight className="w-4 h-4 text-emerald-500 group-hover:translate-x-1 transition-transform" />
                    </div>
                    <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5 line-clamp-1">
                      {lang === 'HI' ? 'समय, पता और संपर्क' : 'Timings, location & contact'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Doctors Catalog Grid on Homepage (Laptop: 3-column responsive grid) */}
              <div className="pt-2">
                <div className="flex items-center justify-between mb-3.5 flex-wrap gap-2">
                  <div className="flex items-center space-x-2">
                    <h3 className="text-sm sm:text-base font-extrabold text-slate-900 tracking-tight">
                      {t.todayOpdDoctors}
                    </h3>
                    <span className="text-xs font-bold text-slate-400">
                      ({filteredSessions.length})
                    </span>
                  </div>
                  <span className="inline-flex items-center space-x-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    <span>{t.liveOpd}</span>
                  </span>
                </div>

                {filteredSessions.length === 0 ? (
                  <div className="bg-white rounded-2xl p-8 text-center border border-slate-200 shadow-xs">
                    <Search className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                    <p className="font-bold text-slate-700 text-sm">
                      {lang === 'HI' ? 'कोई डॉक्टर नहीं मिला' : 'No doctors found matching your search'}
                    </p>
                    <p className="text-xs text-slate-400 mt-1">"{doctorSearchQuery}"</p>
                    <button
                      onClick={() => setDoctorSearchQuery('')}
                      className="mt-3 text-xs font-bold text-emerald-600 hover:text-emerald-700 underline cursor-pointer"
                    >
                      {lang === 'HI' ? 'सभी डॉक्टर देखें' : 'View all doctors'}
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredSessions.map((s) => (
                    <div
                      key={s.id}
                      onClick={() => {
                        if (s.status === 'OPEN') {
                          setSelectedSession(s);
                          setViewState('CONFIRM_TOKEN');
                        }
                      }}
                      className={`bg-white rounded-2xl p-4 border transition-all duration-200 flex flex-col justify-between space-y-3 group ${
                        s.status === 'OPEN'
                          ? 'border-slate-200/90 hover:border-emerald-500 shadow-xs hover:shadow-md cursor-pointer'
                          : 'border-slate-200 bg-slate-50/50 cursor-default'
                      }`}
                    >
                      <div className="flex items-start space-x-3">
                        <div className="relative flex-shrink-0">
                          <img
                            src={s.doctorPhotoUrl || "https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=300&auto=format&fit=crop&q=80"}
                            alt={s.doctorName}
                            className="w-16 h-16 rounded-xl object-cover ring-1 ring-slate-200/80 shadow-2xs"
                          />
                          <span className="absolute -bottom-1 -right-1 bg-emerald-600 text-white rounded-full p-0.5 shadow-2xs ring-2 ring-white">
                            <CheckCircle2 className="w-3 h-3" />
                          </span>
                        </div>

                        <div className="flex-1 min-w-0">
                          <h4 className="font-bold text-sm md:text-base text-slate-900 truncate group-hover:text-emerald-950 transition-colors">
                            {s.doctorName}
                          </h4>
                          <div className="flex items-center gap-1.5 text-xs text-emerald-800 font-semibold mt-0.5">
                            <Stethoscope className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                            <span className="truncate">{s.doctorSpecialty}</span>
                          </div>
                          {s.doctorQualification && (
                            <div className="flex items-center gap-1.5 text-[11px] text-slate-600 font-medium mt-0.5">
                              <GraduationCap className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                              <span className="truncate">{s.doctorQualification}</span>
                            </div>
                          )}
                          <div className="flex items-center gap-1.5 text-[11px] text-slate-500 mt-1 flex-wrap">
                            <span className="flex items-center gap-1">
                              <DoorClosed className="w-3 h-3 text-slate-400" />
                              <span>{s.doctorRoomNumber}</span>
                            </span>
                            <span className={`inline-flex items-center gap-1 font-bold px-2 py-0.5 rounded-md text-[10px] ${
                              isEveningSession(s)
                                ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                                : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            }`}>
                              {isEveningSession(s) ? <Sunset className="w-2.5 h-2.5" /> : <Sunrise className="w-2.5 h-2.5" />}
                              <span>{isEveningSession(s) ? 'Evening OPD' : 'Morning OPD'}</span>
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                        <div className="space-x-2 text-slate-600 font-mono">
                          <span>Serving: <b className="text-slate-900 font-bold">{s.currentServingToken ? `#${s.currentServingToken}` : '—'}</b></span>
                          <span>Waiting: <b className="text-emerald-700 font-bold">{s.waitingCount}</b></span>
                        </div>
                        {s.status === 'PAUSED' ? (
                          <div className="flex items-center space-x-1 text-[11px] font-bold text-amber-800 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-300" title="Doctor has stepped out / is on break">
                            <PauseCircle className="w-3.5 h-3.5 text-amber-600" />
                            <span>{lang === 'HI' ? 'डॉक्टर ब्रेक पर हैं' : 'Doctor on Break'}</span>
                          </div>
                        ) : s.status === 'CLOSED' ? (
                          <span className="text-[11px] font-bold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200">
                            {lang === 'HI' ? 'सत्र समाप्त' : 'Closed'}
                          </span>
                        ) : (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedSession(s);
                              setViewState('CONFIRM_TOKEN');
                            }}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-3.5 py-1.5 rounded-xl shadow-xs transition flex items-center gap-1 group-hover:bg-emerald-700 cursor-pointer"
                          >
                            <span>Book Token</span>
                            <ArrowRight className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

          {/* ========================================================================= */}
          {/* SCREEN 2: CHOOSE DOCTOR FOR TOKEN (Responsive Grid) */}
          {/* ========================================================================= */}
          {viewState === 'DOCTOR_LIST' && (
            <div className="space-y-4">
              <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-2xl p-3.5 md:p-4 flex items-center justify-between text-xs md:text-sm text-emerald-950 font-medium shadow-2xs">
                <span className="flex items-center space-x-2.5">
                  <Sparkles className="w-4 h-4 text-emerald-700 flex-shrink-0" />
                  <span className="font-semibold text-slate-800">{t.tapToBookNotice}</span>
                </span>
                <button
                  onClick={() => speakText(lang === 'HI' ? 'कृपया अपना डॉक्टर चुनें' : 'Please choose your doctor')}
                  className="text-emerald-800 hover:text-emerald-950 font-semibold flex items-center space-x-1.5 cursor-pointer bg-white px-3 py-1.5 rounded-xl border border-emerald-200 shadow-2xs hover:bg-emerald-50 transition"
                >
                  <Volume2 className="w-4 h-4 text-emerald-700" />
                  <span>{t.listen}</span>
                </button>
              </div>

              {/* Search Bar on DOCTOR_LIST screen */}
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={doctorSearchQuery}
                  onChange={(e) => setDoctorSearchQuery(e.target.value)}
                  placeholder={lang === 'HI' ? "डॉक्टर, विभाग या कमरा नंबर खोजें..." : "Search by doctor name, specialty, room..."}
                  className="w-full pl-11 pr-10 py-3 bg-white border border-slate-200/90 rounded-2xl text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition shadow-xs"
                />
                {doctorSearchQuery && (
                  <button
                    onClick={() => setDoctorSearchQuery('')}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 rounded-full cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {filteredSessions.length === 0 ? (
                <div className="bg-white rounded-2xl p-8 text-center border border-slate-200 shadow-xs">
                  <Search className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                  <p className="font-bold text-slate-700 text-sm">
                    {lang === 'HI' ? 'कोई डॉक्टर नहीं मिला' : 'No doctors found matching your search'}
                  </p>
                  <p className="text-xs text-slate-400 mt-1">"{doctorSearchQuery}"</p>
                  <button
                    onClick={() => setDoctorSearchQuery('')}
                    className="mt-3 text-xs font-bold text-emerald-600 hover:text-emerald-700 underline cursor-pointer"
                  >
                    {lang === 'HI' ? 'सभी डॉक्टर देखें' : 'View all doctors'}
                  </button>
                </div>
              ) : (
                /* Grid: 1 col on mobile, 2 on tablet, 3 on laptop/desktop */
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {filteredSessions.map((s) => (
                    <div
                      key={s.id}
                      className="bg-white rounded-2xl p-5 shadow-xs border border-slate-200/90 flex flex-col justify-between space-y-4 hover:border-emerald-500 hover:shadow-md transition-all duration-200 group"
                    >
                    <div className="space-y-3.5">
                      <div className="flex items-start space-x-3.5">
                        <div className="relative flex-shrink-0">
                          <img
                            src={s.doctorPhotoUrl || "https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=300&auto=format&fit=crop&q=80"}
                            alt={s.doctorName}
                            className="w-20 h-20 rounded-2xl object-cover ring-1 ring-slate-200/80 shadow-2xs"
                          />
                          <span className="absolute -bottom-1 -right-1 bg-emerald-600 text-white rounded-full p-1 shadow-xs ring-2 ring-white">
                            <CheckCircle2 className="w-3 h-3" />
                          </span>
                        </div>

                        <div className="flex-1 min-w-0">
                          <h3 className="font-bold text-base text-slate-900 tracking-tight group-hover:text-emerald-950 transition-colors">
                            {s.doctorName}
                          </h3>
                          <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-800 mt-0.5">
                            <Stethoscope className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                            <span className="truncate">{s.doctorSpecialty}</span>
                          </div>
                          {s.doctorQualification && (
                            <div className="flex items-center gap-1.5 text-[11px] text-slate-600 font-medium mt-0.5">
                              <GraduationCap className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                              <span className="truncate">{s.doctorQualification}</span>
                            </div>
                          )}
                          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200/60">
                              <DoorClosed className="w-3 h-3 text-slate-400" />
                              <span>{s.doctorRoomNumber}</span>
                            </span>
                            <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md border ${
                              isEveningSession(s)
                                ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                                : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            }`}>
                              {isEveningSession(s) ? <Sunset className="w-3 h-3" /> : <Sunrise className="w-3 h-3" />}
                              <span>{isEveningSession(s) ? 'Evening OPD' : 'Morning OPD'}</span>
                            </span>
                            {s.status === 'PAUSED' && (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-md border border-amber-300">
                                <PauseCircle className="w-3 h-3 text-amber-600" />
                                <span>{lang === 'HI' ? 'डॉक्टर ब्रेक पर हैं' : 'On Break'}</span>
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Stats Grid */}
                      <div className="grid grid-cols-2 gap-2 text-center text-xs">
                        <div className="bg-slate-50/80 p-2.5 rounded-xl border border-slate-100">
                          <span className="text-slate-400 text-[10px] block uppercase font-bold tracking-wider">{t.currentToken}:</span>
                          <span className="font-bold text-slate-900 text-lg font-mono">
                            {s.currentServingToken ? `#${s.currentServingToken}` : '—'}
                          </span>
                        </div>
                        <div className="bg-emerald-50/50 p-2.5 rounded-xl border border-emerald-100/60">
                          <span className="text-emerald-800/70 text-[10px] block uppercase font-bold tracking-wider">{t.peopleWaiting}:</span>
                          <span className="font-bold text-emerald-700 text-lg font-mono">{s.waitingCount}</span>
                        </div>
                      </div>

                      {/* Next Token Callout Box OR Break Notice */}
                      {s.status === 'PAUSED' ? (
                        <div className="bg-amber-50/90 border border-amber-200 rounded-xl p-3 text-xs space-y-1">
                          <div className="flex items-center space-x-1.5 text-amber-900 font-extrabold">
                            <PauseCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                            <span>{lang === 'HI' ? 'डॉक्टर ब्रेक पर हैं (सत्र रुका हुआ है)' : 'Doctor on Break (Session Paused)'}</span>
                          </div>
                          <p className="text-[11px] text-amber-800">
                            {lang === 'HI'
                              ? 'डॉक्टर किसी आवश्यक कार्य से बाहर गए हैं / अवकाश पर हैं। टोकन बुकिंग शीघ्र ही फिर से शुरू होगी।'
                              : 'The doctor has stepped out for urgent work / is on a temporary break. Token booking will resume shortly.'}
                          </p>
                        </div>
                      ) : s.status === 'CLOSED' ? (
                        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs">
                          <p className="font-bold text-slate-700">
                            {lang === 'HI' ? 'यह ओपीडी सत्र आज के लिए समाप्त हो गया है।' : 'This OPD session is closed for today.'}
                          </p>
                        </div>
                      ) : (
                        <div className="bg-gradient-to-r from-amber-50/90 to-amber-50/40 border border-amber-200/80 rounded-xl p-3 flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center flex-shrink-0">
                              <Ticket className="w-4 h-4" />
                            </div>
                            <div>
                              <span className="font-bold text-amber-950 block">{t.nextAvailableToken}:</span>
                              <span className="text-[10px] text-amber-800/80">
                                {s.totalWalkinCount > 0 
                                  ? `(${s.totalWalkinCount} ${t.walkInsNotice})` 
                                  : '(Immediate Entry)'}
                              </span>
                            </div>
                          </div>
                          <span className="text-lg font-black text-amber-900 bg-white px-3 py-1 rounded-lg border border-amber-200 shadow-2xs font-mono">
                            #{s.nextTokenSequence}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* CTA Button */}
                    {s.status === 'PAUSED' ? (
                      <button
                        disabled
                        className="w-full bg-amber-50 text-amber-800 font-bold py-3 px-4 rounded-xl text-xs flex items-center justify-center gap-2 cursor-not-allowed border border-amber-200"
                      >
                        <PauseCircle className="w-4 h-4 text-amber-600" />
                        <span>{lang === 'HI' ? 'बुकिंग रुकी हुई है (डॉक्टर ब्रेक पर)' : 'Booking Paused (Doctor on Break)'}</span>
                      </button>
                    ) : s.status === 'CLOSED' ? (
                      <button
                        disabled
                        className="w-full bg-slate-100 text-slate-500 font-bold py-3 px-4 rounded-xl text-xs flex items-center justify-center gap-2 cursor-not-allowed border border-slate-200"
                      >
                        <span>{lang === 'HI' ? 'सत्र समाप्त (Closed)' : 'Session Closed'}</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => {
                          setSelectedSession(s);
                          setViewState('CONFIRM_TOKEN');
                        }}
                        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-4 rounded-xl shadow-xs hover:shadow-md transition-all duration-200 text-sm flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99] group"
                      >
                        <span>{t.getTokenBtn}</span>
                        <ArrowRight className="w-4 h-4 text-emerald-100 group-hover:translate-x-1 transition-transform" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

          {/* ========================================================================= */}
          {/* SCREEN 3: CONFIRM & BOOK TOKEN (Laptop: 2-column split layout) */}
          {/* ========================================================================= */}
          {viewState === 'CONFIRM_TOKEN' && selectedSession && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Left Column on Laptop (5 cols): Doctor Info Card */}
              <div className="lg:col-span-5 bg-white rounded-2xl p-6 shadow-xs border border-slate-200 text-center space-y-4">
                <div className="relative inline-block mx-auto">
                  <img
                    src={selectedSession.doctorPhotoUrl || "https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=300&auto=format&fit=crop&q=80"}
                    alt={selectedSession.doctorName}
                    className="w-28 h-28 rounded-2xl object-cover ring-2 ring-emerald-500/80 shadow-md mx-auto"
                  />
                  <span className="absolute -bottom-1 -right-1 bg-emerald-600 text-white rounded-full p-1.5 shadow-xs ring-2 ring-white">
                    <CheckCircle2 className="w-4 h-4" />
                  </span>
                </div>

                <div>
                  <h3 className="font-bold text-xl text-slate-900 tracking-tight">{selectedSession.doctorName}</h3>
                  <div className="flex items-center justify-center gap-1.5 text-sm text-emerald-800 font-semibold mt-1">
                    <Stethoscope className="w-4 h-4 text-emerald-600" />
                    <span>{selectedSession.doctorSpecialty}</span>
                  </div>
                  {selectedSession.doctorQualification && (
                    <div className="flex items-center justify-center gap-1.5 text-xs text-slate-600 font-medium mt-1">
                      <GraduationCap className="w-4 h-4 text-slate-400" />
                      <span>{selectedSession.doctorQualification}</span>
                    </div>
                  )}
                  <p className="text-xs text-slate-500 mt-2 flex items-center justify-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-slate-400" />
                    <span>{hospital?.name || 'City Care Hospital'}</span>
                    <span className="text-slate-300">•</span>
                    <DoorClosed className="w-3.5 h-3.5 text-slate-400" />
                    <span>{selectedSession.doctorRoomNumber}</span>
                  </p>
                </div>

                <button
                  onClick={() => speakText(`${selectedSession.doctorName}. ${selectedSession.doctorSpecialty}. ${selectedSession.doctorRoomNumber}.`)}
                  className="inline-flex items-center space-x-2 text-xs md:text-sm text-slate-700 bg-slate-100 hover:bg-slate-200 px-4 py-2 rounded-xl font-semibold transition cursor-pointer"
                >
                  <Volume2 className="w-4 h-4 text-emerald-600" />
                  <span>Listen to Doctor Info</span>
                </button>
              </div>

              {/* Right Column on Laptop (7 cols): Live OPD Status & Input Form */}
              <div className="lg:col-span-7 space-y-4">
                {/* Dark Live OPD Status Box */}
                <div className="bg-slate-900 text-white rounded-2xl p-6 shadow-md space-y-4 border border-slate-800">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center space-x-2 text-xs font-bold uppercase tracking-wider text-emerald-400">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping"></span>
                      <span>{t.todayOpdStatus}</span>
                    </span>
                    <span className="text-xs text-slate-400 font-mono">Live Sync</span>
                  </div>

                  {/* 3 Stats Boxes */}
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700/80">
                      <span className="text-[10px] md:text-xs text-slate-400 block">{t.currentToken}</span>
                      <span className="text-xl md:text-2xl font-bold font-mono text-emerald-400">
                        {selectedSession.currentServingToken ? `#${selectedSession.currentServingToken}` : '—'}
                      </span>
                    </div>
                    <div className="bg-amber-950/40 p-3 rounded-xl border border-amber-600/30">
                      <span className="text-[10px] md:text-xs text-amber-300 block">{t.nextAvailableToken}</span>
                      <span className="text-xl md:text-2xl font-bold font-mono text-amber-400">
                        #{selectedSession.nextTokenSequence}
                      </span>
                    </div>
                    <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700/80">
                      <span className="text-[10px] md:text-xs text-slate-400 block">{t.peopleWaiting}</span>
                      <span className="text-xl md:text-2xl font-bold font-mono text-white">
                        {selectedSession.waitingCount}
                      </span>
                    </div>
                  </div>

                  {/* Walk-in notice banner (only shown if walk-ins exist) */}
                  {selectedSession.totalWalkinCount > 0 && (
                    <div className="bg-blue-950/70 border border-blue-800/60 rounded-xl p-3 text-xs md:text-sm text-blue-200 flex items-center space-x-2.5">
                      <Ticket className="w-4 h-4 text-blue-300 flex-shrink-0" />
                      <span>
                        {selectedSession.totalWalkinCount} Reception Walk-In Patient(s) registered ahead at front desk
                      </span>
                    </div>
                  )}
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

                    {/* Premium Gender Selection */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                        {lang === 'HI' ? 'लिंग / Gender' : 'Gender'} <span className="text-emerald-600">*</span>
                      </label>
                      <div className="grid grid-cols-2 p-1 bg-slate-100 rounded-2xl border border-slate-200/80 gap-1.5">
                        <button
                          type="button"
                          onClick={() => setPatientGender('MALE')}
                          className={`py-2.5 px-3 rounded-xl text-xs font-bold transition-all duration-150 flex items-center justify-center cursor-pointer ${
                            patientGender === 'MALE'
                              ? 'bg-white text-emerald-900 shadow-xs border border-slate-200/60 ring-1 ring-black/5'
                              : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                          }`}
                        >
                          <span>{lang === 'HI' ? 'पुरुष (Male)' : 'Male'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setPatientGender('FEMALE')}
                          className={`py-2.5 px-3 rounded-xl text-xs font-bold transition-all duration-150 flex items-center justify-center cursor-pointer ${
                            patientGender === 'FEMALE'
                              ? 'bg-white text-emerald-900 shadow-xs border border-slate-200/60 ring-1 ring-black/5'
                              : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                          }`}
                        >
                          <span>{lang === 'HI' ? 'महिला (Female)' : 'Female'}</span>
                        </button>
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
                {selectedSession.status === 'PAUSED' || selectedSession.status === 'CLOSED' ? (
                  <div className="space-y-2">
                    <div className="p-4 bg-amber-50 border border-amber-300 rounded-2xl text-xs text-amber-900 flex items-center space-x-2.5">
                      <Clock className="w-5 h-5 text-amber-600 flex-shrink-0" />
                      <div>
                        <p className="font-extrabold text-sm">OPD Session is Currently Paused</p>
                        <p className="text-amber-700 mt-0.5">
                          {getSessionReopenNote(selectedSession.id) ? (
                            <>Doctor has scheduled this session to reopen at <strong>{getSessionReopenNote(selectedSession.id)}</strong>.</>
                          ) : (
                            <>Doctor has temporarily paused token bookings for this session.</>
                          )} Please return when the session reopens to book your token.
                        </p>
                      </div>
                    </div>
                    <button
                      disabled
                      className="w-full bg-slate-200 text-slate-500 font-bold py-4 rounded-2xl text-sm flex items-center justify-center space-x-2 cursor-not-allowed"
                    >
                      <span>{getSessionReopenNote(selectedSession.id) ? `Booking Paused • Reopens ${getSessionReopenNote(selectedSession.id)}` : 'Booking Paused by Doctor'}</span>
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={handleConfirmBooking}
                    disabled={loading || !patientName.trim() || patientPhone.length < 10 || !patientLocation.trim()}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white font-black py-4 rounded-2xl shadow-xl transition text-base md:text-lg flex items-center justify-center space-x-2 cursor-pointer active:scale-[0.99]"
                  >
                    <span>{loading ? 'Generating...' : t.confirmAndGetToken(selectedSession.nextTokenSequence)}</span>
                  </button>
                )}
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
                  <div className="flex items-center justify-between gap-2 pt-1 pb-1">
                    <button
                      type="button"
                      onClick={() => {
                        setActiveToken(null);
                        setLookupQuery('');
                        setLookupTokensList([]);
                        setViewState('MY_TOKEN');
                      }}
                      className="inline-flex items-center space-x-1.5 text-xs sm:text-sm font-bold text-emerald-800 bg-white hover:bg-emerald-50 border border-emerald-300 px-3 py-2 rounded-xl transition shadow-xs cursor-pointer active:scale-95"
                    >
                      <ArrowLeft className="w-3.5 h-3.5 text-emerald-700 flex-shrink-0" />
                      <span>{lang === 'HI' ? 'अन्य नंबर से खोजें' : 'Search Another Phone'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveToken(null);
                        setViewState('HOME');
                      }}
                      className="text-xs font-bold text-emerald-800 hover:text-emerald-950 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-3 py-2 rounded-xl transition cursor-pointer"
                    >
                      {lang === 'HI' ? 'होम' : 'Back to Home'}
                    </button>
                  </div>

                  {activeToken.status === 'CALLED' && isTokenActiveToday(activeToken) && (
                    <div className="p-4 sm:p-5 bg-emerald-500 text-white rounded-3xl shadow-xl flex items-center space-x-3 sm:space-x-4 animate-bounce">
                      <Volume2 className="w-9 h-9 sm:w-10 sm:h-10 flex-shrink-0" />
                      <div>
                        <h3 className="font-extrabold text-base sm:text-lg">{t.calledAlert}</h3>
                        <p className="text-xs sm:text-sm text-emerald-100">{activeToken.doctorName} • {activeToken.doctorRoomNumber}</p>
                      </div>
                    </div>
                  )}

                  <div className="bg-white rounded-3xl p-5 sm:p-7 shadow-md border border-slate-200 text-center relative overflow-hidden">
                    {/* Top Row: Clean Flex Badges (NEVER absolute, prevents overlap with token title) */}
                    <div className="flex items-center justify-between gap-2 mb-4 pb-3 border-b border-slate-100">
                      <span className={`inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-[11px] font-bold shadow-2xs flex-shrink-0 ${
                        isTokenActiveToday(activeToken)
                          ? 'text-emerald-800 bg-emerald-50 border border-emerald-200'
                          : 'text-amber-900 bg-amber-50 border border-amber-300'
                      }`}>
                        <Calendar className={`w-3.5 h-3.5 ${isTokenActiveToday(activeToken) ? 'text-emerald-600' : 'text-amber-600'}`} />
                        <span>
                          {isTokenActiveToday(activeToken)
                            ? (lang === 'HI' ? 'आज की ओपीडी' : "Today's OPD")
                            : (lang === 'HI' ? `ओपीडी सत्र: ${activeToken.sessionDate || 'पिछली तारीख'}` : `Session Date: ${activeToken.sessionDate || 'Past Date'}`)}
                        </span>
                      </span>

                      {!isTokenActiveToday(activeToken) ? (
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider flex-shrink-0 bg-rose-100 text-rose-800 border border-rose-300">
                          {lang === 'HI' ? 'समाप्त (EXPIRED)' : 'EXPIRED'}
                        </span>
                      ) : (
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider flex-shrink-0 ${
                          activeToken.status === 'CALLED'
                            ? 'bg-emerald-100 text-emerald-800 animate-pulse border border-emerald-300'
                            : activeToken.status === 'IN_CONSULTATION'
                            ? 'bg-blue-100 text-blue-800 border border-blue-300'
                            : activeToken.status === 'COMPLETED'
                            ? 'bg-slate-100 text-slate-700 border border-slate-300'
                            : 'bg-amber-100 text-amber-800 border border-amber-300'
                        }`}>
                          {activeToken.status}
                        </span>
                      )}
                    </div>

                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">{t.yourToken}</p>
                    <div className={`text-6xl sm:text-7xl font-black my-1 tracking-tight ${
                      isTokenActiveToday(activeToken) ? 'text-emerald-600' : 'text-slate-400'
                    }`}>
                      #{activeToken.tokenNumber}
                    </div>

                    {isTokenActiveToday(activeToken) ? (
                      <p className="text-[11px] font-semibold text-emerald-700 mb-2 flex items-center justify-center space-x-1">
                        <Calendar className="w-3 h-3 flex-shrink-0" />
                        <span>
                          {lang === 'HI'
                            ? 'आज का ओपीडी टोकन • केवल आज मान्य'
                            : "Today's Token • Valid for today's OPD only"}
                        </span>
                      </p>
                    ) : (
                      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3.5 my-2 text-center text-xs text-amber-950">
                        <p className="font-bold text-amber-900 flex items-center justify-center gap-1.5">
                          <AlertCircle className="w-4 h-4 text-amber-700 flex-shrink-0" />
                          <span>{lang === 'HI' ? 'यह टोकन समाप्त (Expire) हो चुका है' : 'This Token Has Expired'}</span>
                        </p>
                        <p className="text-[11px] text-amber-800 mt-1 leading-relaxed">
                          {lang === 'HI'
                            ? `यह टोकन ${activeToken.sessionDate || 'पिछली तारीख'} के ओपीडी सत्र का था। आज डॉक्टर को दिखाने के लिए नया टोकन बुक करें।`
                            : `This token was valid for the session on ${activeToken.sessionDate || 'a previous date'}. OPD tokens expire automatically at the end of the day.`}
                        </p>
                      </div>
                    )}

                    <div className="mt-5 pt-4 border-t border-slate-100 text-left space-y-2.5 text-sm">
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500 font-medium">Doctor:</span>
                        <div className="text-right">
                          <span className="font-bold text-slate-900">{activeToken.doctorName}</span>
                          {activeToken.doctorQualification && (
                            <span className="flex items-center justify-end gap-1 text-[11px] text-slate-600 font-medium mt-0.5">
                              <GraduationCap className="w-3.5 h-3.5 text-slate-400" />
                              <span>{activeToken.doctorQualification}</span>
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500 font-medium">Room:</span>
                        <span className="font-semibold text-slate-800 bg-slate-100 px-2.5 py-0.5 rounded-lg border border-slate-200 text-xs flex items-center gap-1">
                          <DoorClosed className="w-3.5 h-3.5 text-slate-400" />
                          <span>{activeToken.doctorRoomNumber}</span>
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500 font-medium">Serving Now:</span>
                        <span className="font-bold font-mono text-slate-900">
                          {activeToken.currentServingToken ? `#${activeToken.currentServingToken}` : 'Starting Soon'}
                        </span>
                      </div>
                      {activeToken.patientName && (
                        <div className="flex justify-between items-center">
                          <span className="text-slate-500 font-medium">Patient:</span>
                          <span className="font-bold text-slate-800 truncate max-w-[200px] text-right flex items-center justify-end gap-1.5">
                            <User className="w-3.5 h-3.5 text-slate-400" />
                            <span>{activeToken.patientName}</span>
                          </span>
                        </div>
                      )}
                      {activeToken.patientLocation && (
                        <div className="flex justify-between items-center">
                          <span className="text-slate-500 font-medium">Location:</span>
                          <span className="font-semibold text-emerald-800 truncate max-w-[200px] text-right flex items-center justify-end gap-1.5">
                            <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                            <span>{activeToken.patientLocation}</span>
                          </span>
                        </div>
                      )}
                    </div>

                    {!isTokenActiveToday(activeToken) && (
                      <div className="mt-5 pt-4 border-t border-slate-100">
                        <button
                          type="button"
                          onClick={() => {
                            setActiveToken(null);
                            setViewState('DOCTOR_LIST');
                          }}
                          className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3.5 rounded-xl shadow-xs hover:shadow-md transition text-sm flex items-center justify-center space-x-2 cursor-pointer active:scale-[0.99] group"
                        >
                          <Ticket className="w-4 h-4" />
                          <span>{lang === 'HI' ? 'आज का नया टोकन बुक करें' : "Book Today's Fresh Token"}</span>
                          <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                        </button>
                      </div>
                    )}

                    {isTokenActiveToday(activeToken) && (
                      <>
                        {/* Stats Grid */}
                        <div className="grid grid-cols-2 gap-3 mt-5 pt-4 border-t border-slate-100">
                          <div className="bg-slate-50 p-3.5 rounded-2xl text-center border border-slate-100">
                            <p className="text-xs text-slate-500 font-medium mb-0.5">{t.patientsAhead}</p>
                            <p className="text-2xl sm:text-3xl font-black text-slate-800">{activeToken.tokensAhead}</p>
                          </div>
                          <div className="bg-slate-50 p-3.5 rounded-2xl text-center border border-slate-100">
                            <p className="text-xs text-slate-500 font-medium mb-0.5">{t.estWait}</p>
                            <p className="text-2xl sm:text-3xl font-black text-slate-800">~{activeToken.estimatedWaitMinutes}m</p>
                          </div>
                        </div>

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
                                    ? 'रजिस्टर मोबाइल पर संदर्भ संदेश भेज दिया गया है।'
                                    : 'SMS confirmation sent to mobile number.'}
                                </p>
                                {activeToken.patientPhone && (
                                  <p className="text-[11px] text-emerald-800 font-semibold mt-0.5">
                                    📱 +91 {activeToken.patientPhone}
                                  </p>
                                )}
                              </div>
                            </div>
                            <span className="text-[10px] uppercase font-black bg-emerald-200 text-emerald-900 px-2 py-0.5 rounded-md flex-shrink-0 ml-2">
                              {lang === 'HI' ? 'भेजा गया' : 'SENT'}
                            </span>
                          </div>
                        ) : (
                          <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-2xl p-3.5 mt-4 text-left shadow-2xs space-y-2">
                            <div className="flex items-start justify-between">
                              <div className="flex items-start space-x-2.5">
                                <div className="w-7 h-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center flex-shrink-0 mt-0.5 text-xs font-black shadow-xs">
                                  ✓
                                </div>
                                <div>
                                  <p className="text-xs sm:text-sm font-bold text-slate-800">
                                    {lang === 'HI' ? 'डिजिटल टोकन सुरक्षित व सक्रिय है' : 'Digital Token Confirmed & Active'}
                                  </p>
                                  <p className="text-[11px] text-slate-600 mt-0.5 leading-relaxed">
                                    {lang === 'HI'
                                      ? 'यह स्क्रीन कमरे के बाहर दिखाएं। कतार की स्थिति इस पेज पर लाइव अपडेट होती है।'
                                      : 'Present this token # at the OPD room. Queue position updates live on this screen.'}
                                  </p>
                                  {activeToken.patientPhone && (
                                    <p className="text-[11px] text-emerald-700 font-semibold mt-1">
                                      📱 Reg: +91 {activeToken.patientPhone}
                                    </p>
                                  )}
                                </div>
                              </div>
                              <span className="text-[10px] uppercase font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-md flex-shrink-0 ml-2 border border-emerald-200">
                                LIVE
                              </span>
                            </div>

                            {/* Subtle secondary SMS retry option if user desires */}
                            <div className="pt-2 border-t border-emerald-100 flex items-center justify-between text-[11px]">
                              <span className="text-slate-500">
                                {lang === 'HI' ? 'एसएमएस नहीं मिला?' : 'Need SMS on phone?'}
                              </span>
                              <button
                                type="button"
                                onClick={handleRetrySms}
                                disabled={retryingSms}
                                className="inline-flex items-center space-x-1 text-emerald-700 hover:text-emerald-900 font-bold underline cursor-pointer"
                              >
                                <RefreshCw className={`w-3 h-3 ${retryingSms ? 'animate-spin' : ''}`} />
                                <span>{retryingSms ? 'Sending...' : 'Retry SMS'}</span>
                              </button>
                            </div>
                            {smsRetryStatus && (
                              <p className="text-[11px] text-slate-600 bg-white/80 p-1.5 rounded-lg border border-emerald-100 font-medium">
                                {smsRetryStatus}
                              </p>
                            )}
                          </div>
                        )}
                      </>
                    )}

                    <p className="text-xs text-slate-400 mt-3.5 leading-relaxed">
                      Please reach the consultation room when your token is near.
                    </p>
                  </div>

                  {/* Bottom Action Controls */}
                  <div className="space-y-2.5 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setActiveToken(null);
                        setLookupQuery('');
                        setLookupTokensList([]);
                        setViewState('MY_TOKEN');
                      }}
                      className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3.5 rounded-xl transition text-sm flex items-center justify-center space-x-2 cursor-pointer shadow-xs active:scale-[0.99] group"
                    >
                      <Search className="w-4 h-4" />
                      <span>{lang === 'HI' ? 'अन्य मोबाइल नंबर से टोकन खोजें' : 'Search Token With Another Phone Number'}</span>
                      <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
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
                      className="w-full bg-white hover:bg-slate-50 text-slate-700 font-bold py-3 rounded-xl transition text-sm flex items-center justify-center space-x-2 cursor-pointer border border-slate-300 shadow-2xs active:scale-[0.99]"
                    >
                      <RefreshCw className="w-4 h-4 text-slate-500" />
                      <span>{t.changeDoc}</span>
                    </button>
                  </div>
                </>
              ) : (
                /* Token Lookup Form */
                <div className="bg-white rounded-2xl p-6 sm:p-8 shadow-xs border border-slate-200 space-y-5 text-center">
                  <div className="w-14 h-14 bg-emerald-100 text-emerald-700 rounded-xl flex items-center justify-center mx-auto">
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
                    <h3 className="font-bold text-lg text-slate-900 tracking-tight">
                      {lang === 'HI' ? 'आज का ओपीडी टोकन खोजें' : "Search Today's OPD Token"}
                    </h3>
                    <p className="text-xs md:text-sm text-slate-500 mt-1">
                      {lang === 'HI'
                        ? 'आज के लाइव नंबर के लिए 10 अंकों का मोबाइल नंबर डालें'
                        : 'Enter your 10-digit mobile phone number or booking reference to check live turn'}
                    </p>
                  </div>

                  {/* Clean CTA to Book Fresh Token if user doesn't have one */}
                  <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-4 text-center space-y-2">
                    <p className="text-xs text-emerald-950 font-semibold">
                      {lang === 'HI' ? 'आज के लिए अभी तक कोई टोकन बुक नहीं किया?' : "Haven't booked a token for today yet?"}
                    </p>
                    <button
                      type="button"
                      onClick={() => setViewState('DOCTOR_LIST')}
                      className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 rounded-xl text-xs sm:text-sm cursor-pointer shadow-xs transition active:scale-95 flex items-center justify-center space-x-2 group"
                    >
                      <Ticket className="w-4 h-4" />
                      <span>{lang === 'HI' ? 'डॉक्टर चुनें और आज का टोकन बुक करें' : "View Doctors & Book Today's Token"}</span>
                      <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </button>
                  </div>

                  <form onSubmit={handleLookupToken} className="space-y-3">
                    <input
                      type="text"
                      placeholder={lang === 'HI' ? 'आज के टोकन के लिए 10 अंकों का मोबाइल नंबर डालें' : "Enter 10-Digit Mobile Number for Today's Token"}
                      value={lookupQuery}
                      onChange={(e) => setLookupQuery(e.target.value)}
                      className="w-full text-sm font-semibold border border-slate-300 rounded-xl px-4 py-3.5 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 outline-none text-center shadow-xs"
                    />
                    <button
                      type="submit"
                      disabled={lookupLoading}
                      className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3.5 rounded-xl transition text-sm cursor-pointer shadow-xs disabled:opacity-50 flex items-center justify-center gap-2 group"
                    >
                      <span>
                        {lookupLoading
                          ? (lang === 'HI' ? 'टोकन खोज रहे हैं...' : 'Searching Today\'s Token...')
                          : (lang === 'HI' ? 'आज का टोकन खोजें' : "Find Today's Token")}
                      </span>
                      {!lookupLoading && <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />}
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
                          className="p-3 rounded-xl border border-slate-200 hover:border-emerald-500 bg-slate-50/50 hover:bg-white cursor-pointer transition flex items-center justify-between"
                        >
                          <div className="flex items-center space-x-3">
                            <span className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 font-bold font-mono flex items-center justify-center text-sm">
                              #{t.tokenNumber}
                            </span>
                            <div>
                              <p className="font-bold text-sm text-slate-900">{t.patientName || 'Online Booking'}</p>
                              <p className="text-xs text-slate-500">{t.doctorName} • {t.doctorRoomNumber}</p>
                            </div>
                          </div>
                          <span className="text-xs font-semibold text-emerald-700 hover:text-emerald-900 flex items-center gap-1">
                            <span>Open Turn</span>
                            <ArrowRight className="w-3.5 h-3.5" />
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
                {displayedSessions.map((s) => (
                  <div key={s.id} className="bg-white rounded-2xl p-5 shadow-xs border border-slate-200/90 flex flex-col justify-between space-y-4 hover:border-emerald-500 hover:shadow-md transition-all duration-200">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-bold text-base text-slate-900">{s.doctorName}</h4>
                        <div className="flex items-center gap-1.5 text-xs text-emerald-800 font-semibold mt-0.5">
                          <Stethoscope className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                          <span>{s.doctorSpecialty}</span>
                        </div>
                        {s.doctorQualification && (
                          <div className="flex items-center gap-1.5 text-[11px] text-slate-600 font-medium mt-0.5">
                            <GraduationCap className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                            <span>{s.doctorQualification}</span>
                          </div>
                        )}
                      </div>
                      <span className="text-xs font-semibold bg-slate-100 text-slate-700 px-2.5 py-1 rounded-lg border border-slate-200 flex items-center gap-1">
                        <DoorClosed className="w-3.5 h-3.5 text-slate-400" />
                        <span>{s.doctorRoomNumber}</span>
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-center text-xs">
                      <div className="bg-slate-50/80 p-2.5 rounded-xl border border-slate-100">
                        <span className="text-[10px] text-slate-400 block uppercase font-bold tracking-wider">Serving</span>
                        <span className="font-bold font-mono text-slate-900 text-sm">
                          {s.currentServingToken ? `#${s.currentServingToken}` : '—'}
                        </span>
                      </div>
                      <div className="bg-amber-50/50 p-2.5 rounded-xl border border-amber-100">
                        <span className="text-[10px] text-amber-700 block uppercase font-bold tracking-wider">Next</span>
                        <span className="font-bold font-mono text-amber-800 text-sm">#{s.nextTokenSequence}</span>
                      </div>
                      <div className="bg-emerald-50/50 p-2.5 rounded-xl border border-emerald-100">
                        <span className="text-[10px] text-emerald-700 block uppercase font-bold tracking-wider">Waiting</span>
                        <span className="font-bold font-mono text-emerald-800 text-sm">{s.waitingCount}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </main>

        {/* Global Patient Portal Footer */}
        <footer className="bg-white border-t border-slate-200 py-6 mb-16 md:mb-0 text-center text-xs text-slate-500 mt-auto">
          <div className="max-w-7xl mx-auto px-4">
            <p className="font-semibold text-slate-700">{hospital?.name || 'City Care Hospital'} • Digital OPD Remote Token Platform</p>
            <p className="text-[11px] text-slate-400 mt-1">Live queue updates synchronized with hospital consultation room</p>
          </div>
        </footer>

        {/* ========================================================================= */}
        {/* STICKY BOTTOM APP NAVIGATION BAR (Mobile App UI from Image 2)             */}
        {/* ========================================================================= */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200/90 px-3 py-1.5 flex items-center justify-around shadow-lg">
          <button
            onClick={() => setViewState('HOME')}
            className={`flex flex-col items-center py-1 px-3 rounded-xl transition cursor-pointer ${
              viewState === 'HOME'
                ? 'text-emerald-700 font-extrabold'
                : 'text-slate-400 hover:text-slate-600 font-medium'
            }`}
          >
            <Home className="w-5 h-5" />
            <span className="text-[10px] mt-0.5">{lang === 'HI' ? 'होम' : 'Home'}</span>
          </button>

          <button
            onClick={() => setViewState('MY_TOKEN')}
            className={`flex flex-col items-center py-1 px-3 rounded-xl transition cursor-pointer relative ${
              viewState === 'MY_TOKEN'
                ? 'text-emerald-700 font-extrabold'
                : 'text-slate-400 hover:text-slate-600 font-medium'
            }`}
          >
            <Ticket className="w-5 h-5" />
            <span className="text-[10px] mt-0.5">{lang === 'HI' ? 'टोकन' : 'Tokens'}</span>
            {activeToken && isTokenActiveToday(activeToken) && (
              <span className="w-2 h-2 rounded-full bg-emerald-500 absolute top-1 right-3 animate-ping" />
            )}
          </button>

          <button
            onClick={() => setViewState('DOCTOR_LIST')}
            className={`flex flex-col items-center py-1 px-3 rounded-xl transition cursor-pointer ${
              viewState === 'DOCTOR_LIST'
                ? 'text-emerald-700 font-extrabold'
                : 'text-slate-400 hover:text-slate-600 font-medium'
            }`}
          >
            <Stethoscope className="w-5 h-5" />
            <span className="text-[10px] mt-0.5">{lang === 'HI' ? 'डॉक्टर' : 'Doctors'}</span>
          </button>

          <button
            onClick={() => setViewState('VIEW_QUEUE')}
            className={`flex flex-col items-center py-1 px-3 rounded-xl transition cursor-pointer ${
              viewState === 'VIEW_QUEUE'
                ? 'text-emerald-700 font-extrabold'
                : 'text-slate-400 hover:text-slate-600 font-medium'
            }`}
          >
            <Users className="w-5 h-5" />
            <span className="text-[10px] mt-0.5">{lang === 'HI' ? 'कतार' : 'Queue'}</span>
          </button>
        </nav>

        {/* ========================================================================= */}
        {/* HOSPITAL INFORMATION MODAL / SHEET                                        */}
        {/* ========================================================================= */}
        {showHospitalInfoModal && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
              <div className="bg-gradient-to-r from-emerald-600 to-teal-700 px-6 py-5 text-white flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center shadow-xs">
                    <Building2 className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg leading-tight">
                      {hospital ? hospital.name : 'Hospital Details'}
                    </h3>
                    <p className="text-xs text-emerald-100 mt-0.5">Verified Medical Institution</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowHospitalInfoModal(false)}
                  className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 text-white flex items-center justify-center transition cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-6 space-y-4 text-sm">
                {hospital?.address && (
                  <div className="flex items-start space-x-3">
                    <MapPin className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-bold text-slate-900">Hospital Address</h4>
                      <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">{hospital.address}</p>
                      <a
                        href={`https://maps.google.com/?q=${encodeURIComponent((hospital.name || '') + ' ' + (hospital.address || ''))}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center space-x-1 text-xs text-emerald-600 hover:text-emerald-700 font-bold mt-1.5"
                      >
                        <span>Open in Google Maps</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </div>
                )}

                <div className="flex items-start space-x-3">
                  <Clock className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-bold text-slate-900">OPD Timings</h4>
                    <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
                      Morning Shift: 08:00 AM - 01:00 PM<br />
                      Evening Shift: 04:00 PM - 08:00 PM
                    </p>
                  </div>
                </div>

                {hospital?.phone && (
                  <div className="flex items-start space-x-3">
                    <Phone className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-bold text-slate-900">Helpline / Contact</h4>
                      <a
                        href={`tel:${hospital.phone}`}
                        className="text-xs text-emerald-700 font-bold hover:underline block mt-0.5"
                      >
                        {hospital.phone}
                      </a>
                    </div>
                  </div>
                )}

                <div className="pt-2 border-t border-slate-100 flex justify-end">
                  <button
                    type="button"
                    onClick={() => setShowHospitalInfoModal(false)}
                    className="w-full bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs py-2.5 rounded-xl transition cursor-pointer"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };
