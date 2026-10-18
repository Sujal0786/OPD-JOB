import React, { useState, useEffect, useRef, useMemo } from 'react';
import { api } from '../services/api';
import { Doctor, LoginResponse, OpdSession, QueueBoard, TokenResponse, TokenStatus } from '../types';
import { 
  Building2, 
  Users, 
  Search, 
  UserPlus, 
  Play, 
  CheckCircle, 
  XCircle, 
  SkipForward, 
  LogOut, 
  RefreshCw, 
  Stethoscope, 
  Clock, 
  QrCode,
  Copy,
  ExternalLink,
  Plus,
  Edit,
  BellRing,
  Bell,
  Phone,
  Ticket,
  Printer,
  MapPin,
  Eye,
  User,
  Info,
  Calendar,
  Trash2,
  AlertTriangle,
  PauseCircle,
  PlayCircle,
  Sunrise,
  Sunset,
  Moon
} from 'lucide-react';

interface HospitalDashboardProps {
  onLogout: () => void;
  currentUser: LoginResponse;
  onOpenPatientPortal?: () => void;
}

const POPULAR_SPECIALTIES = [
  'General Medicine (सामान्य चिकित्सा)',
  'Pediatrics (बाल रोग)',
  'Cardiology (हृदय रोग)',
  'Orthopedics (हड्डी रोग)',
  'Gynecology & Obstetrics (स्त्री रोग)',
  'Dermatology (त्वचा रोग)',
  'ENT (कान, नाक, गला)',
  'Ophthalmology (नेत्र रोग)',
  'Dental Surgery (दंत चिकित्सा)',
  'Pulmonology (श्वसन रोग)',
  'General Surgery (शल्य चिकित्सा)'
];

const AVATAR_PRESETS = [
  'https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=300&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1594824813626-d62f01f2e963?w=300&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=300&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=300&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1537368910025-700350fe46c7?w=300&auto=format&fit=crop&q=80'
];

interface ArrivalAlert {
  id: string;
  tokenNumber: number;
  patientName?: string;
  tokenType?: string;
  doctorName?: string;
  time: string;
}

export const HospitalDashboard: React.FC<HospitalDashboardProps> = ({ onLogout, currentUser, onOpenPatientPortal }) => {
  // Navigation tabs
  const [activeTab, setActiveTab] = useState<'QUEUE_DESK' | 'DOCTOR_ROOM' | 'DOCTORS_ROSTER' | 'QR_KIOSK'>('QUEUE_DESK');
  const activeTabRef = useRef<'QUEUE_DESK' | 'DOCTOR_ROOM' | 'DOCTORS_ROSTER' | 'QR_KIOSK'>('QUEUE_DESK');
  useEffect(() => {
    activeTabRef.current = activeTab;
  }, [activeTab]);

  // Queue and Session state
  const [sessions, setSessions] = useState<OpdSession[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string>('');
  const selectedSessionIdRef = useRef<string>('');
  useEffect(() => {
    selectedSessionIdRef.current = selectedSessionId;
  }, [selectedSessionId]);

  const [activeShift, setActiveShift] = useState<'MORNING' | 'EVENING' | 'FULL_DAY'>(() => {
    const saved = localStorage.getItem(`citycare_active_shift_${currentUser.hospitalId}`);
    if (saved === 'MORNING' || saved === 'EVENING' || saved === 'FULL_DAY') return saved;
    const hr = new Date().getHours();
    return hr >= 16 ? 'EVENING' : 'MORNING';
  });

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

  const getDoctorSessionForShift = (docId: string, shift: 'MORNING' | 'EVENING' | 'FULL_DAY') => {
    const docSessions = sessions.filter(s => s.doctorId === docId);
    if (shift === 'EVENING') {
      return docSessions.find(s => isEveningSession(s)) || null;
    } else {
      return docSessions.find(s => isMorningSession(s)) || null;
    }
  };

  const getDoctorCurrentSession = (docId: string, allSessions: OpdSession[] = sessions) => {
    const docSessions = allSessions.filter(s => s.doctorId === docId);
    const openEvening = docSessions.find(s => isEveningSession(s) && s.status === 'OPEN');
    if (openEvening) return openEvening;
    const openMorning = docSessions.find(s => isMorningSession(s) && s.status === 'OPEN');
    if (openMorning) return openMorning;
    const pausedEvening = docSessions.find(s => isEveningSession(s) && s.status === 'PAUSED');
    const morningSess = docSessions.find(s => isMorningSession(s));
    if (morningSess && morningSess.status === 'CLOSED' && pausedEvening) return pausedEvening;
    const pausedMorning = docSessions.find(s => isMorningSession(s) && s.status === 'PAUSED');
    if (pausedMorning) return pausedMorning;
    return morningSess || docSessions[0] || null;
  };

  const [queueBoard, setQueueBoard] = useState<QueueBoard | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Full Day History state
  const [fullDayBoard, setFullDayBoard] = useState<{
    morningBoard: QueueBoard | null;
    eveningBoard: QueueBoard | null;
    allTokens: Array<TokenResponse & { shiftLabel: string; shiftType: 'MORNING' | 'EVENING' }>;
    stats: {
      total: number;
      morning: number;
      evening: number;
      completed: number;
      waiting: number;
      called: number;
      inConsultation: number;
      skipped: number;
    };
  } | null>(null);
  const [loadingFullDay, setLoadingFullDay] = useState(false);
  const [fullDaySearch, setFullDaySearch] = useState('');
  const [fullDayStatusFilter, setFullDayStatusFilter] = useState<string>('ALL');
  const [fullDayShiftFilter, setFullDayShiftFilter] = useState<'ALL' | 'MORNING' | 'EVENING'>('ALL');

  // Doctors list & management state
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loadingDoctors, setLoadingDoctors] = useState(false);
  const [showDoctorModal, setShowDoctorModal] = useState(false);
  const [doctorFormMode, setDoctorFormMode] = useState<'ADD' | 'EDIT'>('ADD');
  const [savingDoctor, setSavingDoctor] = useState(false);
  const [doctorForm, setDoctorForm] = useState({
    id: '',
    name: '',
    specialty: 'General Medicine (सामान्य चिकित्सा)',
    roomNumber: 'Room 101',
    photoUrl: AVATAR_PRESETS[0],
    qualification: 'MBBS, MD',
    avgConsultationMinutes: 10,
    active: true,
  });

  // Dedicated Doctor View state
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>(() => {
    return localStorage.getItem(`citycare_selected_doctor_${currentUser.hospitalId}`) || '';
  });
  const selectedDoctorIdRef = useRef<string>(selectedDoctorId);
  useEffect(() => {
    selectedDoctorIdRef.current = selectedDoctorId;
    if (selectedDoctorId) {
      localStorage.setItem(`citycare_selected_doctor_${currentUser.hospitalId}`, selectedDoctorId);
    }
  }, [selectedDoctorId, currentUser.hospitalId]);
  const [doctorBoard, setDoctorBoard] = useState<QueueBoard | null>(null);
  const [loadingDoctorBoard, setLoadingDoctorBoard] = useState(false);

  const [fullDayPage, setFullDayPage] = useState<number>(1);
  const fullDayPageSize = 10;
  const fullDayDoctorIdRef = useRef<string>('');

  // Walk-in Control state
  const [walkInCount, setWalkInCount] = useState<number>(5);
  const [addingWalkIns, setAddingWalkIns] = useState(false);

  // Patient Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchSessionScope, setSearchSessionScope] = useState<'ALL' | 'CURRENT'>('ALL');
  const [searchResults, setSearchResults] = useState<TokenResponse[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [doctorSearchQuery, setDoctorSearchQuery] = useState('');
  const [inspectingPatientToken, setInspectingPatientToken] = useState<TokenResponse | null>(null);

  // Live Client-side filtering for active Queue Desk tokens
  const filteredTokens = useMemo(() => {
    if (!queueBoard) return [];
    if (!searchQuery.trim()) return queueBoard.activeTokens;

    const q = searchQuery.trim().toLowerCase();
    const qClean = q.replace(/^#/, '');

    return queueBoard.activeTokens.filter((t) => {
      const matchToken = String(t.tokenNumber) === qClean || String(t.tokenNumber).includes(qClean);
      const matchName = t.patientName ? t.patientName.toLowerCase().includes(q) : false;
      const matchPhone = t.patientPhone ? t.patientPhone.includes(qClean) : false;
      const matchLocation = t.patientLocation ? t.patientLocation.toLowerCase().includes(q) : false;
      const matchRef = t.bookingReference ? t.bookingReference.toLowerCase().includes(q) : false;
      const matchStatus = t.status.toLowerCase().includes(q);
      const matchType = t.tokenType.toLowerCase().includes(q) || (t.tokenType === 'WALK_IN' && 'walk in'.includes(q));

      return matchToken || matchName || matchPhone || matchLocation || matchRef || matchStatus || matchType;
    });
  }, [queueBoard, searchQuery]);

  // Live filtering for Doctor Room View
  const filteredDoctorTokens = useMemo(() => {
    if (!doctorBoard || doctorBoard.doctorId !== selectedDoctorId) return [];
    const base = doctorBoard.activeTokens.filter((t) => t.status === 'WAITING' || t.status === 'CALLED');
    if (!doctorSearchQuery.trim()) return base;
    const q = doctorSearchQuery.trim().toLowerCase();
    const qClean = q.replace(/^#/, '');
    return base.filter((t) => {
      const matchToken = String(t.tokenNumber) === qClean || String(t.tokenNumber).includes(qClean);
      const matchName = t.patientName ? t.patientName.toLowerCase().includes(q) : false;
      const matchPhone = t.patientPhone ? t.patientPhone.includes(qClean) : false;
      const matchLocation = t.patientLocation ? t.patientLocation.toLowerCase().includes(q) : false;
      const matchRef = t.bookingReference ? t.bookingReference.toLowerCase().includes(q) : false;
      return matchToken || matchName || matchPhone || matchLocation || matchRef;
    });
  }, [doctorBoard, doctorSearchQuery, selectedDoctorId]);

  // QR / Link state
  const [copiedLink, setCopiedLink] = useState(false);

  // Date / Period Filter State
  const getTodayString = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const getYesterdayString = () => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const todayStr = useMemo(() => getTodayString(), []);
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);

  // Storage Cleanup State (7-Day Purge)
  const [showCleanupModal, setShowCleanupModal] = useState(false);
  const [cleaningStorage, setCleaningStorage] = useState(false);
  const [cleanupResult, setCleanupResult] = useState<{
    deletedSessions: number;
    deletedTokens: number;
    daysPurged: number;
    cutoffDate: string;
  } | null>(null);

  const sseRef = useRef<EventSource | null>(null);

  // Real-time Arrival Alert State & Chime Synthesizer
  const [latestArrival, setLatestArrival] = useState<ArrivalAlert | null>(null);
  const arrivalTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initializedSessionIdsRef = useRef<Set<string>>(new Set());
  const knownTokenIdsRef = useRef<Set<string>>(new Set());
  const alertedTokenIdsRef = useRef<Set<string>>(new Set());
  const mountTimeRef = useRef<number>(Date.now());

  const playArrivalAlertChime = () => {
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      // Crisp two-tone bell chime: 880Hz (A5) -> 1318.5Hz (E6)
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1318.5, ctx.currentTime + 0.14);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.85);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.9);
    } catch (e) {
      console.log('Audio chime error:', e);
    }
  };

  const triggerArrivalAlert = (tokenNumber: number, patientName?: string, tokenType?: string, docName?: string) => {
    const alertData: ArrivalAlert = {
      id: `${tokenNumber}_${Date.now()}`,
      tokenNumber,
      patientName: patientName || 'Patient',
      tokenType: tokenType || 'ONLINE',
      doctorName: docName || queueBoard?.doctorName || 'Doctor',
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    };
    setLatestArrival(alertData);
    playArrivalAlertChime();

    if (arrivalTimerRef.current) clearTimeout(arrivalTimerRef.current);
    arrivalTimerRef.current = setTimeout(() => {
      setLatestArrival(null);
    }, 7000);
  };

  // Clear any active arrival notification immediately when switching doctor, session, or tab
  useEffect(() => {
    setLatestArrival(null);
  }, [selectedDoctorId, selectedSessionId, activeTab]);

  const activeShiftRef = useRef<'MORNING' | 'EVENING' | 'FULL_DAY'>(activeShift);
  useEffect(() => {
    activeShiftRef.current = activeShift;
  }, [activeShift]);

  const switchDoctorShift = async (docId: string, targetShift: 'MORNING' | 'EVENING') => {
    setSelectedDoctorId(docId);
    selectedDoctorIdRef.current = docId;
    localStorage.setItem(`citycare_selected_doctor_${currentUser.hospitalId}`, docId);

    const docSessions = sessions.filter(s => s.doctorId === docId);
    const morningS = docSessions.find(s => isMorningSession(s));
    const eveningS = docSessions.find(s => isEveningSession(s));

    try {
      if (targetShift === 'EVENING') {
        // 1. Close this doctor's morning session
        if (morningS && morningS.status !== 'CLOSED') {
          await api.updateSessionStatus(currentUser.hospitalId, morningS.id, 'CLOSED');
        }
        // 2. Open this doctor's evening session
        if (eveningS) {
          await api.updateSessionStatus(currentUser.hospitalId, eveningS.id, 'OPEN');
        }
        setActiveShift('EVENING');
        activeShiftRef.current = 'EVENING';
        localStorage.setItem(`citycare_active_shift_${currentUser.hospitalId}`, 'EVENING');
        if (eveningS) {
          setSelectedSessionId(eveningS.id);
          selectedSessionIdRef.current = eveningS.id;
          await loadQueueBoard(eveningS.id, false);
          if (activeTabRef.current === 'DOCTOR_ROOM') {
            await loadDoctorRoomBoard(docId, selectedDate, eveningS.id, false);
          }
        }
      } else {
        // MORNING
        // 1. Pause this doctor's evening session if open
        if (eveningS && eveningS.status === 'OPEN') {
          await api.updateSessionStatus(currentUser.hospitalId, eveningS.id, 'PAUSED');
        }
        // 2. Open this doctor's morning session
        if (morningS) {
          await api.updateSessionStatus(currentUser.hospitalId, morningS.id, 'OPEN');
        }
        setActiveShift('MORNING');
        activeShiftRef.current = 'MORNING';
        localStorage.setItem(`citycare_active_shift_${currentUser.hospitalId}`, 'MORNING');
        if (morningS) {
          setSelectedSessionId(morningS.id);
          selectedSessionIdRef.current = morningS.id;
          await loadQueueBoard(morningS.id, false);
          if (activeTabRef.current === 'DOCTOR_ROOM') {
            await loadDoctorRoomBoard(docId, selectedDate, morningS.id, false);
          }
        }
      }

      await loadSessions(selectedDate, false);
      notifyQueueSync({
        action: 'DOCTOR_SHIFT_SWITCHED',
        doctorId: docId,
        shift: targetShift,
      });
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to switch doctor shift');
    }
  };

  const handleShiftChange = (newShift: 'MORNING' | 'EVENING' | 'FULL_DAY') => {
    if (!selectedDoctorId) return;
    const doc = doctors.find(d => d.id === selectedDoctorId);
    if (!doc) return;

    if (newShift === 'FULL_DAY') {
      setActiveShift('FULL_DAY');
      activeShiftRef.current = 'FULL_DAY';
      localStorage.setItem(`citycare_active_shift_${currentUser.hospitalId}`, 'FULL_DAY');
      setFullDayPage(1);
      loadFullDayHistory(doc.id, true);
      return;
    }

    switchDoctorShift(doc.id, newShift);
  };

  // 1. Initial Load: Fetch Sessions for Selected Date and Doctors
  useEffect(() => {
    loadSessions(selectedDate, true);
  }, [selectedDate, currentUser.hospitalId]);

  useEffect(() => {
    loadDoctors();
  }, [currentUser.hospitalId]);

  // Pure session list fetcher (zero selection mutation)
  const fetchSessionsOnly = async (targetDate: string = selectedDate) => {
    try {
      const data = await api.getSessionsByDate(currentUser.hospitalId, targetDate);
      setSessions(data);
    } catch (err: unknown) {
      console.error('Background sessions fetch failed:', err);
    }
  };

  const loadSessions = async (targetDate: string = selectedDate, showSpinner: boolean = false) => {
    try {
      if (showSpinner) setLoading(true);
      setError(null);
      const data = await api.getSessionsByDate(currentUser.hospitalId, targetDate);
      setSessions(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load sessions');
    } finally {
      if (showSpinner) setLoading(false);
    }
  };

  const handleCleanupStorage = async () => {
    try {
      setCleaningStorage(true);
      const res = await api.cleanupOldData(currentUser.hospitalId, 7);
      setCleanupResult(res);
      await loadSessions(selectedDate);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to clear old storage');
    } finally {
      setCleaningStorage(false);
    }
  };

  const loadDoctors = async () => {
    try {
      setLoadingDoctors(true);
      const docs = await api.getDoctors(currentUser.hospitalId, false);
      setDoctors(docs);
      if (docs.length > 0 && !selectedDoctorIdRef.current) {
        const chosenId = docs[0].id;
        setSelectedDoctorId(chosenId);
        selectedDoctorIdRef.current = chosenId;
      }
    } catch (err) {
      console.error('Failed to load doctors list:', err);
    } finally {
      setLoadingDoctors(false);
    }
  };

  // 2. Declarative Unidirectional Sync via useEffect:
  // Whenever selectedDoctorId, activeShift, or sessions change, derive selectedSessionId
  useEffect(() => {
    if (!selectedDoctorId) {
      if (doctors.length > 0) {
        const savedDocId = localStorage.getItem(`citycare_selected_doctor_${currentUser.hospitalId}`);
        const validDoc = doctors.find(d => d.id === savedDocId) || doctors[0];
        setSelectedDoctorId(validDoc.id);
        selectedDoctorIdRef.current = validDoc.id;
      }
      return;
    }

    const docSessions = sessions.filter(s => s.doctorId === selectedDoctorId);
    let shiftSession: OpdSession | null = null;
    if (activeShift === 'EVENING') {
      shiftSession = docSessions.find(s => isEveningSession(s)) || null;
    } else if (activeShift === 'MORNING') {
      shiftSession = docSessions.find(s => isMorningSession(s)) || null;
    } else {
      // FULL_DAY: connect selectedSessionId to the open session or first available session of doctor
      shiftSession = docSessions.find(s => s.status === 'OPEN') || docSessions[0] || null;
    }

    if (shiftSession) {
      if (selectedSessionIdRef.current !== shiftSession.id) {
        setSelectedSessionId(shiftSession.id);
        selectedSessionIdRef.current = shiftSession.id;
      }
    } else {
      if (selectedSessionIdRef.current !== '') {
        setSelectedSessionId('');
        selectedSessionIdRef.current = '';
        setQueueBoard(null);
      }
    }
  }, [selectedDoctorId, activeShift, sessions, doctors, currentUser.hospitalId]);

  const loadFullDayHistory = async (docId: string, showSpinner = true) => {
    if (!docId) return;
    try {
      if (showSpinner) {
        setLoadingFullDay(true);
        // Only clear if switching to a different doctor
        if (fullDayDoctorIdRef.current !== docId) {
          setFullDayBoard(null);
        }
      }
      fullDayDoctorIdRef.current = docId;

      // Fetch fresh sessions for the date without calling setSessions to prevent cascading trigger loops
      const dateSessions = await api.getSessionsByDate(currentUser.hospitalId, selectedDate);

      const docSessions = dateSessions.filter(s => s.doctorId === docId);
      const morningSess = docSessions.find(s => isMorningSession(s));
      const eveningSess = docSessions.find(s => isEveningSession(s));

      let mBoard: QueueBoard | null = null;
      let eBoard: QueueBoard | null = null;

      if (morningSess) {
        try {
          mBoard = await api.getQueueBoard(currentUser.hospitalId, morningSess.id);
        } catch (_) {}
      }
      if (eveningSess) {
        try {
          eBoard = await api.getQueueBoard(currentUser.hospitalId, eveningSess.id);
        } catch (_) {}
      }

      // Concurrency check: if user switched to another doctor while fetching, ignore this stale response
      if (selectedDoctorIdRef.current !== docId) return;

      const mTokens = (mBoard?.activeTokens || []).map(t => ({
        ...t,
        shiftLabel: 'Morning OPD',
        shiftType: 'MORNING' as const,
      }));
      const eTokens = (eBoard?.activeTokens || []).map(t => ({
        ...t,
        shiftLabel: 'Evening OPD',
        shiftType: 'EVENING' as const,
      }));

      const combined = [...mTokens, ...eTokens];

      const stats = {
        total: combined.length,
        morning: mTokens.length,
        evening: eTokens.length,
        completed: combined.filter(t => t.status === 'COMPLETED').length,
        waiting: combined.filter(t => t.status === 'WAITING').length,
        called: combined.filter(t => t.status === 'CALLED').length,
        inConsultation: combined.filter(t => t.status === 'IN_CONSULTATION').length,
        skipped: combined.filter(t => t.status === 'SKIPPED').length,
      };

      setFullDayBoard({
        morningBoard: mBoard,
        eveningBoard: eBoard,
        allTokens: combined,
        stats,
      });
    } catch (err) {
      console.error('Failed to load full day history:', err);
    } finally {
      if (showSpinner) setLoadingFullDay(false);
    }
  };

  const filteredFullDayTokens = useMemo(() => {
    if (!fullDayBoard?.allTokens) return [];
    return fullDayBoard.allTokens
      .filter(t => fullDayShiftFilter === 'ALL' || t.shiftType === fullDayShiftFilter)
      .filter(t => fullDayStatusFilter === 'ALL' || t.status === fullDayStatusFilter)
      .filter(t => {
        if (!fullDaySearch.trim()) return true;
        const q = fullDaySearch.trim().toLowerCase().replace(/^#/, '');
        return (
          String(t.tokenNumber).includes(q) ||
          (t.patientName && t.patientName.toLowerCase().includes(q)) ||
          (t.patientPhone && t.patientPhone.includes(q)) ||
          (t.bookingReference && t.bookingReference.toLowerCase().includes(q))
        );
      });
  }, [fullDayBoard, fullDayShiftFilter, fullDayStatusFilter, fullDaySearch]);

  const totalFullDayPages = Math.max(1, Math.ceil(filteredFullDayTokens.length / fullDayPageSize));
  const paginatedFullDayTokens = useMemo(() => {
    const start = (fullDayPage - 1) * fullDayPageSize;
    return filteredFullDayTokens.slice(start, start + fullDayPageSize);
  }, [filteredFullDayTokens, fullDayPage]);

  useEffect(() => {
    if (activeShift === 'FULL_DAY' && selectedDoctorId) {
      loadFullDayHistory(selectedDoctorId, false);
    }
  }, [activeShift, selectedDoctorId, selectedDate]);

  // 3. Fetch Queue Board on session change & setup real-time listeners (SSE, Cross-Tab Broadcast, Tab Focus, Polling)
  useEffect(() => {
    if (!selectedSessionId) return;
    loadQueueBoard(selectedSessionId);

    // A. SSE Live Updates Stream with token parameter
    if (sseRef.current) {
      sseRef.current.close();
    }

    const token = api.getAccessToken(currentUser.hospitalId);
    const ssePath = `/api/v1/hospitals/${currentUser.hospitalId}/sessions/${selectedSessionId}/stream${
      token ? `?token=${encodeURIComponent(token)}` : ''
    }`;
    const sse = new EventSource(api.getStreamUrl(ssePath));
    sseRef.current = sse;

    const refreshActiveData = () => {
      // 1. Refresh queue board for the active session (without spinner)
      if (selectedSessionIdRef.current) {
        loadQueueBoard(selectedSessionIdRef.current, false);
      }
      // 2. Pure background sync of sessions (zero selection mutation)
      fetchSessionsOnly(selectedDate);
      // 3. Refresh Full Day history if in full day view
      if (activeShiftRef.current === 'FULL_DAY' && selectedDoctorIdRef.current) {
        loadFullDayHistory(selectedDoctorIdRef.current, false);
      }
      // 4. Only refresh Doctor Room Board if user is currently inside DOCTOR_ROOM tab
      if (activeTabRef.current === 'DOCTOR_ROOM' && selectedDoctorIdRef.current) {
        loadDoctorRoomBoard(selectedDoctorIdRef.current, selectedDate, undefined, false);
      }
    };

    sse.addEventListener('QUEUE_UPDATED', (event: MessageEvent) => {
      try {
        if (event.data) {
          const payload = JSON.parse(event.data);
          const tokenId = payload?.id || (payload?.tokenNumber ? `${selectedSessionId}_${payload.tokenNumber}` : null);
          if (
            tokenId &&
            payload?.tokenNumber &&
            !alertedTokenIdsRef.current.has(tokenId) &&
            payload.status === 'WAITING'
          ) {
            const isFresh = payload.createdAt ? (new Date(payload.createdAt).getTime() >= mountTimeRef.current - 5000) : true;
            if (isFresh) {
              alertedTokenIdsRef.current.add(tokenId);
              if (payload.id) knownTokenIdsRef.current.add(payload.id);
              triggerArrivalAlert(payload.tokenNumber, payload.patientName, payload.tokenType, payload.doctorName);
            }
          }
        }
      } catch (_) {}
      refreshActiveData();
    });

    sse.onerror = () => {
      // Quiet fallback: keep working via REST & polling
    };

    // B. Instant Cross-Tab Sync via BroadcastChannel (tenant-scoped to current hospital)
    let bc: BroadcastChannel | null = null;
    const tenantChannelName = `opd_queue_sync_${currentUser.hospitalId}`;
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        bc = new BroadcastChannel(tenantChannelName);
        bc.onmessage = (event) => {
          if (event.data?.type === 'TOKEN_CREATED') {
            const tokenId = event.data.tokenId || event.data.id || (event.data.tokenNumber ? `${event.data.sessionId}_${event.data.tokenNumber}` : null);
            if (
              tokenId &&
              event.data.tokenNumber &&
              !alertedTokenIdsRef.current.has(tokenId)
            ) {
              alertedTokenIdsRef.current.add(tokenId);
              if (event.data.id) knownTokenIdsRef.current.add(event.data.id);
              triggerArrivalAlert(event.data.tokenNumber, event.data.patientName, event.data.tokenType, event.data.doctorName);
            }
            refreshActiveData();
          }
        };
      } catch (e) {
        // Fallback
      }
    }

    // C. Cross-Tab Storage Event (tenant-scoped to current hospital)
    const tenantStorageKey = `opd_last_token_sync_${currentUser.hospitalId}`;
    const handleStorage = (e: StorageEvent) => {
      if (e.key === tenantStorageKey || e.key === 'opd_last_token_sync' || e.key === 'citycare_last_token_sync') {
        refreshActiveData();
      }
    };
    window.addEventListener('storage', handleStorage);

    // D. Window Tab Switch / Focus (Instantly refreshes the millisecond user switches to dashboard tab)
    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === 'visible') {
        refreshActiveData();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityOrFocus);
    window.addEventListener('focus', handleVisibilityOrFocus);

    // E. Short Heartbeat Poller (every 2 seconds for real-time live data without refresh)
    const poller = setInterval(() => {
      if (document.visibilityState === 'visible') {
        refreshActiveData();
      }
    }, 2000);

    return () => {
      sse.close();
      if (bc) bc.close();
      window.removeEventListener('storage', handleStorage);
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
      window.removeEventListener('focus', handleVisibilityOrFocus);
      clearInterval(poller);
    };
  }, [selectedSessionId, currentUser.hospitalId, selectedDate]);

  const loadQueueBoard = async (sessionId: string, showSpinner = true) => {
    try {
      if (showSpinner) setLoading(true);
      setError(null);
      const board = await api.getQueueBoard(currentUser.hospitalId, sessionId);
      if (selectedSessionIdRef.current !== sessionId) return;
      setQueueBoard(board);

      if (board && board.activeTokens) {
        const isSessionAlreadyInitialized = initializedSessionIdsRef.current.has(sessionId);

        if (!isSessionAlreadyInitialized) {
          // First time loading this session: record all existing tokens as known with ZERO alerts!
          initializedSessionIdsRef.current.add(sessionId);
          board.activeTokens.forEach(t => {
            if (t.id) knownTokenIdsRef.current.add(t.id);
            if (t.id) alertedTokenIdsRef.current.add(t.id);
          });
        } else {
          // Session was already loaded previously; only alert for fresh newly-arrived tokens created while dashboard is open!
          const newWaitingTokens = board.activeTokens.filter(t => {
            if (!t.id) return false;
            if (knownTokenIdsRef.current.has(t.id)) return false;
            if (alertedTokenIdsRef.current.has(t.id)) return false;
            if (t.status !== 'WAITING') return false;
            const isFresh = t.createdAt ? (new Date(t.createdAt).getTime() >= mountTimeRef.current - 5000) : false;
            return isFresh;
          });

          if (newWaitingTokens.length > 0) {
            const latest = newWaitingTokens[newWaitingTokens.length - 1];
            alertedTokenIdsRef.current.add(latest.id);
            triggerArrivalAlert(latest.tokenNumber, latest.patientName, latest.tokenType, board.doctorName);
          }

          // Register all active tokens as known
          board.activeTokens.forEach(t => {
            if (t.id) knownTokenIdsRef.current.add(t.id);
          });
        }
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load queue board');
    } finally {
      if (showSpinner) setLoading(false);
    }
  };

  // 3. Load Doctor View board when selectedDoctorId or selectedDate changes
  useEffect(() => {
    if (activeTab === 'DOCTOR_ROOM' && selectedDoctorId) {
      loadDoctorRoomBoard(selectedDoctorId, selectedDate);
    }
  }, [activeTab, selectedDoctorId, selectedDate]);

  const loadDoctorRoomBoard = async (docId: string, targetDate: string = selectedDate, targetSessionId?: string, showSpinner: boolean = true) => {
    if (!docId) return;
    try {
      if (showSpinner) setLoadingDoctorBoard(true);

      // If explicit targetSessionId provided
      if (targetSessionId) {
        const board = await api.getQueueBoard(currentUser.hospitalId, targetSessionId);
        if (selectedDoctorIdRef.current === docId) {
          setDoctorBoard(board);
        }
        return;
      }

      // Query sessions for this doctor on targetDate
      const dateSessions = await api.getSessionsByDate(currentUser.hospitalId, targetDate);
      const docSessions = dateSessions.filter(s => s.doctorId === docId);

      if (docSessions.length > 0) {
        // Match existing selectedSessionId, or first OPEN, or latest session
        const active = docSessions.find(s => s.id === selectedSessionIdRef.current)
          || docSessions.find(s => s.status === 'OPEN')
          || docSessions[docSessions.length - 1];

        const board = await api.getQueueBoard(currentUser.hospitalId, active.id);
        if (selectedDoctorIdRef.current === docId) {
          setDoctorBoard(board);
        }
      } else {
        if (selectedDoctorIdRef.current === docId) {
          setDoctorBoard(null);
        }
      }
    } catch (err: unknown) {
      console.error('Failed to load doctor room board:', err);
      if (selectedDoctorIdRef.current === docId) {
        setDoctorBoard(null);
      }
    } finally {
      if (showSpinner) setLoadingDoctorBoard(false);
    }
  };

  const handleToggleSessionStatus = async (session: OpdSession) => {
    try {
      const newStatus = session.status === 'OPEN' ? 'PAUSED' : 'OPEN';
      await api.updateSessionStatus(currentUser.hospitalId, session.id, newStatus);
      await loadSessions(selectedDate);
      if (activeTab === 'DOCTOR_ROOM' && selectedDoctorId) {
        await loadDoctorRoomBoard(selectedDoctorId, selectedDate, session.id);
      } else if (selectedSessionId) {
        await loadQueueBoard(session.id, false);
      }
      notifyQueueSync({ sessionId: session.id, status: newStatus, action: 'STATUS_UPDATED' });
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to update session status');
    }
  };



  const notifyQueueSync = (extraPayload: Record<string, unknown> = {}) => {
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        const bc = new BroadcastChannel(`opd_queue_sync_${currentUser.hospitalId}`);
        bc.postMessage({
          type: 'QUEUE_UPDATED',
          hospitalId: currentUser.hospitalId,
          timestamp: Date.now(),
          ...extraPayload,
        });
        bc.close();
      }
    } catch (_) {}
    try {
      localStorage.setItem(`opd_last_token_sync_${currentUser.hospitalId}`, `${Date.now()}`);
    } catch (_) {}
  };

  // 4. Bulk Walk-ins Handler
  const handleAddWalkIns = async () => {
    if (!selectedSessionId || walkInCount <= 0) return;
    try {
      setAddingWalkIns(true);
      await api.addWalkIns(currentUser.hospitalId, selectedSessionId, walkInCount, 'Reception physical walk-in batch');
      await loadQueueBoard(selectedSessionId, false);
      setWalkInCount(5);
      notifyQueueSync({ sessionId: selectedSessionId, action: 'WALKINS_ADDED' });
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Error adding walk-ins');
    } finally {
      setAddingWalkIns(false);
    }
  };

  // 5. Queue Lifecycle Handlers
  const handleCallToken = async (tokenNumber: number, _docName?: string, _roomNum?: string) => {
    const sId = activeTab === 'DOCTOR_ROOM' && doctorBoard
      ? doctorBoard.sessionId
      : selectedSessionId;

    if (!sId) return;

    try {
      await api.callToken(currentUser.hospitalId, sId, tokenNumber);

      const currentDocId = selectedDoctorIdRef.current;
      if (activeTab === 'DOCTOR_ROOM' && currentDocId) {
        await loadDoctorRoomBoard(currentDocId);
      } else {
        await loadQueueBoard(sId, false);
      }
      notifyQueueSync({ sessionId: sId, tokenNumber, action: 'TOKEN_CALLED' });
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to call token');
    }
  };

  const handleUpdateStatus = async (tokenId: string, status: TokenStatus, reason?: string) => {
    try {
      await api.updateTokenStatus(currentUser.hospitalId, tokenId, status, reason);
      const currentDocId = selectedDoctorIdRef.current;
      if (activeTab === 'DOCTOR_ROOM' && currentDocId) {
        await loadDoctorRoomBoard(currentDocId);
      } else if (selectedSessionId) {
        await loadQueueBoard(selectedSessionId, false);
      }
      notifyQueueSync({ tokenId, status, action: 'STATUS_UPDATED' });
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Status update failed');
    }
  };

  // 7. Debounced Patient Search Handler
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setIsSearching(true);
        const targetSession = searchSessionScope === 'CURRENT' && activeTab === 'QUEUE_DESK' ? selectedSessionId : undefined;
        const results = await api.searchPatients(
          currentUser.hospitalId, 
          searchQuery.trim(), 
          targetSession
        );
        setSearchResults(results);
      } catch (err) {
        console.error('Search error:', err);
      } finally {
        setIsSearching(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [searchQuery, selectedSessionId, currentUser.hospitalId, activeTab, searchSessionScope]);

  // 8. Doctor Profile Form Save (Add or Edit)
  const handleOpenAddDoctor = () => {
    setDoctorFormMode('ADD');
    setDoctorForm({
      id: '',
      name: '',
      specialty: 'General Medicine (सामान्य चिकित्सा)',
      roomNumber: `Room ${101 + doctors.length}`,
      photoUrl: AVATAR_PRESETS[doctors.length % AVATAR_PRESETS.length],
      qualification: 'MBBS, MD',
      avgConsultationMinutes: 10,
      active: true,
    });
    setShowDoctorModal(true);
  };

  const handleOpenEditDoctor = (doc: Doctor) => {
    setDoctorFormMode('EDIT');
    setDoctorForm({
      id: doc.id,
      name: doc.name,
      specialty: doc.specialty,
      roomNumber: doc.roomNumber,
      photoUrl: doc.photoUrl || AVATAR_PRESETS[0],
      qualification: doc.qualification || 'MBBS',
      avgConsultationMinutes: doc.avgConsultationMinutes || 10,
      active: doc.active,
    });
    setShowDoctorModal(true);
  };

  const handleEditSessionDoctor = (s: OpdSession) => {
    const doc = doctors.find((d) => d.id === s.doctorId);
    setDoctorFormMode('EDIT');
    setDoctorForm({
      id: s.doctorId,
      name: doc?.name || s.doctorName,
      specialty: doc?.specialty || s.doctorSpecialty,
      roomNumber: doc?.roomNumber || s.doctorRoomNumber,
      photoUrl: doc?.photoUrl || s.doctorPhotoUrl || AVATAR_PRESETS[0],
      qualification: doc?.qualification || 'MBBS, MD',
      avgConsultationMinutes: doc?.avgConsultationMinutes || 10,
      active: doc ? doc.active : true,
    });
    setShowDoctorModal(true);
  };

  const handleEditActiveDoctor = () => {
    if (!queueBoard) return;
    const doc = doctors.find((d) => d.id === queueBoard.doctorId);
    setDoctorFormMode('EDIT');
    setDoctorForm({
      id: queueBoard.doctorId,
      name: doc?.name || queueBoard.doctorName,
      specialty: doc?.specialty || 'General Medicine',
      roomNumber: doc?.roomNumber || queueBoard.doctorRoomNumber,
      photoUrl: doc?.photoUrl || AVATAR_PRESETS[0],
      qualification: doc?.qualification || 'MBBS, MD',
      avgConsultationMinutes: doc?.avgConsultationMinutes || 10,
      active: doc ? doc.active : true,
    });
    setShowDoctorModal(true);
  };

  const handleSaveDoctor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!doctorForm.name.trim() || !doctorForm.specialty.trim() || !doctorForm.roomNumber.trim()) {
      alert('Please fill out Name, Specialty, and Room Number.');
      return;
    }
    try {
      setSavingDoctor(true);
      if (doctorFormMode === 'ADD') {
        await api.createDoctor(currentUser.hospitalId, {
          name: doctorForm.name.trim(),
          specialty: doctorForm.specialty.trim(),
          roomNumber: doctorForm.roomNumber.trim(),
          photoUrl: doctorForm.photoUrl.trim(),
          qualification: doctorForm.qualification.trim(),
          avgConsultationMinutes: Number(doctorForm.avgConsultationMinutes) || 10,
        });
      } else {
        await api.updateDoctor(currentUser.hospitalId, doctorForm.id, {
          name: doctorForm.name.trim(),
          specialty: doctorForm.specialty.trim(),
          roomNumber: doctorForm.roomNumber.trim(),
          photoUrl: doctorForm.photoUrl.trim(),
          qualification: doctorForm.qualification.trim(),
          avgConsultationMinutes: Number(doctorForm.avgConsultationMinutes) || 10,
          active: doctorForm.active,
        });
      }
      setShowDoctorModal(false);
      await loadDoctors();
      await loadSessions();
      if (selectedSessionId) {
        await loadQueueBoard(selectedSessionId, false);
      }
      alert(`Doctor profile ${doctorFormMode === 'ADD' ? 'created' : 'updated'} successfully! Changes are live in patient portal and queues.`);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to save doctor');
    } finally {
      setSavingDoctor(false);
    }
  };

  const hospitalPatientUrl = `${window.location.origin}/h/${currentUser.hospitalSlug}`;
  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&margin=10&data=${encodeURIComponent(hospitalPatientUrl)}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(hospitalPatientUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans relative">
      {/* Real-time Token Arrival Notification Toast */}
      {latestArrival && (
        <div className="fixed top-5 right-5 z-50 max-w-sm sm:max-w-md bg-white border-2 border-emerald-500 rounded-2xl shadow-2xl p-4 flex items-start space-x-3.5 animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center flex-shrink-0 shadow-md">
            <BellRing className="w-5 h-5 animate-bounce" />
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-black tracking-wider uppercase text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded-full flex items-center space-x-1">
                <span>🔔 New Token Arrival!</span>
              </span>
              <span className="text-[10px] text-slate-400 font-mono">{latestArrival.time}</span>
            </div>
            <p className="text-xl font-black text-slate-900 mt-1">
              Token #{latestArrival.tokenNumber}
              <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md ml-2 uppercase">
                {latestArrival.tokenType || 'ONLINE'}
              </span>
            </p>
            <p className="text-xs font-medium text-slate-600 mt-1">
              Patient: <span className="font-bold text-slate-900">{latestArrival.patientName || 'Anonymous Patient'}</span>
            </p>
            {latestArrival.doctorName && (
              <p className="text-[11px] text-slate-500 mt-0.5 font-medium">
                Doctor: <span className="font-semibold text-slate-700">{latestArrival.doctorName}</span>
              </p>
            )}
          </div>
          <button
            onClick={() => setLatestArrival(null)}
            className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg text-xs cursor-pointer hover:bg-slate-100 transition"
            title="Dismiss notification"
          >
            ✕
          </button>
        </div>
      )}

      {/* Top Navigation Bar */}
      <header className="bg-slate-900 text-white shadow-xl sticky top-0 z-40 border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-y-3">
          <div className="flex items-center space-x-3">
            <div className="bg-emerald-500/20 p-2.5 rounded-2xl border border-emerald-500/30">
              <Building2 className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-base sm:text-lg font-black tracking-tight">{currentUser.hospitalName}</h1>
                <span className="bg-slate-800 text-emerald-400 font-bold text-[10px] px-2 py-0.5 rounded-md border border-slate-700">
                  {currentUser.role}
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Tenant: <span className="text-emerald-400 font-mono">/h/{currentUser.hospitalSlug}</span> • Staff: <span className="text-slate-200 font-medium">{currentUser.fullName}</span>
              </p>
            </div>
          </div>

          {/* Action Tabs & Controls */}
          <div className="flex items-center space-x-2 sm:space-x-3 flex-wrap">
            <nav className="flex bg-slate-800/80 p-1 rounded-xl border border-slate-700 text-xs">
              <button
                onClick={() => {
                  setActiveTab('QUEUE_DESK');
                  const currentDocId = selectedDoctorIdRef.current;
                  if (currentDocId) {
                    const matchSession = getDoctorSessionForShift(currentDocId, activeShiftRef.current);
                    if (matchSession) {
                      setSelectedSessionId(matchSession.id);
                      selectedSessionIdRef.current = matchSession.id;
                      loadQueueBoard(matchSession.id);
                    }
                  }
                }}
                className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer flex items-center space-x-1.5 ${
                  activeTab === 'QUEUE_DESK'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>Queue Desk</span>
              </button>

              <button
                onClick={() => {
                  setActiveTab('DOCTOR_ROOM');
                  const currentSession = sessions.find(s => s.id === selectedSessionId);
                  if (currentSession && currentSession.doctorId) {
                    setSelectedDoctorId(currentSession.doctorId);
                    selectedDoctorIdRef.current = currentSession.doctorId;
                    loadDoctorRoomBoard(currentSession.doctorId);
                  } else if (selectedDoctorIdRef.current) {
                    loadDoctorRoomBoard(selectedDoctorIdRef.current);
                  }
                }}
                className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer flex items-center space-x-1.5 ${
                  activeTab === 'DOCTOR_ROOM'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <Stethoscope className="w-3.5 h-3.5" />
                <span>Doctor Room View</span>
              </button>

              <button
                onClick={() => setActiveTab('DOCTORS_ROSTER')}
                className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer flex items-center space-x-1.5 ${
                  activeTab === 'DOCTORS_ROSTER'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <Plus className="w-3.5 h-3.5 text-cyan-400" />
                <span>Manage Doctors</span>
              </button>

              <button
                onClick={() => setActiveTab('QR_KIOSK')}
                className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer flex items-center space-x-1.5 ${
                  activeTab === 'QR_KIOSK'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <QrCode className="w-3.5 h-3.5 text-amber-400" />
                <span>Hospital QR</span>
              </button>
            </nav>

            <button
              onClick={() => setShowSearchModal(true)}
              className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1.5 rounded-xl text-xs font-bold flex items-center space-x-1.5 border border-slate-700 transition cursor-pointer"
            >
              <Search className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden sm:inline">Search Patient</span>
            </button>

            <button
              type="button"
              onClick={() => {
                if (onOpenPatientPortal) {
                  onOpenPatientPortal();
                } else {
                  window.open(`/h/${currentUser.hospitalSlug}`, '_blank');
                }
              }}
              className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1.5 rounded-xl text-xs font-bold flex items-center space-x-1.5 border border-slate-700 transition cursor-pointer"
              title="Open Public Patient Booking Portal"
            >
              <ExternalLink className="w-3.5 h-3.5 text-cyan-400" />
              <span className="hidden sm:inline">Patient Portal</span>
            </button>

            <button
              onClick={onLogout}
              className="bg-red-950/70 hover:bg-red-900 text-red-200 px-3 py-1.5 rounded-xl text-xs font-bold flex items-center space-x-1.5 border border-red-800/60 transition cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl w-full mx-auto px-3 sm:px-6 py-3.5 sm:py-5 flex-1 space-y-4 sm:space-y-5">
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-2xl flex items-center justify-between text-sm shadow-xs">
            <span className="font-medium">{error}</span>
            <button onClick={() => setError(null)} className="font-bold text-lg cursor-pointer">&times;</button>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* TAB 1: QUEUE DESK (Reception / Multi-Doctor Operations)        */}
        {/* ------------------------------------------------------------- */}
        {activeTab === 'QUEUE_DESK' && (
          <div className="space-y-4 sm:space-y-5">
            {/* Doctor OPD Session Selection Bar & Period Filter */}
            <div className="bg-white rounded-2xl sm:rounded-3xl p-3.5 sm:p-5 shadow-sm border border-slate-200 space-y-3.5 sm:space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <h2 className="text-xs font-black uppercase tracking-wider text-slate-500 flex items-center space-x-2">
                    <Stethoscope className="w-4 h-4 text-emerald-600" />
                    <span>
                      Doctor OPD Sessions ({sessions.length} Available {selectedDate === todayStr ? 'Today' : `on ${selectedDate}`})
                    </span>
                  </h2>
                  <p className="text-xs text-slate-500">
                    {selectedDate === todayStr
                      ? 'Live real-time OPD queues for active doctors'
                      : `Viewing historical OPD session queues for ${selectedDate}`}
                  </p>
                </div>

                <div className="flex items-center space-x-2 overflow-x-auto no-scrollbar py-0.5">
                  <button
                    onClick={handleOpenAddDoctor}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold px-3 py-1.5 rounded-xl text-xs flex items-center space-x-1 cursor-pointer transition shadow-xs whitespace-nowrap flex-shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span> Add Doctor</span>
                  </button>

                  <button
                    onClick={() => setActiveTab('DOCTORS_ROSTER')}
                    className="bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold px-3 py-1.5 rounded-xl text-xs flex items-center space-x-1 cursor-pointer transition border border-slate-200 whitespace-nowrap flex-shrink-0"
                  >
                    <Users className="w-3.5 h-3.5 text-slate-600" />
                    <span>Directory</span>
                  </button>

                  {/* Clean 7-Day Storage Button */}
                  <button
                    onClick={() => {
                      setCleanupResult(null);
                      setShowCleanupModal(true);
                    }}
                    className="bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 hover:border-red-300 font-bold px-3 py-1.5 rounded-xl text-xs flex items-center space-x-1.5 cursor-pointer transition shadow-2xs whitespace-nowrap flex-shrink-0"
                    title="Purge OPD queue and token data older than 7 days to free hospital storage"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-red-600" />
                    <span>Clear Storage</span>
                  </button>

                  <button
                    onClick={() => {
                      loadSessions(selectedDate);
                      if (selectedSessionId) loadQueueBoard(selectedSessionId);
                    }}
                    className="p-1.5 text-slate-500 hover:text-slate-800 rounded-lg hover:bg-slate-100 transition cursor-pointer flex-shrink-0"
                    title="Refresh Sessions"
                  >
                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                  </button>
                </div>
              </div>

              {/* Period / Date Filter Toolbar & Shift Switcher */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-3 border-t border-slate-100">
                <div className="flex items-center space-x-2 overflow-x-auto no-scrollbar py-0.5">
                  <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-xl text-xs border border-slate-200 font-bold flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => setSelectedDate(todayStr)}
                      className={`px-3 py-1 rounded-lg transition cursor-pointer ${
                        selectedDate === todayStr
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Today
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedDate(getYesterdayString())}
                      className={`px-3 py-1 rounded-lg transition cursor-pointer ${
                        selectedDate === getYesterdayString()
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Yesterday
                    </button>
                  </div>

                  {/* Calendar Date Picker Input */}
                  <div className="flex items-center space-x-1.5 bg-slate-50 px-2.5 py-1 rounded-xl border border-slate-200 flex-shrink-0">
                    <Calendar className="w-3.5 h-3.5 text-slate-500" />
                    <span className="text-xs font-bold text-slate-600">Date:</span>
                    <input
                      type="date"
                      value={selectedDate}
                      max={todayStr}
                      onChange={(e) => {
                        if (e.target.value) {
                          setSelectedDate(e.target.value);
                        }
                      }}
                      className="text-xs font-bold text-slate-800 bg-transparent focus:outline-none cursor-pointer"
                    />
                  </div>

                  {selectedDate !== todayStr && (
                    <div className="flex items-center space-x-1.5 bg-amber-50 text-amber-800 border border-amber-200 px-2.5 py-1 rounded-xl text-xs font-bold flex-shrink-0">
                      <span>Historical View ({selectedDate})</span>
                      <button
                        onClick={() => setSelectedDate(todayStr)}
                        className="text-emerald-700 hover:underline ml-1 cursor-pointer"
                      >
                        • Back to Today
                      </button>
                    </div>
                  )}
                </div>

                {/* OPD Shift Switcher (Morning vs Evening vs Full Day) - Responsive 3-col on Mobile */}
                <div className="w-full sm:w-auto grid grid-cols-3 sm:flex items-center space-x-0 sm:space-x-1 gap-1 sm:gap-0 bg-slate-100 p-1 rounded-xl text-xs border border-slate-200 font-bold">
                  <button
                    type="button"
                    onClick={() => handleShiftChange('MORNING')}
                    className={`px-2 sm:px-3 py-1.5 sm:py-1 rounded-lg transition flex items-center justify-center space-x-1 sm:space-x-1.5 cursor-pointer text-center ${
                      activeShift === 'MORNING'
                        ? 'bg-emerald-600 text-white shadow-xs font-extrabold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                    title="Morning OPD Shift (9:00 AM to 2:00 PM)"
                  >
                    <Sunrise className="w-3.5 h-3.5 flex-shrink-0" />
                    <span className="sm:hidden">Morning</span>
                    <span className="hidden sm:inline">Morning OPD (9 AM - 2 PM)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleShiftChange('EVENING')}
                    className={`px-2 sm:px-3 py-1.5 sm:py-1 rounded-lg transition flex items-center justify-center space-x-1 sm:space-x-1.5 cursor-pointer text-center ${
                      activeShift === 'EVENING'
                        ? 'bg-indigo-600 text-white shadow-xs font-extrabold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                    title="Evening OPD Shift (5:00 PM to 7:00 PM)"
                  >
                    <Sunset className="w-3.5 h-3.5 flex-shrink-0" />
                    <span className="sm:hidden">Evening</span>
                    <span className="hidden sm:inline">Evening OPD (5 PM - 7 PM)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleShiftChange('FULL_DAY')}
                    className={`px-2 sm:px-3 py-1.5 sm:py-1 rounded-lg transition flex items-center justify-center space-x-1 sm:space-x-1.5 cursor-pointer text-center ${
                      activeShift === 'FULL_DAY'
                        ? 'bg-purple-700 text-white shadow-xs font-extrabold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                    title="Full Day Patient Queue (Combined Morning + Evening OPD)"
                  >
                    <Clock className="w-3.5 h-3.5 flex-shrink-0" />
                    <span className="sm:hidden">Full Day</span>
                    <span className="hidden sm:inline">Full Day History</span>
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between text-[11px] text-slate-400 font-medium pt-1">
                {selectedDate === todayStr ? (
                  <span className="flex items-center space-x-1 text-emerald-600 font-semibold">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    <span>Real-time Live Sync</span>
                  </span>
                ) : (
                  <span>Historical Archive Mode</span>
                )}

                {/* Mobile doctor swipe helper */}
                <span className="sm:hidden text-slate-400 font-medium">
                  Swipe cards horizontally ↔
                </span>
              </div>

              {/* Doctor Session Carousel / Cards - EXACTLY ONE CARD PER ACTIVE DOCTOR with mobile scroll snap */}
              {doctors.filter(d => d.active).length > 0 ? (
                <div className="flex space-x-3 overflow-x-auto pb-3 pt-1 snap-x snap-mandatory scroll-smooth no-scrollbar">
                  {doctors.filter(d => d.active).map((doc) => {
                    const s = getDoctorCurrentSession(doc.id, sessions);
                    const isDocEvening = s ? isEveningSession(s) : false;
                    const isSelected = selectedDoctorId === doc.id;
                    return (
                      <div
                        key={doc.id}
                        onClick={() => {
                          setSelectedDoctorId(doc.id);
                          selectedDoctorIdRef.current = doc.id;
                          localStorage.setItem(`citycare_selected_doctor_${currentUser.hospitalId}`, doc.id);
                          if (activeShift === 'FULL_DAY') {
                            setFullDayPage(1);
                            loadFullDayHistory(doc.id, true);
                          } else {
                            const docShift = isDocEvening ? 'EVENING' : 'MORNING';
                            setActiveShift(docShift);
                            activeShiftRef.current = docShift;
                            if (s) {
                              setSelectedSessionId(s.id);
                              selectedSessionIdRef.current = s.id;
                              setQueueBoard(null);
                              loadQueueBoard(s.id);
                            } else {
                              setSelectedSessionId('');
                              selectedSessionIdRef.current = '';
                              setQueueBoard(null);
                            }
                          }
                          setLatestArrival(null);
                          setError(null);
                        }}
                        className={`flex-shrink-0 snap-start text-left p-3.5 sm:p-4 rounded-2xl border-2 transition cursor-pointer w-[86vw] max-w-[340px] sm:w-80 flex flex-col justify-between ${
                          isSelected
                            ? 'border-emerald-600 bg-emerald-50/70 shadow-md ring-2 ring-emerald-600/20'
                            : 'border-slate-200 bg-slate-50/70 hover:border-slate-300 hover:bg-white'
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between mb-1 gap-2">
                            <span className="font-extrabold text-sm text-slate-900 truncate flex-1 min-w-0">{doc.name}</span>
                            <span className="text-[11px] bg-white px-2 py-0.5 rounded-md border border-slate-200 font-bold text-emerald-700 shadow-2xs whitespace-nowrap flex-shrink-0">
                              {doc.roomNumber}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 truncate mb-2.5">{doc.specialty}</p>

                          {/* Direct Shift Switcher Segmented Control */}
                          {s ? (
                            <>
                              <div
                                className="grid grid-cols-2 p-1 bg-slate-200/80 rounded-xl mb-2.5 gap-1 shadow-2xs border border-slate-300/60"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <button
                                  type="button"
                                  onClick={() => switchDoctorShift(doc.id, 'MORNING')}
                                  className={`py-1 rounded-lg text-[11px] font-black flex items-center justify-center space-x-1.5 transition cursor-pointer ${
                                    !isDocEvening
                                      ? 'bg-amber-500 text-white shadow-xs'
                                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-300/50'
                                  }`}
                                  title="Click to activate Morning OPD for this doctor"
                                >
                                  <Sunrise className="w-3.5 h-3.5" />
                                  <span>Morning</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => switchDoctorShift(doc.id, 'EVENING')}
                                  className={`py-1 rounded-lg text-[11px] font-black flex items-center justify-center space-x-1.5 transition cursor-pointer ${
                                    isDocEvening
                                      ? 'bg-purple-600 text-white shadow-xs'
                                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-300/50'
                                  }`}
                                  title="Click to activate Evening OPD for this doctor"
                                >
                                  <Sunset className="w-3.5 h-3.5" />
                                  <span>Evening</span>
                                </button>
                              </div>

                              {/* Active Status & Take Break / Resume Row */}
                              <div className="flex items-center justify-between mb-2.5 pb-2 border-b border-slate-200/70">
                                {s.status === 'OPEN' ? (
                                  <span className="inline-flex items-center gap-1.5 font-bold text-emerald-700 text-xs bg-emerald-100/80 border border-emerald-300/70 px-2.5 py-0.5 rounded-full">
                                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                                    <span>Active</span>
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1.5 font-bold text-amber-800 text-xs bg-amber-100/80 border border-amber-300/70 px-2.5 py-0.5 rounded-full">
                                    <PauseCircle className="w-3.5 h-3.5 text-amber-600" />
                                    <span>On Break</span>
                                  </span>
                                )}

                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleToggleSessionStatus(s);
                                  }}
                                  className={`text-xs font-bold px-3 py-1 rounded-lg border transition shadow-2xs cursor-pointer ${
                                    s.status === 'OPEN'
                                      ? 'bg-amber-50 hover:bg-amber-100 text-amber-800 border-amber-300 hover:border-amber-400'
                                      : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-300 hover:border-emerald-400'
                                  }`}
                                >
                                  {s.status === 'OPEN' ? 'Take Break' : 'Resume'}
                                </button>
                              </div>
                            </>
                          ) : (
                            <div className="flex items-center justify-between w-full py-1 mb-2.5 pb-2 border-b border-slate-200/60">
                              <span className="inline-flex items-center gap-1.5 font-bold text-slate-500 text-xs">
                                <Clock className="w-3.5 h-3.5 text-slate-400" />
                                <span>Morning OPD</span>
                              </span>
                              <span className="text-xs bg-slate-100 text-slate-600 font-bold px-2.5 py-0.5 rounded-md border border-slate-200">
                                Scheduled
                              </span>
                            </div>
                          )}
                        </div>

                        <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-200/60 font-semibold gap-2">
                          <span className="text-slate-600">Waiting: <strong className="text-emerald-700 font-extrabold text-sm">{s ? s.waitingCount : '—'}</strong></span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenEditDoctor(doc);
                            }}
                            className="bg-white hover:bg-emerald-600 hover:text-white text-slate-700 border border-slate-300 hover:border-emerald-600 px-2.5 py-1 rounded-lg text-xs font-bold flex items-center space-x-1 shadow-2xs transition cursor-pointer flex-shrink-0"
                            title="Edit this doctor profile"
                          >
                            <Edit className="w-3 h-3 text-emerald-600" />
                            <span>Edit Doctor</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 space-y-3">
                  <Calendar className="w-8 h-8 text-slate-400 mx-auto" />
                  <div>
                    <p className="font-bold text-slate-700 text-sm">No Active Doctors Found</p>
                    <p className="text-xs text-slate-400">Add or configure doctors in the Doctor Rosters tab.</p>
                  </div>
                </div>
              )}
            </div>

            {/* Live Queue Board Grid - only displayed when sessions exist for selected date and not in Full Day History view */}
            {activeShift !== 'FULL_DAY' && queueBoard && sessions.length > 0 && selectedSessionId && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
                {/* Left Column: Room Status & Bulk Walk-In Tool */}
                <div className="space-y-4 sm:space-y-6">
                  {/* Active Serving Card */}
                  <div className="bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-sm border border-slate-200 text-center relative overflow-hidden">
                    <div className="inline-flex items-center px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 mb-2">
                      Currently Serving
                    </div>
                    <div className="text-6xl font-black text-emerald-600 my-2 tracking-tight">
                      {queueBoard.currentServingToken ? `#${queueBoard.currentServingToken}` : '—'}
                    </div>
                    <p className="text-base font-extrabold text-slate-800">{queueBoard.doctorName}</p>
                    <p className="text-xs text-slate-500">{queueBoard.doctorRoomNumber}</p>

                    <button
                      type="button"
                      onClick={handleEditActiveDoctor}
                      className="mt-3 w-full bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-extrabold px-3 py-2 rounded-xl text-xs flex items-center justify-center space-x-1.5 border border-emerald-300 shadow-2xs transition cursor-pointer"
                    >
                      <Edit className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Edit Doctor Profile & Room</span>
                    </button>

                    <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-slate-100 text-xs">
                      <div className="bg-slate-50 p-2.5 rounded-2xl">
                        <span className="text-slate-400 block text-[10px] font-bold">ONLINE</span>
                        <span className="font-black text-lg text-slate-800">{queueBoard.totalOnlineCount}</span>
                      </div>
                      <div className="bg-slate-50 p-2.5 rounded-2xl">
                        <span className="text-slate-400 block text-[10px] font-bold">WALK-INS</span>
                        <span className="font-black text-lg text-slate-800">{queueBoard.totalWalkinCount}</span>
                      </div>
                      <div className="bg-emerald-50 p-2.5 rounded-2xl">
                        <span className="text-emerald-600 block text-[10px] font-bold">WAITING</span>
                        <span className="font-black text-lg text-emerald-700">{queueBoard.waitingCount}</span>
                      </div>
                    </div>
                  </div>

                  {/* WALK-IN PATIENTS MECHANISM */}
                  <div className="bg-gradient-to-br from-white to-emerald-50/40 rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-sm border-2 border-emerald-500/30 space-y-3.5 sm:space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-extrabold text-slate-900 text-base flex items-center space-x-2">
                          <UserPlus className="w-5 h-5 text-emerald-600" />
                          <span>Walk-in Patients</span>
                        </h3>
                        <p className="text-xs text-slate-500">Record physical arrivals at reception instantly</p>
                      </div>
                      <span className="text-xs bg-emerald-100 text-emerald-800 font-extrabold px-2.5 py-1 rounded-lg">
                        Next: #{queueBoard.nextTokenSequence}
                      </span>
                    </div>

                    <div className="flex items-center space-x-3 bg-white p-3 rounded-2xl border border-slate-200">
                      <button
                        onClick={() => setWalkInCount(Math.max(1, walkInCount - 1))}
                        className="w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold flex items-center justify-center text-lg transition cursor-pointer"
                      >
                        -
                      </button>
                      <input
                        type="number"
                        min="1"
                        max="100"
                        value={walkInCount}
                        onChange={(e) => setWalkInCount(Math.max(1, parseInt(e.target.value) || 1))}
                        className="flex-1 text-center font-black text-2xl text-slate-900 border-none focus:outline-none"
                      />
                      <button
                        onClick={() => setWalkInCount(walkInCount + 1)}
                        className="w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold flex items-center justify-center text-lg transition cursor-pointer"
                      >
                        +
                      </button>
                    </div>

                    <button
                      onClick={handleAddWalkIns}
                      disabled={addingWalkIns}
                      className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold py-3.5 rounded-2xl shadow-md transition flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50"
                    >
                      <UserPlus className="w-4 h-4" />
                      <span>{addingWalkIns ? 'Allocating...' : `Confirm Add ${walkInCount} Walk-in(s)`}</span>
                    </button>
                  </div>
                </div>

                {/* Right Column: Active Live Queue Roster (2 columns wide) */}
                <div className="lg:col-span-2 bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-sm border border-slate-200 flex flex-col">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-4 pb-3 border-b border-slate-100">
                    <div>
                      <div className="flex items-center space-x-2.5">
                        <h3 className="font-extrabold text-slate-900 text-base">
                          Queue Roster — {queueBoard.doctorName}
                        </h3>
                        <button
                          type="button"
                          onClick={handleEditActiveDoctor}
                          className="bg-slate-100 hover:bg-emerald-100 text-slate-700 hover:text-emerald-800 font-bold px-2 py-0.5 rounded-lg text-xs flex items-center space-x-1 border border-slate-300 transition cursor-pointer"
                          title="Edit Doctor Details"
                        >
                          <Edit className="w-3 h-3 text-emerald-600" />
                          <span>Edit Doctor</span>
                        </button>
                      </div>
                      <p className="text-xs text-slate-500">Live tokens synchronized across reception, doctor room, and patient mobile</p>
                    </div>

                    {/* Inline Quick Search inside Queue */}
                    <div className="relative w-full sm:w-72">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                      <input
                        type="text"
                        placeholder="Search token #, name, phone..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-8 pr-7 py-1.5 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white shadow-2xs font-medium"
                      />
                      {searchQuery && (
                        <button
                          type="button"
                          onClick={() => setSearchQuery('')}
                          className="absolute right-2.5 top-1.5 text-slate-400 hover:text-slate-700 text-sm font-bold cursor-pointer"
                          title="Clear search"
                        >
                          &times;
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Search query feedback banner */}
                  {searchQuery.trim() && (
                    <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl flex flex-wrap items-center justify-between gap-2 text-xs text-emerald-900">
                      <div className="flex items-center space-x-2">
                        <Search className="w-3.5 h-3.5 text-emerald-600" />
                        <span>
                          Matching in this queue: <strong>{filteredTokens.length}</strong> token{filteredTokens.length === 1 ? '' : 's'} for <strong>"{searchQuery}"</strong>
                        </span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <button
                          type="button"
                          onClick={() => setShowSearchModal(true)}
                          className="text-emerald-700 hover:text-emerald-900 font-bold underline cursor-pointer text-xs"
                        >
                          Search All Hospital Sessions &rarr;
                        </button>
                        <button
                          type="button"
                          onClick={() => setSearchQuery('')}
                          className="bg-emerald-200 hover:bg-emerald-300 text-emerald-800 font-bold px-2 py-0.5 rounded-md cursor-pointer text-[11px]"
                        >
                          Clear
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Token List */}
                  <div className="space-y-2.5 overflow-y-auto max-h-[560px] pr-1">
                    {filteredTokens.length === 0 ? (
                      searchQuery.trim() ? (
                        <div className="py-12 text-center text-slate-400 space-y-3 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200 p-6">
                          <Search className="w-8 h-8 mx-auto text-slate-300" />
                          <div>
                            <p className="text-sm font-bold text-slate-700">No tokens matching "{searchQuery}" in this doctor's queue</p>
                            <p className="text-xs text-slate-400 mt-1">
                              The patient might have booked with another doctor or in another session.
                            </p>
                          </div>
                          <div className="flex items-center justify-center space-x-2 pt-2">
                            <button
                              type="button"
                              onClick={() => setShowSearchModal(true)}
                              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-3.5 py-2 rounded-xl transition cursor-pointer flex items-center space-x-1.5 shadow-xs"
                            >
                              <Search className="w-3.5 h-3.5" />
                              <span>Search All Hospital Sessions & History</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setSearchQuery('')}
                              className="bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs px-3 py-2 rounded-xl transition cursor-pointer"
                            >
                              Reset Filter
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="py-16 text-center text-slate-400 space-y-2">
                          <Users className="w-10 h-10 mx-auto text-slate-300" />
                          <p className="text-sm font-semibold">No tokens in this queue yet.</p>
                          <p className="text-xs text-slate-400">Add physical walk-ins or wait for online patients to book.</p>
                        </div>
                      )
                    ) : (
                      filteredTokens.map((t) => {
                        const isCurrent = queueBoard.currentServingToken === t.tokenNumber;
                        const isWalkin = t.tokenType === 'WALK_IN';
                        return (
                          <div
                            key={t.id}
                            className={`p-3.5 rounded-2xl border transition flex flex-wrap items-center justify-between gap-3 ${
                              isCurrent
                                ? 'border-emerald-500 bg-emerald-50/80 ring-2 ring-emerald-500/20'
                                : t.status === 'COMPLETED'
                                ? 'border-slate-100 bg-slate-50/50 opacity-60'
                                : 'border-slate-200 bg-white hover:border-slate-300'
                            }`}
                          >
                            <div className="flex items-center space-x-3.5">
                              <div
                                className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-lg ${
                                  isCurrent
                                    ? 'bg-emerald-600 text-white shadow-md'
                                    : t.status === 'COMPLETED'
                                    ? 'bg-slate-200 text-slate-600'
                                    : 'bg-slate-100 text-slate-800'
                                }`}
                              >
                                #{t.tokenNumber}
                              </div>

                              <div>
                                <div className="flex items-center space-x-2">
                                  <span className="font-extrabold text-sm text-slate-900">
                                    {t.patientName || (isWalkin ? 'Physical Walk-in' : 'Online Patient')}
                                  </span>
                                  <span
                                    className={`text-[10px] font-extrabold px-2 py-0.5 rounded ${
                                      isWalkin ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'
                                    }`}
                                  >
                                    {t.tokenType}
                                  </span>
                                </div>
                                <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-xs text-slate-500 mt-0.5">
                                  {t.patientPhone && (
                                    <span className="font-semibold text-slate-700 flex items-center space-x-1">
                                      <Phone className="w-3 h-3 text-slate-400" />
                                      <span>+91 {t.patientPhone}</span>
                                    </span>
                                  )}
                                  {t.patientLocation && (
                                    <span className="font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md flex items-center space-x-1">
                                      <MapPin className="w-3 h-3 text-emerald-600" />
                                      <span>{t.patientLocation}</span>
                                    </span>
                                  )}
                                  <span className="text-slate-400">
                                    Ref: <span className="font-mono text-slate-600">{t.bookingReference}</span> • Status: <span className="font-bold text-slate-700">{t.status}</span>
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* Lifecycle Action Buttons */}
                            <div className="flex items-center space-x-1.5">
                              <button
                                onClick={() => setInspectingPatientToken(t)}
                                className="p-1.5 text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg cursor-pointer transition flex items-center space-x-1 text-xs font-bold border border-slate-200"
                                title="View Full Patient Details"
                              >
                                <Eye className="w-3.5 h-3.5 text-emerald-600" />
                                <span className="hidden sm:inline">Details</span>
                              </button>

                              {t.status === 'WAITING' && (
                                <button
                                  onClick={() => handleCallToken(t.tokenNumber)}
                                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3 py-1.5 rounded-xl transition flex items-center space-x-1 cursor-pointer"
                                >
                                  <Play className="w-3 h-3" />
                                  <span>Call</span>
                                </button>
                              )}

                              {t.status === 'CALLED' && (
                                <button
                                  onClick={() => handleUpdateStatus(t.id, 'IN_CONSULTATION')}
                                  className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-3 py-1.5 rounded-xl transition cursor-pointer"
                                >
                                  In Room
                                </button>
                              )}

                              {t.status === 'IN_CONSULTATION' && (
                                <button
                                  onClick={() => handleUpdateStatus(t.id, 'COMPLETED')}
                                  className="bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold px-3 py-1.5 rounded-xl transition flex items-center space-x-1 cursor-pointer"
                                >
                                  <CheckCircle className="w-3 h-3" />
                                  <span>Complete</span>
                                </button>
                              )}

                              {(t.status === 'WAITING' || t.status === 'CALLED') && (
                                <button
                                  onClick={() => handleUpdateStatus(t.id, 'SKIPPED', 'Patient not present')}
                                  className="text-slate-400 hover:text-amber-600 p-1.5 hover:bg-slate-100 rounded-lg cursor-pointer"
                                  title="Skip Patient"
                                >
                                  <SkipForward className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* FULL DAY HISTORY VIEW (Morning + Evening Consolidated) */}
            {activeShift === 'FULL_DAY' && (
              <div className="space-y-6">
                {/* Full Day Header & Metrics */}
                <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 space-y-6">
                  <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-100">
                    <div className="flex items-center space-x-3">
                      <div className="p-3 bg-indigo-50 text-indigo-700 rounded-2xl border border-indigo-100">
                        <Calendar className="w-6 h-6" />
                      </div>
                      <div>
                        <div className="flex items-center space-x-2">
                          <h2 className="text-lg font-black text-slate-900">
                            Full Day Patient History (संपूर्ण दिन का विवरण)
                          </h2>
                          <span className="bg-indigo-100 text-indigo-800 text-[11px] font-black px-2.5 py-0.5 rounded-full">
                            Morning + Evening
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Consolidated today's queue for {doctors.find(d => d.id === selectedDoctorId)?.name || 'Doctor'} • {selectedDate}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => selectedDoctorId && loadFullDayHistory(selectedDoctorId, true)}
                      disabled={loadingFullDay}
                      className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-3.5 py-2 rounded-xl text-xs flex items-center space-x-1.5 transition cursor-pointer disabled:opacity-50"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${loadingFullDay ? 'animate-spin' : ''}`} />
                      <span>Refresh History</span>
                    </button>
                  </div>

                  {/* Summary Metric Cards - Total, Morning OPD, Evening OPD */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <button
                      type="button"
                      onClick={() => { setFullDayShiftFilter('ALL'); setFullDayPage(1); }}
                      className={`text-left p-5 rounded-2xl border transition cursor-pointer ${
                        fullDayShiftFilter === 'ALL'
                          ? 'bg-indigo-50/70 border-indigo-300 ring-2 ring-indigo-500/20 shadow-xs'
                          : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <span className="text-slate-500 block text-[11px] font-black uppercase tracking-wider">Total Patients</span>
                      <span className="font-black text-3xl text-slate-900 mt-1 block">{fullDayBoard?.stats.total || 0}</span>
                      <span className="text-[11px] text-slate-400 mt-0.5 block font-medium">All shifts for selected doctor</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => { setFullDayShiftFilter('MORNING'); setFullDayPage(1); }}
                      className={`text-left p-5 rounded-2xl border transition cursor-pointer ${
                        fullDayShiftFilter === 'MORNING'
                          ? 'bg-amber-100/60 border-amber-400 ring-2 ring-amber-500/20 shadow-xs'
                          : 'bg-amber-50/60 border-amber-200/70 hover:border-amber-300'
                      }`}
                    >
                      <span className="text-amber-800 block text-[11px] font-black uppercase tracking-wider flex items-center space-x-1.5">
                        <Sunrise className="w-3.5 h-3.5" />
                        <span>Morning OPD Patients</span>
                      </span>
                      <span className="font-black text-3xl text-amber-900 mt-1 block">{fullDayBoard?.stats.morning || 0}</span>
                      <span className="text-[11px] text-amber-700/80 mt-0.5 block font-medium">Click to view morning session only</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => { setFullDayShiftFilter('EVENING'); setFullDayPage(1); }}
                      className={`text-left p-5 rounded-2xl border transition cursor-pointer ${
                        fullDayShiftFilter === 'EVENING'
                          ? 'bg-purple-100/60 border-purple-400 ring-2 ring-purple-500/20 shadow-xs'
                          : 'bg-purple-50/60 border-purple-200/70 hover:border-purple-300'
                      }`}
                    >
                      <span className="text-purple-800 block text-[11px] font-black uppercase tracking-wider flex items-center space-x-1.5">
                        <Sunset className="w-3.5 h-3.5" />
                        <span>Evening OPD Patients</span>
                      </span>
                      <span className="font-black text-3xl text-purple-900 mt-1 block">{fullDayBoard?.stats.evening || 0}</span>
                      <span className="text-[11px] text-purple-700/80 mt-0.5 block font-medium">Click to view evening session only</span>
                    </button>
                  </div>

                  {/* Filter & Search Bar */}
                  <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                    {/* Shift Filter Pills */}
                    <div className="flex items-center space-x-1.5 bg-slate-100 p-1 rounded-2xl">
                      <button
                        type="button"
                        onClick={() => { setFullDayShiftFilter('ALL'); setFullDayPage(1); }}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                          fullDayShiftFilter === 'ALL'
                            ? 'bg-white text-slate-900 shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        All Shifts ({fullDayBoard?.stats.total || 0})
                      </button>
                      <button
                        type="button"
                        onClick={() => { setFullDayShiftFilter('MORNING'); setFullDayPage(1); }}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center space-x-1 ${
                          fullDayShiftFilter === 'MORNING'
                            ? 'bg-amber-500 text-white shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        <Sunrise className="w-3.5 h-3.5" />
                        <span>Morning OPD ({fullDayBoard?.stats.morning || 0})</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => { setFullDayShiftFilter('EVENING'); setFullDayPage(1); }}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center space-x-1 ${
                          fullDayShiftFilter === 'EVENING'
                            ? 'bg-purple-600 text-white shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        <Sunset className="w-3.5 h-3.5" />
                        <span>Evening OPD ({fullDayBoard?.stats.evening || 0})</span>
                      </button>
                    </div>

                    <div className="flex items-center space-x-2 flex-1 max-w-md">
                      {/* Search */}
                      <div className="relative flex-1">
                        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                        <input
                          type="text"
                          value={fullDaySearch}
                          onChange={(e) => { setFullDaySearch(e.target.value); setFullDayPage(1); }}
                          placeholder="Search token #, patient name, phone..."
                          className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>

                      {/* Status Filter */}
                      <select
                        value={fullDayStatusFilter}
                        onChange={(e) => { setFullDayStatusFilter(e.target.value); setFullDayPage(1); }}
                        className="px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        <option value="ALL">All Statuses</option>
                        <option value="COMPLETED">Completed</option>
                        <option value="IN_CONSULTATION">In Room</option>
                        <option value="WAITING">Waiting</option>
                        <option value="CALLED">Called</option>
                        <option value="SKIPPED">Skipped</option>
                        <option value="CANCELLED">Cancelled</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Patient Roster */}
                <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200">
                  <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
                    <h3 className="font-extrabold text-slate-800 text-sm">
                      Patient Queue Records
                    </h3>
                    <span className="text-xs font-semibold text-slate-500">
                      Showing {filteredFullDayTokens.length === 0 ? 0 : (fullDayPage - 1) * fullDayPageSize + 1} to{' '}
                      {Math.min(fullDayPage * fullDayPageSize, filteredFullDayTokens.length)} of {filteredFullDayTokens.length} patient(s)
                    </span>
                  </div>

                  {loadingFullDay ? (
                    <div className="p-12 text-center">
                      <RefreshCw className="w-8 h-8 text-indigo-500 animate-spin mx-auto mb-2" />
                      <p className="text-xs font-bold text-slate-600">Loading Full Day Patient Records...</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {paginatedFullDayTokens.map((t) => {
                        const isMorning = t.shiftType === 'MORNING';
                        return (
                          <div
                            key={`${t.sessionId}-${t.id}`}
                            className="p-4 rounded-2xl border border-slate-200 hover:border-indigo-300 hover:shadow-xs transition bg-slate-50/50 flex flex-wrap items-center justify-between gap-4"
                          >
                            <div className="flex items-center space-x-4">
                              <div className="text-center min-w-[56px]">
                                <span className="text-2xl font-black text-slate-900 block tracking-tight">
                                  #{t.tokenNumber}
                                </span>
                                <span
                                  className={`inline-flex items-center space-x-0.5 text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
                                    isMorning
                                      ? 'bg-amber-100 text-amber-900'
                                      : 'bg-purple-100 text-purple-900'
                                  }`}
                                >
                                  {isMorning ? <Sunrise className="w-2.5 h-2.5 mr-0.5" /> : <Sunset className="w-2.5 h-2.5 mr-0.5" />}
                                  <span>{t.shiftLabel}</span>
                                </span>
                              </div>

                              <div className="space-y-0.5">
                                <div className="flex items-center space-x-2">
                                  <h4 className="font-extrabold text-slate-900 text-sm">
                                    {t.patientName || 'Walk-in Patient'}
                                  </h4>
                                  <span
                                    className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md ${
                                      t.tokenType === 'ONLINE'
                                        ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                        : 'bg-slate-100 text-slate-700 border border-slate-200'
                                    }`}
                                  >
                                    {t.tokenType}
                                  </span>
                                </div>
                                <div className="flex flex-wrap items-center gap-x-3 text-xs text-slate-500">
                                  {t.patientAge && <span>Age: {t.patientAge} {t.patientGender && `(${t.patientGender})`}</span>}
                                  {t.patientPhone && <span>Phone: {t.patientPhone}</span>}
                                  {t.bookingReference && <span className="font-mono text-[11px] text-slate-400">Ref: {t.bookingReference}</span>}
                                  {t.createdAt && (
                                    <span>
                                      Time: {new Date(t.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                  )}
                                </div>
                                {t.reasonForVisit && (
                                  <p className="text-xs text-slate-600 bg-white px-2 py-1 rounded-lg border border-slate-200/70 inline-block mt-1">
                                    <strong className="text-slate-500 font-semibold">Reason:</strong> {t.reasonForVisit}
                                  </p>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center space-x-3">
                              <span
                                className={`text-xs font-black px-3 py-1 rounded-xl ${
                                  t.status === 'COMPLETED'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : t.status === 'IN_CONSULTATION'
                                    ? 'bg-blue-100 text-blue-800'
                                    : t.status === 'CALLED'
                                    ? 'bg-indigo-100 text-indigo-800 animate-pulse'
                                    : t.status === 'WAITING'
                                    ? 'bg-amber-100 text-amber-800'
                                    : 'bg-slate-200 text-slate-700'
                                }`}
                              >
                                {t.status.replace('_', ' ')}
                              </span>

                              <button
                                type="button"
                                onClick={() => setInspectingPatientToken(t)}
                                className="p-2 text-slate-500 hover:text-indigo-700 hover:bg-indigo-50 rounded-xl cursor-pointer transition flex items-center space-x-1 text-xs font-bold border border-slate-200"
                                title="View Full Patient Record"
                              >
                                <Eye className="w-3.5 h-3.5 text-indigo-600" />
                                <span>Details</span>
                              </button>
                            </div>
                          </div>
                        );
                      })}

                      {filteredFullDayTokens.length === 0 && (
                        <div className="p-10 text-center text-slate-400 space-y-2">
                          <Calendar className="w-8 h-8 mx-auto text-slate-300" />
                          <p className="text-xs font-bold">No patient tokens found matching the filter.</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Pagination Controls */}
                  {totalFullDayPages > 1 && (
                    <div className="flex items-center justify-between pt-4 mt-4 border-t border-slate-100">
                      <div className="text-xs text-slate-500 font-medium">
                        Page <span className="font-bold text-slate-800">{fullDayPage}</span> of{' '}
                        <span className="font-bold text-slate-800">{totalFullDayPages}</span> ({fullDayPageSize} per page)
                      </div>
                      <div className="flex items-center space-x-1">
                        <button
                          type="button"
                          onClick={() => setFullDayPage(p => Math.max(1, p - 1))}
                          disabled={fullDayPage <= 1}
                          className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
                        >
                          Previous
                        </button>
                        {Array.from({ length: totalFullDayPages }, (_, i) => i + 1).map((pg) => {
                          if (
                            totalFullDayPages > 7 &&
                            pg !== 1 &&
                            pg !== totalFullDayPages &&
                            Math.abs(pg - fullDayPage) > 1
                          ) {
                            if (pg === 2 || pg === totalFullDayPages - 1) {
                              return <span key={pg} className="px-1 text-slate-400 text-xs">...</span>;
                            }
                            return null;
                          }
                          return (
                            <button
                              key={pg}
                              type="button"
                              onClick={() => setFullDayPage(pg)}
                              className={`w-8 h-8 rounded-xl text-xs font-bold transition cursor-pointer ${
                                fullDayPage === pg
                                  ? 'bg-indigo-600 text-white shadow-xs'
                                  : 'text-slate-600 hover:bg-slate-100 border border-transparent'
                              }`}
                            >
                              {pg}
                            </button>
                          );
                        })}
                        <button
                          type="button"
                          onClick={() => setFullDayPage(p => Math.min(totalFullDayPages, p + 1))}
                          disabled={fullDayPage >= totalFullDayPages}
                          className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
                        >
                          Next
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* When a doctor is selected but has no session in this shift */}
            {activeShift !== 'FULL_DAY' && (!selectedSessionId || !queueBoard) && (
              <div className="bg-white rounded-3xl p-10 border border-slate-200 text-center space-y-4 shadow-xs">
                <div className="w-16 h-16 bg-amber-50 text-amber-600 rounded-3xl flex items-center justify-center mx-auto border border-amber-200">
                  {activeShift === 'EVENING' ? <Sunset className="w-8 h-8" /> : <Sunrise className="w-8 h-8" />}
                </div>
                <div className="max-w-md mx-auto space-y-1">
                  <h3 className="font-extrabold text-slate-900 text-lg">
                    {activeShift === 'EVENING' ? 'Evening OPD (5:00 PM - 7:00 PM)' : 'Morning OPD (9:00 AM - 2:00 PM)'} Not Active
                  </h3>
                  <p className="text-xs text-slate-500">
                    {doctors.find(d => d.id === selectedDoctorId)?.name || 'The selected doctor'} does not have an active session for {activeShift === 'EVENING' ? 'Evening' : 'Morning'} OPD today.
                  </p>
                  <p className="text-[11px] text-slate-400">
                    You can activate this shift at any time using the Activate button on the doctor card above.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* TAB 2: DOCTOR ROOM VIEW (Dedicated Single Doctor Screen)      */}
        {/* ------------------------------------------------------------- */}
        {activeTab === 'DOCTOR_ROOM' && (
          <div className="space-y-5">
            {/* Doctor & Date Header */}
            <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-200 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-4 pb-3 border-b border-slate-100">
                <div className="flex items-center space-x-3">
                  <div className="p-3 bg-emerald-100 text-emerald-800 rounded-2xl">
                    <Stethoscope className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="font-extrabold text-slate-900 text-base">Doctor Consultation Room Mode</h2>
                    <p className="text-xs text-slate-500">Dedicated desk for doctors inside their consultation chamber</p>
                  </div>
                </div>

                <div className="flex items-center space-x-3">
                  <label className="text-xs font-bold text-slate-600">Select Doctor:</label>
                  <select
                    value={selectedDoctorId}
                    onChange={(e) => {
                      const newDocId = e.target.value;
                      setSelectedDoctorId(newDocId);
                      selectedDoctorIdRef.current = newDocId;
                      setLatestArrival(null);
                      loadDoctorRoomBoard(newDocId, selectedDate);
                    }}
                    className="px-3.5 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    {doctors.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name} — {d.roomNumber} ({d.specialty})
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => {
                      const doc = doctors.find((d) => d.id === selectedDoctorId);
                      if (doc) handleOpenEditDoctor(doc);
                    }}
                    className="bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold px-3 py-1.5 rounded-xl text-xs flex items-center space-x-1 border border-emerald-300 transition cursor-pointer"
                    title="Edit Selected Doctor Profile"
                  >
                    <Edit className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Edit Doctor</span>
                  </button>
                  <button
                    onClick={() => selectedDoctorId && loadDoctorRoomBoard(selectedDoctorId, selectedDate)}
                    className="p-2 text-slate-500 hover:text-slate-800 rounded-xl hover:bg-slate-100 transition cursor-pointer"
                    title="Refresh Doctor Queue"
                  >
                    <RefreshCw className={`w-4 h-4 ${loadingDoctorBoard ? 'animate-spin' : ''}`} />
                  </button>
                </div>
              </div>

              {/* Date & Shift Filter Bar */}
              <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
                {/* Date Selection */}
                <div className="flex items-center space-x-2 flex-wrap gap-y-2">
                  <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-xl">
                    <button
                      type="button"
                      onClick={() => setSelectedDate(todayStr)}
                      className={`px-3 py-1 rounded-lg transition font-bold cursor-pointer ${
                        selectedDate === todayStr
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Today
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedDate(getYesterdayString())}
                      className={`px-3 py-1 rounded-lg transition font-bold cursor-pointer ${
                        selectedDate === getYesterdayString()
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Yesterday
                    </button>
                  </div>

                  <div className="flex items-center space-x-2 bg-slate-50 px-3 py-1 rounded-xl border border-slate-200">
                    <Calendar className="w-3.5 h-3.5 text-slate-500" />
                    <span className="font-bold text-slate-600">Date:</span>
                    <input
                      type="date"
                      value={selectedDate}
                      max={todayStr}
                      onChange={(e) => {
                        if (e.target.value) {
                          setSelectedDate(e.target.value);
                        }
                      }}
                      className="font-bold text-slate-800 bg-transparent focus:outline-none cursor-pointer"
                    />
                  </div>

                  {selectedDate !== todayStr && (
                    <span className="text-[11px] font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-200">
                      Historical View ({selectedDate})
                    </span>
                  )}
                </div>

                {/* Shift Selector & Status for Selected Doctor */}
                {(() => {
                  const docSessions = sessions.filter(s => s.doctorId === selectedDoctorId);
                  const currentRoomSessionId = doctorBoard?.sessionId || selectedSessionId;
                  const activeSession = docSessions.find(s => s.id === currentRoomSessionId) || docSessions[0];
                  return (
                    <div className="flex items-center space-x-2.5 flex-wrap gap-y-2">
                      {/* Existing Shifts for this doctor on selectedDate */}
                      {docSessions.length > 1 && docSessions.map((s) => {
                        const isCurrentShift = s.id === currentRoomSessionId;
                        const isEvening = isEveningSession(s);
                        return (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => {
                              switchDoctorShift(selectedDoctorId, isEvening ? 'EVENING' : 'MORNING');
                            }}
                            className={`px-3.5 py-1.5 rounded-xl font-bold flex items-center space-x-1.5 border transition cursor-pointer ${
                              isCurrentShift
                                ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs ring-2 ring-emerald-600/20'
                                : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                            }`}
                          >
                            {isEvening ? <Sunset className="w-3.5 h-3.5" /> : <Sunrise className="w-3.5 h-3.5" />}
                            <span>{s.sessionName}</span>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-mono ${
                              isCurrentShift
                                ? 'bg-white/20 text-white'
                                : 'bg-slate-200 text-slate-700'
                            }`}>
                              #{s.nextTokenSequence - 1 || 0}
                            </span>
                          </button>
                        );
                      })}


                      {/* Active / Inactive Status Badge & Toggle */}
                      {activeSession && (
                        <div className="flex items-center space-x-2 pl-2 border-l border-slate-200">
                          {activeSession.status === 'OPEN' ? (
                            <span className="inline-flex items-center space-x-1 font-black text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-xl">
                              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                              <span>Active</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center space-x-1 font-bold text-amber-800 bg-amber-50 border border-amber-300 px-2.5 py-1 rounded-xl">
                              <PauseCircle className="w-3.5 h-3.5 text-amber-600" />
                              <span>On Break</span>
                            </span>
                          )}

                          <button
                            type="button"
                            onClick={() => handleToggleSessionStatus(activeSession)}
                            className={`px-3 py-1 rounded-xl font-bold border transition cursor-pointer text-xs ${
                              activeSession.status === 'OPEN'
                                ? 'bg-amber-50 hover:bg-amber-100 text-amber-900 border-amber-300'
                                : 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600 shadow-xs'
                            }`}
                          >
                            {activeSession.status === 'OPEN' ? 'Take Break' : 'Resume OPD'}
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            </div>

            {doctorBoard && doctorBoard.doctorId === selectedDoctorId ? (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Large Consultation Control Station */}
                <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 text-center space-y-5">
                  <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100">
                    <span className="text-xs font-black uppercase tracking-wider text-emerald-700 block">Current Patient In Room</span>
                    <div className="text-7xl font-black text-emerald-600 my-2">
                      {doctorBoard.currentServingToken ? `#${doctorBoard.currentServingToken}` : '—'}
                    </div>
                    {(() => {
                      const cur = doctorBoard.activeTokens.find(t => t.tokenNumber === doctorBoard.currentServingToken);
                      return cur ? (
                        <div className="space-y-1">
                          <p className="text-sm font-extrabold text-slate-800">
                            {cur.patientName || 'Physical Walk-in / In Room'}
                          </p>
                          <div className="flex flex-wrap items-center justify-center gap-2 text-xs text-slate-600">
                            {cur.patientPhone && <span>📞 +91 {cur.patientPhone}</span>}
                            {cur.patientLocation && (
                              <span className="font-semibold text-emerald-800 bg-emerald-100/70 px-2 py-0.5 rounded-md">
                                📍 {cur.patientLocation}
                              </span>
                            )}
                          </div>
                          <button
                            onClick={() => setInspectingPatientToken(cur)}
                            className="text-xs font-bold text-emerald-700 hover:text-emerald-900 inline-flex items-center space-x-1 mt-1 cursor-pointer underline"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>View Patient File</span>
                          </button>
                        </div>
                      ) : (
                        <p className="text-xs text-slate-400">Waiting for consultation to begin</p>
                      );
                    })()}
                    <p className="text-xs text-slate-500 mt-2">
                      Room: {doctorBoard.doctorRoomNumber} • {doctorBoard.doctorName}
                    </p>
                  </div>

                  {/* Primary Call / Complete Controls */}
                  <div className="space-y-2.5">
                    {(() => {
                      const currentToken = doctorBoard.activeTokens.find(t => t.tokenNumber === doctorBoard.currentServingToken);
                      const nextWaiting = doctorBoard.activeTokens.find(t => t.status === 'WAITING');

                      return (
                        <>
                          {nextWaiting && (
                            <button
                              onClick={() => handleCallToken(nextWaiting.tokenNumber, doctorBoard.doctorName, doctorBoard.doctorRoomNumber)}
                              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black py-4 rounded-2xl shadow-lg transition flex items-center justify-center space-x-2 text-sm cursor-pointer"
                            >
                              <Play className="w-4 h-4" />
                              <span>Call Next Patient (#{nextWaiting.tokenNumber})</span>
                            </button>
                          )}

                          {currentToken && currentToken.status !== 'COMPLETED' && (
                            <button
                              onClick={() => handleUpdateStatus(currentToken.id, 'COMPLETED')}
                              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-extrabold py-3 rounded-2xl transition flex items-center justify-center space-x-2 text-xs cursor-pointer"
                            >
                              <CheckCircle className="w-4 h-4" />
                              <span>Complete Consultation (#{currentToken.tokenNumber})</span>
                            </button>
                          )}
                        </>
                      );
                    })()}
                  </div>

                  {/* Stats Counter */}
                  <div className="grid grid-cols-2 gap-2 pt-3 border-t border-slate-100 text-xs">
                    <div className="bg-slate-50 p-2.5 rounded-xl text-center">
                      <span className="text-slate-400 block font-bold text-[10px]">WALK-INS</span>
                      <span className="font-black text-base text-slate-800">{doctorBoard.totalWalkinCount}</span>
                    </div>
                    <div className="bg-slate-50 p-2.5 rounded-xl text-center">
                      <span className="text-slate-400 block font-bold text-[10px]">ONLINE</span>
                      <span className="font-black text-base text-slate-800">{doctorBoard.totalOnlineCount}</span>
                    </div>
                  </div>
                </div>

                {/* Waiting Patients List */}
                <div className="lg:col-span-2 bg-white rounded-3xl p-6 shadow-sm border border-slate-200 space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100 flex-wrap gap-2">
                    <div>
                      <h3 className="font-extrabold text-slate-900 text-base">Patients Waiting for Consultation</h3>
                      <p className="text-xs text-slate-500">Total waiting: {doctorBoard.waitingCount} • Completed: {doctorBoard.completedCount}</p>
                    </div>
                    <div className="relative w-full sm:w-56">
                      <Search className="w-3 h-3 text-slate-400 absolute left-2.5 top-2.5" />
                      <input
                        type="text"
                        placeholder="Filter patients in room..."
                        value={doctorSearchQuery}
                        onChange={(e) => setDoctorSearchQuery(e.target.value)}
                        className="w-full pl-7 pr-6 py-1.5 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                      />
                      {doctorSearchQuery && (
                        <button
                          type="button"
                          onClick={() => setDoctorSearchQuery('')}
                          className="absolute right-2 top-1 text-slate-400 hover:text-slate-600 text-xs font-bold cursor-pointer"
                        >
                          &times;
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2 overflow-y-auto max-h-[500px]">
                    {filteredDoctorTokens.length === 0 ? (
                      <div className="py-16 text-center text-slate-400">
                        <CheckCircle className="w-10 h-10 mx-auto text-emerald-400 mb-2" />
                        <p className="text-sm font-semibold text-slate-700">
                          {doctorSearchQuery ? `No waiting patients match "${doctorSearchQuery}"` : 'All patients have been consulted!'}
                        </p>
                        <p className="text-xs text-slate-400">
                          {doctorSearchQuery ? 'Try clearing the search filter above.' : 'No more patients currently waiting in this queue.'}
                        </p>
                      </div>
                    ) : (
                      filteredDoctorTokens.map(t => (
                          <div
                            key={t.id}
                            className="p-3.5 rounded-2xl border border-slate-200 bg-white hover:border-slate-300 flex items-center justify-between transition"
                          >
                            <div className="flex items-center space-x-3">
                              <span className="w-10 h-10 rounded-xl bg-slate-100 font-black text-base flex items-center justify-center text-slate-800">
                                #{t.tokenNumber}
                              </span>
                              <div>
                                <div className="flex items-center space-x-2">
                                  <span className="font-bold text-sm text-slate-900">
                                    {t.patientName || (t.tokenType === 'WALK_IN' ? 'Physical Walk-in' : 'Online Patient')}
                                  </span>
                                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                    t.tokenType === 'WALK_IN' ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'
                                  }`}>
                                    {t.tokenType}
                                  </span>
                                </div>
                                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500 mt-0.5">
                                  {t.patientPhone && (
                                    <span className="font-medium text-slate-700">📞 +91 {t.patientPhone}</span>
                                  )}
                                  {t.patientLocation && (
                                    <span className="font-semibold text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded">
                                      📍 {t.patientLocation}
                                    </span>
                                  )}
                                  <span>Reason: {t.reasonForVisit || 'General OPD'}</span>
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center space-x-1.5">
                              <button
                                onClick={() => setInspectingPatientToken(t)}
                                className="p-1.5 text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg cursor-pointer transition text-xs font-bold border border-slate-200"
                                title="View Patient Details"
                              >
                                <Eye className="w-3.5 h-3.5 text-emerald-600" />
                              </button>
                              <button
                                onClick={() => handleCallToken(t.tokenNumber, doctorBoard.doctorName, doctorBoard.doctorRoomNumber)}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-3.5 py-1.5 rounded-xl transition cursor-pointer"
                              >
                                Call Now
                              </button>
                            </div>
                          </div>
                        ))
                    )}
                  </div>
                </div>
              </div>
            ) : loadingDoctorBoard ? (
              <div className="p-16 text-center bg-white rounded-3xl border border-slate-200 space-y-3">
                <RefreshCw className="w-8 h-8 text-emerald-600 animate-spin mx-auto" />
                <p className="font-bold text-slate-700 text-sm">Loading Consultation Room...</p>
                <p className="text-xs text-slate-400">Fetching live doctor queue and waiting patients for selected doctor</p>
              </div>
            ) : (
              <div className="p-12 text-center bg-white rounded-3xl border border-dashed border-slate-300 space-y-4">
                <div className="w-16 h-16 rounded-3xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
                  <Stethoscope className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-base">
                    No OPD Session Found for {doctors.find(d => d.id === selectedDoctorId)?.name || 'Doctor'} on {selectedDate}
                  </h3>
                  <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
                    There are no sessions recorded for this doctor on this date. OPD sessions are automatically provisioned for active doctors.
                  </p>
                </div>
                <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                  <button
                    onClick={() => loadSessions(selectedDate, true)}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold px-5 py-2.5 rounded-2xl text-xs flex items-center space-x-2 shadow-md transition cursor-pointer"
                  >
                    <RefreshCw className="w-4 h-4" />
                    <span>Reload Sessions</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* TAB 3: MANAGE DOCTORS (Roster, Add, Edit, Category, Room No)  */}
        {/* ------------------------------------------------------------- */}
        {activeTab === 'DOCTORS_ROSTER' && (
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-100">
              <div>
                <h2 className="font-black text-slate-900 text-lg flex items-center space-x-2">
                  <Stethoscope className="w-5 h-5 text-emerald-600" />
                  <span>Hospital Doctor Rosters & Consultation Rooms</span>
                </h2>
                <p className="text-xs text-slate-500">
                  Add, update, or configure doctor profiles, specialty categories, photos, and room numbers
                </p>
              </div>

              <button
                onClick={handleOpenAddDoctor}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-black px-4 py-2.5 rounded-2xl text-xs flex items-center space-x-1.5 shadow-md transition cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Add New Doctor</span>
              </button>
            </div>

            {loadingDoctors ? (
              <div className="py-12 text-center text-slate-400">Loading doctor roster...</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {doctors.map((doc) => (
                  <div
                    key={doc.id}
                    className="p-4 rounded-3xl border border-slate-200 bg-slate-50/50 hover:bg-white hover:border-slate-300 transition space-y-3 relative group"
                  >
                    <div className="flex items-center space-x-3.5">
                      <img
                        src={doc.photoUrl || AVATAR_PRESETS[0]}
                        alt={doc.name}
                        className="w-14 h-14 rounded-2xl object-cover border-2 border-white shadow-xs"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <h4 className="font-extrabold text-sm text-slate-900 truncate">{doc.name}</h4>
                          <span
                            className={`text-[10px] font-black px-2 py-0.5 rounded-md ${
                              doc.active ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                            }`}
                          >
                            {doc.active ? 'ACTIVE' : 'ON LEAVE'}
                          </span>
                        </div>
                        <p className="text-xs font-semibold text-emerald-700 truncate">{doc.specialty}</p>
                        <p className="text-[11px] text-slate-500">{doc.qualification || 'MBBS'}</p>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between text-xs">
                      <span className="font-mono bg-white px-2.5 py-1 rounded-lg border border-slate-200 font-bold text-slate-800">
                        {doc.roomNumber}
                      </span>
                      <span className="text-slate-500 text-[11px]">
                        Avg: {doc.avgConsultationMinutes}m / patient
                      </span>
                      <button
                        onClick={() => handleOpenEditDoctor(doc)}
                        className="bg-white hover:bg-slate-100 text-slate-700 font-bold px-2.5 py-1 rounded-lg border border-slate-200 text-xs flex items-center space-x-1 cursor-pointer transition"
                      >
                        <Edit className="w-3 h-3 text-emerald-600" />
                        <span>Edit</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* TAB 4: HOSPITAL QR & KIOSK ACCESS SECTION (Production Flow)   */}
        {/* ------------------------------------------------------------- */}
        {activeTab === 'QR_KIOSK' && (
          <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200 max-w-4xl mx-auto space-y-6">
            <div className="text-center space-y-2 max-w-xl mx-auto">
              <span className="bg-emerald-100 text-emerald-800 text-xs font-black px-3 py-1 rounded-full uppercase tracking-wider inline-block">
                Hospital Access & Patient Entry
              </span>
              <h2 className="text-2xl font-black text-slate-900">Hospital Patient QR Code & Kiosk Portal</h2>
              <p className="text-xs text-slate-500">
                Patients scan this unique QR code with their mobile phone camera to open your hospital's private OPD token desk. They never see any other hospital.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center pt-4">
              {/* QR Poster Card */}
              <div className="bg-gradient-to-b from-slate-900 to-slate-950 p-6 rounded-3xl text-center text-white space-y-4 shadow-xl border border-slate-800">
                <div className="space-y-1">
                  <h3 className="font-black text-lg text-emerald-400">{currentUser.hospitalName}</h3>
                  <p className="text-xs text-slate-300">Scan QR Code to Book OPD Token</p>
                </div>

                <div className="bg-white p-4 rounded-2xl inline-block shadow-inner">
                  <img
                    src={qrImageUrl}
                    alt="Hospital QR Code"
                    className="w-48 h-48 mx-auto"
                  />
                </div>

                <div className="space-y-1">
                  <p className="text-xs text-slate-400">Reception Kiosk 6-Digit Code:</p>
                  <span className="text-3xl font-black font-mono tracking-widest text-emerald-400">
                    {currentUser.hospitalAccessCode || '------'}
                  </span>
                </div>

                <button
                  onClick={() => window.print()}
                  className="bg-slate-800 hover:bg-slate-700 text-white font-bold px-4 py-2 rounded-xl text-xs flex items-center justify-center space-x-1.5 w-full cursor-pointer transition"
                >
                  <Printer className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Print Counter Poster</span>
                </button>
              </div>

              {/* Direct URLs & Kiosk Instructions */}
              <div className="space-y-5">
                <div className="space-y-2">
                  <label className="text-xs font-black uppercase tracking-wider text-slate-500 block">
                    Direct Patient Link:
                  </label>
                  <div className="flex items-center space-x-2">
                    <input
                      type="text"
                      readOnly
                      value={hospitalPatientUrl}
                      className="flex-1 px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-800 select-all focus:outline-none"
                    />
                    <button
                      onClick={handleCopyLink}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-2.5 rounded-xl text-xs font-bold transition flex items-center space-x-1 cursor-pointer"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span>{copiedLink ? 'Copied!' : 'Copy'}</span>
                    </button>
                  </div>
                </div>

                <a
                  href={`/h/${currentUser.hospitalSlug}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center space-x-2 text-xs font-bold text-emerald-600 hover:text-emerald-700 transition"
                >
                  <span>Open patient view in a new browser tab</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ------------------------------------------------------------- */}
      {/* MODAL: ADD / EDIT DOCTOR PROFILE                             */}
      {/* ------------------------------------------------------------- */}
      {showDoctorModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-black text-slate-900 text-base flex items-center space-x-2">
                <Stethoscope className="w-5 h-5 text-emerald-600" />
                <span>{doctorFormMode === 'ADD' ? 'Add New Doctor Profile' : 'Edit Doctor Details'}</span>
              </h3>
              <button
                onClick={() => setShowDoctorModal(false)}
                className="text-slate-400 hover:text-slate-600 font-bold text-lg cursor-pointer"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSaveDoctor} className="space-y-3.5">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Doctor Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Dr. Ramesh Patel"
                  value={doctorForm.name}
                  onChange={(e) => setDoctorForm({ ...doctorForm, name: e.target.value })}
                  className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Specialty / Category *</label>
                <select
                  value={doctorForm.specialty}
                  onChange={(e) => setDoctorForm({ ...doctorForm, specialty: e.target.value })}
                  className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white mb-1.5"
                >
                  {POPULAR_SPECIALTIES.map((sp) => (
                    <option key={sp} value={sp}>{sp}</option>
                  ))}
                  <option value="Custom">Other (Custom specialty)</option>
                </select>
                {doctorForm.specialty === 'Custom' && (
                  <input
                    type="text"
                    placeholder="Enter custom specialty category"
                    onChange={(e) => setDoctorForm({ ...doctorForm, specialty: e.target.value })}
                    className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-xs"
                  />
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Room Number / Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Room 104 (कमरा १०४)"
                    value={doctorForm.roomNumber}
                    onChange={(e) => setDoctorForm({ ...doctorForm, roomNumber: e.target.value })}
                    className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Qualification</label>
                  <input
                    type="text"
                    placeholder="e.g. MBBS, MD, MS"
                    value={doctorForm.qualification}
                    onChange={(e) => setDoctorForm({ ...doctorForm, qualification: e.target.value })}
                    className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Doctor Photo / Avatar</label>
                <div className="flex items-center space-x-2 mb-2">
                  {AVATAR_PRESETS.map((p, idx) => (
                    <button
                      type="button"
                      key={idx}
                      onClick={() => setDoctorForm({ ...doctorForm, photoUrl: p })}
                      className={`w-10 h-10 rounded-xl overflow-hidden border-2 cursor-pointer transition ${
                        doctorForm.photoUrl === p ? 'border-emerald-600 ring-2 ring-emerald-500/30' : 'border-slate-200 opacity-60 hover:opacity-100'
                      }`}
                    >
                      <img src={p} alt={`Avatar ${idx}`} className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  placeholder="Or enter custom image URL"
                  value={doctorForm.photoUrl}
                  onChange={(e) => setDoctorForm({ ...doctorForm, photoUrl: e.target.value })}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-xl text-[11px] text-slate-600 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Avg Consultation (min)</label>
                  <input
                    type="number"
                    min="1"
                    max="60"
                    value={doctorForm.avgConsultationMinutes}
                    onChange={(e) => setDoctorForm({ ...doctorForm, avgConsultationMinutes: parseInt(e.target.value) || 10 })}
                    className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-xs font-semibold focus:outline-none"
                  />
                </div>

                <div className="flex flex-col justify-end">
                  <label className="flex items-center space-x-2 cursor-pointer pb-2">
                    <input
                      type="checkbox"
                      checked={doctorForm.active}
                      onChange={(e) => setDoctorForm({ ...doctorForm, active: e.target.checked })}
                      className="w-4 h-4 text-emerald-600 rounded"
                    />
                    <span className="text-xs font-bold text-slate-800">Active (Accepting OPD)</span>
                  </label>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowDoctorModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingDoctor}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold px-5 py-2 rounded-xl text-xs shadow-md transition cursor-pointer disabled:opacity-50"
                >
                  {savingDoctor ? 'Saving...' : doctorFormMode === 'ADD' ? 'Create Doctor' : 'Update Doctor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL: ADVANCED PATIENT SEARCH                                */}
      {/* ------------------------------------------------------------- */}
      {showSearchModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[85vh] flex flex-col animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <Search className="w-5 h-5 text-emerald-600" />
                <h3 className="font-black text-slate-900 text-base">Hospital Patient Search</h3>
              </div>
              <button
                onClick={() => setShowSearchModal(false)}
                className="text-slate-400 hover:text-slate-600 font-bold text-lg cursor-pointer"
              >
                &times;
              </button>
            </div>

            {/* Scope Selection & Search Input */}
            <div className="space-y-3">
              <div className="flex items-center space-x-2 text-xs">
                <span className="text-slate-500 font-bold">Search Scope:</span>
                <button
                  type="button"
                  onClick={() => setSearchSessionScope('ALL')}
                  className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer ${
                    searchSessionScope === 'ALL'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  All Hospital Doctors & Sessions
                </button>
                <button
                  type="button"
                  onClick={() => setSearchSessionScope('CURRENT')}
                  className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer ${
                    searchSessionScope === 'CURRENT'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  Current Doctor ({queueBoard?.doctorName || 'Selected'})
                </button>
              </div>

              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="text"
                  autoFocus
                  placeholder="Search by Patient Name, Phone number, or Token #..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-9 py-2.5 border border-slate-300 rounded-2xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-700 text-sm font-bold cursor-pointer"
                    title="Clear Search"
                  >
                    &times;
                  </button>
                )}
              </div>
            </div>

            {/* Results container */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1 min-h-[220px]">
              {isSearching ? (
                <div className="py-12 text-center text-xs text-slate-400 flex items-center justify-center space-x-2">
                  <RefreshCw className="w-4 h-4 animate-spin text-emerald-600" />
                  <span>Searching hospital database...</span>
                </div>
              ) : searchResults.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-400">
                  {searchQuery ? `No matching patients found for "${searchQuery}".` : 'Type patient name, phone number, or token # to search.'}
                </div>
              ) : (
                searchResults.map((t) => (
                  <div
                    key={t.id}
                    className="p-3.5 rounded-2xl border border-slate-200 bg-slate-50/50 hover:bg-white flex items-center justify-between gap-3 transition"
                  >
                    <div className="flex items-center space-x-3">
                      <span className="w-10 h-10 rounded-xl bg-slate-200 font-black text-sm flex items-center justify-center text-slate-800">
                        #{t.tokenNumber}
                      </span>
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="font-extrabold text-sm text-slate-900">
                            {t.patientName || (t.tokenType === 'WALK_IN' ? 'Physical Walk-in' : 'Online Patient')}
                          </span>
                          <span className="text-[10px] font-bold bg-slate-200 px-1.5 py-0.5 rounded text-slate-700">
                            {t.status}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-xs text-slate-500 mt-0.5">
                          {t.patientPhone && (
                            <span className="font-semibold text-slate-700">📞 +91 {t.patientPhone}</span>
                          )}
                          {t.patientLocation && (
                            <span className="font-semibold text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded">
                              📍 {t.patientLocation}
                            </span>
                          )}
                          <span>Doctor: {t.doctorName} ({t.doctorRoomNumber})</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      <span className="text-[11px] font-mono text-slate-500 hidden sm:inline">{t.bookingReference}</span>
                      <button
                        onClick={() => {
                          setInspectingPatientToken(t);
                        }}
                        className="p-1.5 text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg cursor-pointer transition text-xs font-bold border border-slate-200"
                        title="View Full Patient Details"
                      >
                        <Eye className="w-3.5 h-3.5 text-emerald-600" />
                        <span className="hidden sm:inline">Details</span>
                      </button>
                      {t.sessionId !== selectedSessionId && (
                        <button
                          onClick={() => {
                            const sess = sessions.find(s => s.id === t.sessionId);
                            if (sess) {
                              setSelectedDoctorId(sess.doctorId);
                              selectedDoctorIdRef.current = sess.doctorId;
                              if (isEveningSession(sess)) {
                                setActiveShift('EVENING');
                                activeShiftRef.current = 'EVENING';
                              } else {
                                setActiveShift('MORNING');
                                activeShiftRef.current = 'MORNING';
                              }
                            }
                            setSelectedSessionId(t.sessionId);
                            selectedSessionIdRef.current = t.sessionId;
                            loadQueueBoard(t.sessionId);
                            setShowSearchModal(false);
                          }}
                          className="bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold px-3 py-1.5 rounded-xl transition cursor-pointer border border-slate-200"
                          title="Switch to this Doctor's live queue"
                        >
                          Switch to Queue
                        </button>
                      )}
                      {t.status === 'WAITING' && (
                        <button
                          onClick={() => {
                            const sess = sessions.find(s => s.id === t.sessionId);
                            if (sess) {
                              setSelectedDoctorId(sess.doctorId);
                              selectedDoctorIdRef.current = sess.doctorId;
                              if (isEveningSession(sess)) {
                                setActiveShift('EVENING');
                                activeShiftRef.current = 'EVENING';
                              } else {
                                setActiveShift('MORNING');
                                activeShiftRef.current = 'MORNING';
                              }
                            }
                            if (t.sessionId !== selectedSessionId) {
                              setSelectedSessionId(t.sessionId);
                              selectedSessionIdRef.current = t.sessionId;
                              loadQueueBoard(t.sessionId);
                            }
                            handleCallToken(t.tokenNumber, t.doctorName, t.doctorRoomNumber);
                            setShowSearchModal(false);
                          }}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3 py-1.5 rounded-xl transition cursor-pointer shadow-xs"
                        >
                          Call
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Patient Information & Detailed Record Modal */}
      {inspectingPatientToken && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="flex items-start justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center space-x-3.5">
                <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-800 font-black text-xl flex items-center justify-center">
                  #{inspectingPatientToken.tokenNumber}
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900">
                    {inspectingPatientToken.patientName || 'Physical Walk-in Patient'}
                  </h3>
                  <div className="flex items-center space-x-2 mt-0.5">
                    <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                      inspectingPatientToken.tokenType === 'WALK_IN' ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'
                    }`}>
                      {inspectingPatientToken.tokenType}
                    </span>
                    <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                      {inspectingPatientToken.status}
                    </span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setInspectingPatientToken(null)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 font-bold flex items-center justify-center cursor-pointer transition text-base"
              >
                &times;
              </button>
            </div>

            {/* Patient Details Roster Grid */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                <span className="text-slate-400 font-bold uppercase tracking-wider block text-[10px]">Patient Name</span>
                <span className="font-extrabold text-slate-900 text-sm mt-0.5 block">
                  {inspectingPatientToken.patientName || 'Walk-in (Unassigned)'}
                </span>
              </div>

              <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                <span className="text-slate-400 font-bold uppercase tracking-wider block text-[10px]">Phone Number</span>
                <span className="font-extrabold text-slate-900 text-sm mt-0.5 block flex items-center space-x-1">
                  {inspectingPatientToken.patientPhone ? (
                    <>
                      <Phone className="w-3.5 h-3.5 text-emerald-600" />
                      <span>+91 {inspectingPatientToken.patientPhone}</span>
                    </>
                  ) : (
                    <span className="text-slate-400 font-normal">Not Provided</span>
                  )}
                </span>
              </div>

              <div className="col-span-2 bg-emerald-50/70 p-3.5 rounded-2xl border border-emerald-200">
                <span className="text-emerald-800 font-extrabold uppercase tracking-wider block text-[10px] flex items-center space-x-1">
                  <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Patient Location / City / Village</span>
                </span>
                <span className="font-black text-emerald-950 text-sm mt-1 block">
                  {inspectingPatientToken.patientLocation || 'Hospital Physical Walk-In (Local Area)'}
                </span>
              </div>

              <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                <span className="text-slate-400 font-bold uppercase tracking-wider block text-[10px]">Doctor & Room</span>
                <span className="font-extrabold text-slate-900 text-xs mt-0.5 block">
                  {inspectingPatientToken.doctorName}
                </span>
                <span className="text-[11px] text-emerald-700 font-bold block">
                  Room: {inspectingPatientToken.doctorRoomNumber}
                </span>
              </div>

              <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                <span className="text-slate-400 font-bold uppercase tracking-wider block text-[10px]">Specialty</span>
                <span className="font-bold text-slate-800 text-xs mt-0.5 block">
                  {inspectingPatientToken.doctorSpecialty}
                </span>
                <span className="text-[11px] text-slate-500 block truncate">
                  {inspectingPatientToken.sessionName}
                </span>
              </div>

              <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                <span className="text-slate-400 font-bold uppercase tracking-wider block text-[10px]">Age & Gender</span>
                <span className="font-bold text-slate-800 text-xs mt-0.5 block">
                  {inspectingPatientToken.patientAge ? `${inspectingPatientToken.patientAge} Years` : '—'} • {inspectingPatientToken.patientGender || '—'}
                </span>
              </div>

              <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                <span className="text-slate-400 font-bold uppercase tracking-wider block text-[10px]">Reason for Visit</span>
                <span className="font-bold text-slate-800 text-xs mt-0.5 block truncate">
                  {inspectingPatientToken.reasonForVisit || 'General OPD Consultation'}
                </span>
              </div>

              <div className="col-span-2 bg-slate-50 p-3 rounded-2xl border border-slate-100 flex items-center justify-between">
                <div>
                  <span className="text-slate-400 font-bold uppercase tracking-wider block text-[10px]">Booking Reference</span>
                  <span className="font-mono font-bold text-slate-700 text-xs mt-0.5 block">
                    {inspectingPatientToken.bookingReference}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-slate-400 font-bold uppercase tracking-wider block text-[10px]">Time Created</span>
                  <span className="font-bold text-slate-700 text-xs mt-0.5 block">
                    {inspectingPatientToken.createdAt ? new Date(inspectingPatientToken.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Today'}
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Actions from Modal */}
            <div className="pt-2 flex flex-wrap items-center gap-2">

              {inspectingPatientToken.status === 'WAITING' && (
                <button
                  onClick={() => {
                    handleCallToken(inspectingPatientToken.tokenNumber, inspectingPatientToken.doctorName, inspectingPatientToken.doctorRoomNumber);
                    setInspectingPatientToken(prev => prev ? { ...prev, status: 'CALLED' } : null);
                  }}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 px-3 rounded-xl transition text-xs flex items-center justify-center space-x-1 cursor-pointer"
                >
                  <Play className="w-3.5 h-3.5" />
                  <span>Call Patient</span>
                </button>
              )}

              {inspectingPatientToken.status === 'CALLED' && (
                <button
                  onClick={() => {
                    handleUpdateStatus(inspectingPatientToken.id, 'IN_CONSULTATION');
                    setInspectingPatientToken(prev => prev ? { ...prev, status: 'IN_CONSULTATION' } : null);
                  }}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 px-3 rounded-xl transition text-xs flex items-center justify-center space-x-1 cursor-pointer"
                >
                  <span>Mark In Room</span>
                </button>
              )}

              {inspectingPatientToken.status === 'IN_CONSULTATION' && (
                <button
                  onClick={() => {
                    handleUpdateStatus(inspectingPatientToken.id, 'COMPLETED');
                    setInspectingPatientToken(prev => prev ? { ...prev, status: 'COMPLETED' } : null);
                  }}
                  className="flex-1 bg-emerald-700 hover:bg-emerald-800 text-white font-bold py-2.5 px-3 rounded-xl transition text-xs flex items-center justify-center space-x-1 cursor-pointer"
                >
                  <CheckCircle className="w-3.5 h-3.5" />
                  <span>Complete</span>
                </button>
              )}

              <button
                onClick={() => setInspectingPatientToken(null)}
                className="bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold py-2.5 px-4 rounded-xl transition text-xs cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL: STORAGE CLEANUP (PURGE 7-DAY OLD DATA)                 */}
      {/* ------------------------------------------------------------- */}
      {showCleanupModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-5 animate-in fade-in zoom-in-95">
            <div className="flex items-start justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-11 h-11 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center flex-shrink-0">
                  <Trash2 className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-lg">Clear 7-Day Storage</h3>
                  <p className="text-xs text-slate-500">Tenant: <span className="font-bold text-slate-700">{currentUser.hospitalName}</span></p>
                </div>
              </div>
              <button
                onClick={() => setShowCleanupModal(false)}
                className="text-slate-400 hover:text-slate-600 font-bold text-xl cursor-pointer"
              >
                &times;
              </button>
            </div>

            {cleanupResult ? (
              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 space-y-2">
                <div className="flex items-center space-x-2 text-emerald-800 font-extrabold text-sm">
                  <CheckCircle className="w-5 h-5 text-emerald-600" />
                  <span>Storage Successfully Cleared!</span>
                </div>
                <p className="text-xs text-emerald-700">
                  Purged historical queues and records older than 7 days (prior to <strong>{cleanupResult.cutoffDate}</strong>).
                </p>
                <div className="grid grid-cols-2 gap-2 pt-2 text-xs">
                  <div className="bg-white p-2.5 rounded-xl border border-emerald-100">
                    <span className="text-slate-500 text-[10px] uppercase font-bold block">Deleted Sessions</span>
                    <span className="text-base font-black text-slate-900">{cleanupResult.deletedSessions}</span>
                  </div>
                  <div className="bg-white p-2.5 rounded-xl border border-emerald-100">
                    <span className="text-slate-500 text-[10px] uppercase font-bold block">Deleted Tokens</span>
                    <span className="text-base font-black text-slate-900">{cleanupResult.deletedTokens}</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start space-x-3 text-amber-900 text-xs">
                  <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-bold">Permanent Historical Purge Confirmation</p>
                    <p className="text-amber-800 leading-relaxed">
                      Are you sure you want to permanently delete patient queue history and completed OPD records older than <strong>7 days</strong>?
                    </p>
                  </div>
                </div>

                <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 space-y-2 text-xs text-slate-600">
                  <div className="flex items-center space-x-2">
                    <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                    <span><strong>Safe:</strong> Active queues, today's patient tokens, and doctor profiles are NOT touched.</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                    <span><strong>Tenant Isolated:</strong> Only purges records belonging to {currentUser.hospitalName}.</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                    <span><strong>Performance:</strong> Clears database storage and keeps reports fast and snappy.</span>
                  </div>
                </div>
              </div>
            )}

            <div className="pt-2 flex items-center justify-end space-x-2">
              <button
                type="button"
                onClick={() => setShowCleanupModal(false)}
                className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              >
                {cleanupResult ? 'Close' : 'Cancel'}
              </button>

              {!cleanupResult && (
                <button
                  type="button"
                  onClick={handleCleanupStorage}
                  disabled={cleaningStorage}
                  className="bg-red-600 hover:bg-red-700 text-white font-extrabold px-5 py-2.5 rounded-xl text-xs shadow-md transition cursor-pointer flex items-center space-x-1.5 disabled:opacity-50"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>{cleaningStorage ? 'Purging Storage...' : 'Confirm & Clear 7-Day Storage'}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
