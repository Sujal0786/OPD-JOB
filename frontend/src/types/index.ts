export type Role = 'SUPER_ADMIN' | 'HOSPITAL_ADMIN' | 'RECEPTIONIST' | 'NURSE' | 'DOCTOR';
export type TokenType = 'ONLINE' | 'WALK_IN';
export type TokenStatus =
  | 'CREATED'
  | 'WAITING'
  | 'RECEIVED_BY_HOSPITAL'
  | 'CALLED'
  | 'IN_CONSULTATION'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'SKIPPED'
  | 'NO_SHOW';

export type OpdSessionStatus = 'SCHEDULED' | 'OPEN' | 'PAUSED' | 'CLOSED' | 'CANCELLED';

export interface ApiResponse<T> {
  success: boolean;
  code: string;
  message: string;
  data: T;
  timestamp: string;
  traceId: string;
}

export interface HospitalProfile {
  id: string;
  slug: string;
  accessCode: string;
  name: string;
  address?: string;
  phone?: string;
  logoUrl?: string;
  status: string;
  createdAt: string;
}

export interface Doctor {
  id: string;
  hospitalId: string;
  name: string;
  photoUrl?: string;
  specialty: string;
  qualification?: string;
  roomNumber: string;
  active: boolean;
  avgConsultationMinutes: number;
}

export interface OpdSession {
  id: string;
  hospitalId: string;
  doctorId: string;
  doctorName: string;
  doctorSpecialty: string;
  doctorRoomNumber: string;
  doctorPhotoUrl?: string;
  sessionDate: string;
  sessionName: string;
  startTime?: string;
  endTime?: string;
  status: OpdSessionStatus;
  currentServingToken?: number | null;
  nextTokenSequence: number;
  waitingCount: number;
  completedCount: number;
  totalOnlineCount: number;
  totalWalkinCount: number;
}

export interface TokenResponse {
  id: string;
  hospitalId: string;
  hospitalName: string;
  sessionId: string;
  sessionName: string;
  doctorId: string;
  doctorName: string;
  doctorSpecialty: string;
  doctorRoomNumber: string;
  tokenNumber: number;
  tokenType: TokenType;
  bookingReference: string;
  status: TokenStatus;
  patientName?: string;
  patientPhone?: string;
  patientLocation?: string;
  patientAge?: number;
  patientGender?: string;
  reasonForVisit?: string;
  currentServingToken?: number | null;
  tokensAhead: number;
  estimatedWaitMinutes: number;
  createdAt: string;
  smsSent?: boolean;
  smsMessage?: string;
  smsError?: string;
}

export interface QueueBoard {
  sessionId: string;
  sessionName: string;
  doctorId: string;
  doctorName: string;
  doctorRoomNumber: string;
  currentServingToken?: number | null;
  nextTokenSequence: number;
  totalOnlineCount: number;
  totalWalkinCount: number;
  waitingCount: number;
  completedCount: number;
  activeTokens: TokenResponse[];
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  userId: string;
  email: string;
  fullName: string;
  role: Role;
  hospitalId: string;
  hospitalName: string;
  hospitalSlug: string;
  hospitalAccessCode?: string;
}

export interface HospitalAdminSummary {
  id: string;
  name: string;
  slug: string;
  accessCode: string;
  address?: string;
  phone?: string;
  status: string;
  adminEmail: string;
  adminName: string;
  doctorCount: number;
  activeSessionCount: number;
  createdAt: string;
}

export interface HospitalRegistrationPayload {
  hospitalName: string;
  slug: string;
  address?: string;
  phone?: string;
  adminFullName: string;
  adminEmail: string;
  adminPassword: string;
}
