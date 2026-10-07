import {
  ApiResponse,
  Doctor,
  HospitalProfile,
  HospitalAdminSummary,
  HospitalRegistrationPayload,
  LoginResponse,
  OpdSession,
  QueueBoard,
  TokenResponse,
  TokenStatus,
} from '../types';

const API_BASE = '/api/v1';

const STORAGE_KEYS = {
  ACCESS_TOKEN: 'opd_access_token',
  REFRESH_TOKEN: 'opd_refresh_token',
  USER: 'opd_user',
};

async function fetchWithAuth(url: string, options: RequestInit = {}): Promise<Response> {
  const headers = new Headers(options.headers || {});
  headers.set('Accept', 'application/json');

  const token = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN) || localStorage.getItem('citycare_access_token');
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  let res = await fetch(url, { ...options, headers });

  // If 401 Unauthorized, automatically attempt to refresh token
  if (res.status === 401) {
    const refreshToken = localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN) || localStorage.getItem('citycare_refresh_token');
    if (refreshToken) {
      try {
        const refreshRes = await fetch(`${API_BASE}/auth/refresh`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          body: JSON.stringify({ refreshToken }),
        });
        if (refreshRes.ok) {
          const refreshJson: ApiResponse<{ accessToken: string; refreshToken: string }> = await refreshRes.json();
          if (refreshJson.success && refreshJson.data?.accessToken) {
            localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, refreshJson.data.accessToken);
            if (refreshJson.data.refreshToken) {
              localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, refreshJson.data.refreshToken);
            }
            // Retry the original request with new access token
            headers.set('Authorization', `Bearer ${refreshJson.data.accessToken}`);
            res = await fetch(url, { ...options, headers });
          }
        } else {
          api.logout();
        }
      } catch (e) {
        console.error('Refresh token failed:', e);
        api.logout();
      }
    }
  }

  return res;
}

async function parseJsonResponse<T>(res: Response, fallbackError: string): Promise<T> {
  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    const text = await res.text();
    console.error('Non-JSON response received:', text);
    throw new Error(res.status === 401 ? 'Session expired. Please log in again.' : fallbackError);
  }
  const json: ApiResponse<T> = await res.json();
  if (!json.success) {
    throw new Error(json.message || fallbackError);
  }
  return json.data;
}

export const api = {
  // Public Patient API
  async resolveHospitalBySlug(slug: string): Promise<HospitalProfile> {
    const res = await fetch(`${API_BASE}/patient/hospitals/by-slug/${encodeURIComponent(slug)}`, {
      headers: { Accept: 'application/json' },
    });
    return parseJsonResponse<HospitalProfile>(res, 'Hospital not found');
  },

  async resolveHospitalByCode(code: string): Promise<HospitalProfile> {
    const res = await fetch(`${API_BASE}/patient/hospitals/by-code/${encodeURIComponent(code)}`, {
      headers: { Accept: 'application/json' },
    });
    return parseJsonResponse<HospitalProfile>(res, 'Invalid Hospital Access Code');
  },

  async getPatientDoctors(hospitalId: string): Promise<Doctor[]> {
    const res = await fetch(`${API_BASE}/patient/hospitals/${hospitalId}/doctors`, {
      headers: { Accept: 'application/json' },
    });
    return parseJsonResponse<Doctor[]>(res, 'Failed to load doctors');
  },

  async getPatientTodaySessions(hospitalId: string): Promise<OpdSession[]> {
    const res = await fetch(`${API_BASE}/patient/hospitals/${hospitalId}/sessions/today`, {
      headers: { Accept: 'application/json' },
    });
    return parseJsonResponse<OpdSession[]>(res, 'Failed to load today sessions');
  },

  async bookToken(payload: {
    hospitalId: string;
    opdSessionId: string;
    patientName: string;
    patientPhone: string;
    patientLocation?: string;
    patientAge: number;
    patientGender: string;
    reasonForVisit?: string;
    idempotencyKey?: string;
  }): Promise<TokenResponse> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
    if (payload.idempotencyKey) {
      headers['Idempotency-Key'] = payload.idempotencyKey;
    }
    const res = await fetch(`${API_BASE}/patient/tokens`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });
    return parseJsonResponse<TokenResponse>(res, 'Failed to generate token');
  },

  async getTokenByReference(bookingReference: string): Promise<TokenResponse> {
    const res = await fetch(`${API_BASE}/patient/tokens/${bookingReference}`, {
      headers: { Accept: 'application/json' },
    });
    return parseJsonResponse<TokenResponse>(res, 'Token not found');
  },

  async retryTokenSms(bookingReference: string): Promise<TokenResponse> {
    const res = await fetch(`${API_BASE}/patient/tokens/${encodeURIComponent(bookingReference)}/retry-sms`, {
      method: 'POST',
      headers: { Accept: 'application/json' },
    });
    return parseJsonResponse<TokenResponse>(res, 'Failed to retry SMS delivery');
  },

  async getTokensByPhone(hospitalSlug: string, phone: string): Promise<TokenResponse[]> {
    const res = await fetch(
      `${API_BASE}/patient/hospitals/${encodeURIComponent(hospitalSlug)}/tokens/by-phone?phone=${encodeURIComponent(phone)}`,
      { headers: { Accept: 'application/json' } }
    );
    return parseJsonResponse<TokenResponse[]>(res, 'No active tokens found for this phone number today');
  },

  async getDoctorLiveQueuePublic(hospitalSlug: string, doctorName: string): Promise<QueueBoard> {
    const res = await fetch(
      `${API_BASE}/patient/hospitals/${encodeURIComponent(hospitalSlug)}/doctors/by-name/live-queue?name=${encodeURIComponent(doctorName)}`,
      { headers: { Accept: 'application/json' } }
    );
    return parseJsonResponse<QueueBoard>(res, 'Failed to load doctor live queue');
  },

  // Staff Authentication
  async login(email: string, password: string): Promise<LoginResponse> {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });
    const data = await parseJsonResponse<LoginResponse>(res, 'Login failed');
    localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, data.accessToken);
    localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, data.refreshToken);
    localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(data));
    if (data.hospitalId) {
      localStorage.setItem(`opd_access_token_${data.hospitalId}`, data.accessToken);
      localStorage.setItem(`opd_refresh_token_${data.hospitalId}`, data.refreshToken);
    }
    // Clean legacy storage keys
    localStorage.removeItem('citycare_access_token');
    localStorage.removeItem('citycare_refresh_token');
    localStorage.removeItem('citycare_user');
    return data;
  },

  logout() {
    const user = this.getCurrentUser();
    if (user?.hospitalId) {
      localStorage.removeItem(`opd_access_token_${user.hospitalId}`);
      localStorage.removeItem(`opd_refresh_token_${user.hospitalId}`);
    }
    localStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
    localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
    localStorage.removeItem(STORAGE_KEYS.USER);
    localStorage.removeItem('citycare_access_token');
    localStorage.removeItem('citycare_refresh_token');
    localStorage.removeItem('citycare_user');
  },

  getCurrentUser(): LoginResponse | null {
    const userStr = localStorage.getItem(STORAGE_KEYS.USER) || localStorage.getItem('citycare_user');
    return userStr ? JSON.parse(userStr) : null;
  },

  getAccessToken(hospitalId?: string): string | null {
    if (hospitalId) {
      const scoped = localStorage.getItem(`opd_access_token_${hospitalId}`);
      if (scoped) return scoped;
    }
    return localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN) || localStorage.getItem('citycare_access_token');
  },

  // Doctor Roster Management (Add, Edit, View)
  async getDoctors(hospitalId: string, activeOnly: boolean = false): Promise<Doctor[]> {
    const res = await fetchWithAuth(`${API_BASE}/hospitals/${hospitalId}/doctors?activeOnly=${activeOnly}`);
    return parseJsonResponse<Doctor[]>(res, 'Failed to load doctors');
  },

  async createDoctor(hospitalId: string, doctorData: {
    name: string;
    specialty: string;
    roomNumber: string;
    photoUrl?: string;
    qualification?: string;
    avgConsultationMinutes?: number;
  }): Promise<Doctor> {
    const res = await fetchWithAuth(`${API_BASE}/hospitals/${hospitalId}/doctors`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(doctorData),
    });
    return parseJsonResponse<Doctor>(res, 'Failed to create doctor profile');
  },

  async updateDoctor(hospitalId: string, doctorId: string, doctorData: {
    name: string;
    specialty: string;
    roomNumber: string;
    photoUrl?: string;
    qualification?: string;
    active: boolean;
    avgConsultationMinutes?: number;
  }): Promise<Doctor> {
    const res = await fetchWithAuth(`${API_BASE}/hospitals/${hospitalId}/doctors/${doctorId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(doctorData),
    });
    return parseJsonResponse<Doctor>(res, 'Failed to update doctor profile');
  },

  async getDoctorLiveQueue(hospitalId: string, doctorId: string): Promise<QueueBoard> {
    const res = await fetchWithAuth(`${API_BASE}/hospitals/${hospitalId}/doctors/${doctorId}/live-queue`);
    return parseJsonResponse<QueueBoard>(res, 'Failed to load doctor room queue');
  },

  async getDoctorLiveQueueByName(hospitalId: string, doctorName: string): Promise<QueueBoard> {
    const res = await fetchWithAuth(
      `${API_BASE}/hospitals/${hospitalId}/doctors/by-name/live-queue?name=${encodeURIComponent(doctorName)}`
    );
    return parseJsonResponse<QueueBoard>(res, 'Failed to load doctor live queue');
  },

  // Hospital Dashboard & Queues
  async getTodaySessions(hospitalId: string): Promise<OpdSession[]> {
    const res = await fetchWithAuth(`${API_BASE}/hospitals/${hospitalId}/sessions/today`);
    return parseJsonResponse<OpdSession[]>(res, 'Failed to load sessions');
  },

  async getSessionsByDate(hospitalId: string, date: string): Promise<OpdSession[]> {
    const res = await fetchWithAuth(`${API_BASE}/hospitals/${hospitalId}/sessions?date=${encodeURIComponent(date)}`);
    return parseJsonResponse<OpdSession[]>(res, 'Failed to load sessions for selected date');
  },

  async cleanupOldData(hospitalId: string, days: number = 7): Promise<{ deletedSessions: number; deletedTokens: number; daysPurged: number; cutoffDate: string }> {
    const res = await fetchWithAuth(`${API_BASE}/hospitals/${hospitalId}/storage/cleanup?days=${days}`, {
      method: 'POST',
    });
    return parseJsonResponse<{ deletedSessions: number; deletedTokens: number; daysPurged: number; cutoffDate: string }>(res, 'Failed to clean old storage data');
  },

  async getQueueBoard(hospitalId: string, sessionId: string): Promise<QueueBoard> {
    const res = await fetchWithAuth(`${API_BASE}/hospitals/${hospitalId}/sessions/${sessionId}/board`);
    return parseJsonResponse<QueueBoard>(res, 'Failed to load queue board');
  },

  async addWalkIns(hospitalId: string, sessionId: string, count: number, note?: string): Promise<TokenResponse[]> {
    const res = await fetchWithAuth(`${API_BASE}/hospitals/${hospitalId}/sessions/${sessionId}/walk-ins`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ count, note }),
    });
    return parseJsonResponse<TokenResponse[]>(res, 'Failed to add walk-in patients');
  },

  async callToken(hospitalId: string, sessionId: string, tokenNumber: number): Promise<TokenResponse> {
    const res = await fetchWithAuth(`${API_BASE}/hospitals/${hospitalId}/sessions/${sessionId}/call/${tokenNumber}`, {
      method: 'POST',
    });
    return parseJsonResponse<TokenResponse>(res, 'Failed to call token');
  },

  async updateTokenStatus(
    hospitalId: string,
    tokenId: string,
    status: TokenStatus,
    reason?: string
  ): Promise<TokenResponse> {
    const res = await fetchWithAuth(`${API_BASE}/hospitals/${hospitalId}/tokens/${tokenId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, reason }),
    });
    return parseJsonResponse<TokenResponse>(res, 'Failed to update token status');
  },

  async searchPatients(
    hospitalId: string,
    query: string,
    sessionId?: string
  ): Promise<TokenResponse[]> {
    const url = new URL(`${window.location.origin}${API_BASE}/hospitals/${hospitalId}/patients/search`);
    url.searchParams.set('query', query);
    if (sessionId) url.searchParams.set('sessionId', sessionId);
    url.searchParams.set('size', '50');

    const res = await fetchWithAuth(url.toString());
    const data = await parseJsonResponse<any>(res, 'Failed to search patients');
    if (Array.isArray(data)) return data;
    if (data && Array.isArray(data.content)) return data.content;
    return [];
  },

  // Platform Super Admin & Hospital Registration
  async registerHospital(payload: HospitalRegistrationPayload): Promise<LoginResponse> {
    const res = await fetch(`${API_BASE}/auth/register-hospital`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(payload),
    });
    return parseJsonResponse<LoginResponse>(res, 'Failed to register hospital');
  },

  async getAdminHospitals(): Promise<HospitalAdminSummary[]> {
    const res = await fetchWithAuth(`${API_BASE}/admin/hospitals`);
    return parseJsonResponse<HospitalAdminSummary[]>(res, 'Failed to load hospitals for Admin');
  },

  async updateHospitalByAdmin(
    hospitalId: string,
    data: { name: string; address?: string; phone?: string; accessCode?: string; status?: string }
  ): Promise<HospitalAdminSummary> {
    const res = await fetchWithAuth(`${API_BASE}/admin/hospitals/${hospitalId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return parseJsonResponse<HospitalAdminSummary>(res, 'Failed to update hospital details');
  },

  async deleteHospitalByAdmin(hospitalId: string): Promise<void> {
    const res = await fetchWithAuth(`${API_BASE}/admin/hospitals/${hospitalId}`, {
      method: 'DELETE',
    });
    await parseJsonResponse<any>(res, 'Failed to remove hospital');
  },

  async getAllHospitals(): Promise<HospitalProfile[]> {
    const res = await fetch(`${API_BASE}/patient/hospitals/all`, {
      headers: { Accept: 'application/json' },
    });
    return parseJsonResponse<HospitalProfile[]>(res, 'Failed to load hospitals directory');
  },
};
