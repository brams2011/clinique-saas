import { INSFORGE_URL, FUNCTIONS_URL } from "./constants";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface User {
  id: string;
  email: string;
}

export interface Conversation {
  id: string;
  user_id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  user_id: string;
  role: "user" | "assistant";
  content: string;
  image_key: string | null;
  created_at: string;
}

// ─── Token storage ────────────────────────────────────────────────────────────

const LS_TOKEN = "cinique_token";
const LS_REFRESH = "cinique_refresh_token";

export function getStoredToken(): string | null { return localStorage.getItem(LS_TOKEN); }
export function getStoredRefreshToken(): string | null { return localStorage.getItem(LS_REFRESH); }
export function setStoredTokens(token: string, refreshToken: string) {
  localStorage.setItem(LS_TOKEN, token);
  localStorage.setItem(LS_REFRESH, refreshToken);
}
export function clearStoredTokens() {
  localStorage.removeItem(LS_TOKEN);
  localStorage.removeItem(LS_REFRESH);
}

// ─── Patient portal token storage ────────────────────────────────────────────

const LS_PATIENT_TOKEN = "cinique_patient_token";

export function getStoredPatientToken(): string | null {
  return localStorage.getItem(LS_PATIENT_TOKEN);
}
export function setStoredPatientToken(token: string) {
  localStorage.setItem(LS_PATIENT_TOKEN, token);
}
export function clearStoredPatientToken() {
  localStorage.removeItem(LS_PATIENT_TOKEN);
}

// ─── Safe JSON parse (handles empty / 204 responses) ─────────────────────────

async function safeJson<T>(res: Response): Promise<T> {
  const text = await res.text();
  if (!text) return {} as T;
  return JSON.parse(text) as T;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

export const AUTH_EXPIRED_EVENT = "cinique:auth_expired";
export const TOKEN_REFRESHED_EVENT = "cinique:token_refreshed";

let refreshing: Promise<string | null> | null = null;

async function tryRefresh(): Promise<string | null> {
  // Deduplicate concurrent refresh calls
  if (refreshing) return refreshing;
  refreshing = (async () => {
    const rt = getStoredRefreshToken();
    if (!rt) return null;
    try {
      const res = await fetch(`${INSFORGE_URL}/api/auth/refresh?client_type=mobile`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: rt }),
      });
      if (!res.ok) return null;
      const data = await res.json();
      const newToken: string = data.accessToken;
      const newRefresh: string = data.refreshToken ?? rt;
      setStoredTokens(newToken, newRefresh);
      window.dispatchEvent(new CustomEvent(TOKEN_REFRESHED_EVENT, { detail: { token: newToken } }));
      return newToken;
    } catch {
      return null;
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

async function apiFetch(url: string, options: RequestInit = {}): Promise<Response> {
  let res = await fetch(url, options);
  if (res.status === 401) {
    // Try silent refresh once
    const newToken = await tryRefresh();
    if (newToken) {
      // Retry with new token (replace Authorization header)
      const newHeaders = new Headers(options.headers);
      newHeaders.set("Authorization", `Bearer ${newToken}`);
      res = await fetch(url, { ...options, headers: newHeaders });
    }
    if (res.status === 401) {
      clearStoredTokens();
      window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT));
    }
  }
  return res;
}

async function apiJSON<T>(url: string, options: RequestInit = {}): Promise<T> {
  const res = await apiFetch(url, options);
  const data = await safeJson<{ message?: string; error?: string } & T>(res);
  if (!res.ok) throw new Error(data?.message ?? data?.error ?? `HTTP ${res.status}`);
  return data as T;
}

function authHeaders(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

export function decodeJwtSub(token: string): string | null {
  try {
    const pad = (s: string) => s + "=".repeat((4 - (s.length % 4)) % 4);
    const payload = JSON.parse(atob(pad(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))));
    return payload.sub ?? null;
  } catch {
    return null;
  }
}

export function decodeJwtPayload(token: string): Record<string, string | null> {
  try {
    const pad = (s: string) => s + "=".repeat((4 - (s.length % 4)) % 4);
    return JSON.parse(atob(pad(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))));
  } catch {
    return {};
  }
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

export async function apiRegister(
  email: string,
  password: string,
  clinic_name?: string,
  plan?: string
): Promise<{ token: string; refreshToken: string }> {
  const data = await apiJSON<{ accessToken: string; refreshToken: string }>(
    `${INSFORGE_URL}/api/auth/users?client_type=mobile`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, clinic_name: clinic_name ?? "Ma Clinique", plan: plan ?? "starter" }),
    }
  );
  return { token: data.accessToken, refreshToken: data.refreshToken };
}

export async function apiLogin(email: string, password: string): Promise<{ token: string; refreshToken: string }> {
  const data = await apiJSON<{ accessToken: string; refreshToken: string }>(
    `${INSFORGE_URL}/api/auth/sessions?client_type=mobile`,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) }
  );
  return { token: data.accessToken, refreshToken: data.refreshToken };
}

export async function apiGetCurrentUser(token: string): Promise<User> {
  const data = await apiJSON<{ user: { id: string; email: string } }>(
    `${INSFORGE_URL}/api/auth/sessions/current`,
    { headers: authHeaders(token) }
  );
  return { id: data.user.id, email: data.user.email };
}

export async function apiLogout(token: string): Promise<void> {
  await apiFetch(`${INSFORGE_URL}/api/auth/sessions/current`, {
    method: "DELETE",
    headers: authHeaders(token),
  });
}

// ─── Billing ──────────────────────────────────────────────────────────────────

export interface BillingStatus {
  plan: string;
  status: string;
  trial_ends_at: string | null;
  current_period_end: string | null;
  stripe_customer_id: string | null;
  square_customer_id: string | null;
  payment_provider: string | null;
}

export async function apiGetBillingStatus(token: string): Promise<BillingStatus> {
  return apiJSON<BillingStatus>(`${INSFORGE_URL}/api/billing/status`, { headers: authHeaders(token) });
}

export async function apiCreateCheckout(token: string, plan: string): Promise<{ url: string }> {
  return apiJSON<{ url: string }>(`${INSFORGE_URL}/api/billing/checkout`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({ plan }),
  });
}

export async function apiOpenPortal(token: string): Promise<{ url: string }> {
  return apiJSON<{ url: string }>(`${INSFORGE_URL}/api/billing/portal`, {
    method: "POST",
    headers: authHeaders(token),
  });
}

export async function apiCreateSquareCheckout(token: string, plan: string): Promise<{ url: string }> {
  return apiJSON<{ url: string }>(`${INSFORGE_URL}/api/billing/square/checkout`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({ plan }),
  });
}

export async function apiSquareCancel(token: string): Promise<{ cancelled: boolean }> {
  return apiJSON<{ cancelled: boolean }>(`${INSFORGE_URL}/api/billing/square/cancel`, {
    method: "POST",
    headers: authHeaders(token),
    body: "{}",
  });
}

// ─── Super-Admin ──────────────────────────────────────────────────────────────

export interface AdminStats {
  total_clinics: number;
  active_clinics: number;
  trial_clinics: number;
  churned_clinics: number;
  mrr: number;
}

export interface AdminClinic {
  id: string;
  name: string;
  slug: string;
  clinic_status: string;
  created_at: string;
  plan: string;
  status: string;
  payment_provider: string | null;
  trial_ends_at: string | null;
  current_period_end: string | null;
  stripe_customer_id: string | null;
  square_customer_id: string | null;
  owner_email: string | null;
}

export async function apiAdminStats(token: string): Promise<AdminStats> {
  return apiJSON<AdminStats>(`${INSFORGE_URL}/api/admin/stats`, { headers: authHeaders(token) });
}

export async function apiAdminClinics(token: string): Promise<AdminClinic[]> {
  return apiJSON<AdminClinic[]>(`${INSFORGE_URL}/api/admin/clinics`, { headers: authHeaders(token) });
}

export async function apiAdminUpdateSubscription(
  token: string,
  clinicId: string,
  data: { plan?: string; status?: string }
): Promise<void> {
  await apiJSON<{ ok: boolean }>(`${INSFORGE_URL}/api/admin/clinics/${clinicId}/subscription`, {
    method: "PATCH",
    headers: authHeaders(token),
    body: JSON.stringify(data),
  });
}

// ─── Conversations ─────────────────────────────────────────────────────────────

export async function apiListConversations(token: string): Promise<Conversation[]> {
  const res = await apiFetch(
    `${INSFORGE_URL}/api/database/records/chat_conversations?order=updated_at.desc`,
    { headers: authHeaders(token) }
  );
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return safeJson(res);
}

export async function apiCreateConversation(token: string, title: string): Promise<Conversation> {
  const res = await apiFetch(`${INSFORGE_URL}/api/database/records/chat_conversations`, {
    method: "POST",
    headers: { ...authHeaders(token), Prefer: "return=representation" },
    body: JSON.stringify({ title, user_id: decodeJwtSub(token) }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const rows = await safeJson<Conversation | Conversation[]>(res);
  return Array.isArray(rows) ? rows[0] : rows;
}

export async function apiDeleteConversation(token: string, id: string): Promise<void> {
  await apiFetch(`${INSFORGE_URL}/api/database/records/chat_conversations?id=eq.${id}`, {
    method: "DELETE",
    headers: authHeaders(token),
  });
}

// ─── Messages ─────────────────────────────────────────────────────────────────

export async function apiListMessages(token: string, conversationId: string): Promise<Message[]> {
  const res = await apiFetch(
    `${INSFORGE_URL}/api/database/records/chat_messages?conversation_id=eq.${conversationId}&order=created_at.asc`,
    { headers: authHeaders(token) }
  );
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return safeJson(res);
}

export async function apiClearMessages(token: string, conversationId: string): Promise<void> {
  await apiFetch(
    `${INSFORGE_URL}/api/database/records/chat_messages?conversation_id=eq.${conversationId}`,
    { method: "DELETE", headers: authHeaders(token) }
  );
}

// ─── Chat send ────────────────────────────────────────────────────────────────

export async function apiChatSend(
  token: string,
  conversationId: string,
  message: string,
  imageKey?: string
): Promise<{ user_message: Message; assistant_message: Message }> {
  return apiJSON(`${FUNCTIONS_URL}/chat_send`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({ conversation_id: conversationId, message, image_key: imageKey ?? null }),
  });
}

// ─── Storage ──────────────────────────────────────────────────────────────────

export async function apiUploadImage(
  token: string,
  file: File,
  userId: string,
  conversationId: string
): Promise<{ key: string }> {
  const ext = file.name.split(".").pop() ?? "jpg";
  const key = `${userId}/${conversationId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch(
    `${INSFORGE_URL}/api/storage/buckets/chat-images/objects/${key}`,
    { method: "PUT", headers: { Authorization: `Bearer ${token}` }, body: formData }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.message ?? `Upload failed: HTTP ${res.status}`);
  }
  return { key };
}

// ─── Facturation ──────────────────────────────────────────────────────────────

export interface InvoiceLigne {
  code: string;
  description: string;
  quantite: number;
  prix_unitaire: number;
  montant: number;
}

export interface Invoice {
  id: string;
  clinic_id: string;
  patient_id: string | null;
  appointment_id: string | null;
  numero: string;
  statut: "en_attente" | "payee" | "annulee";
  patient_nom: string | null;
  patient_ramq: string | null;
  patient_dossier: string | null;
  patient_telephone: string | null;
  patient_email: string | null;
  patient_adresse: string | null;
  medecin_nom: string | null;
  medecin_licence: string | null;
  medecin_specialite: string | null;
  date_visite: string | null;
  date_echeance: string | null;
  assureur: string | null;
  no_police: string | null;
  no_reclamation: string | null;
  lignes: InvoiceLigne[];
  sous_total: number;
  remises: number;
  ramq_couverture: number;
  assurance_couverture: number;
  tps: number;
  tvq: number;
  acompte: number;
  total: number;
  notes: string | null;
  diagnostic_cim10: string | null;
  created_at: string;
  updated_at: string;
}

export async function apiListInvoices(
  token: string,
  filters?: { statut?: string }
): Promise<Invoice[]> {
  let path = "clinic_invoices?order=created_at.desc";
  if (filters?.statut) path += `&statut=eq.${encodeURIComponent(filters.statut)}`;
  return clinicFetch<Invoice[]>(token, path);
}

export async function apiGetInvoice(token: string, id: string): Promise<Invoice> {
  const rows = await clinicFetch<Invoice[]>(token, `clinic_invoices?id=eq.${id}`);
  if (!rows[0]) throw new Error("Facture introuvable");
  return rows[0];
}

export async function apiCreateInvoice(token: string, data: Partial<Invoice>): Promise<Invoice> {
  return clinicPost<Invoice>(token, "clinic_invoices", data);
}

export async function apiUpdateInvoice(
  token: string,
  id: string,
  data: Partial<Invoice>
): Promise<Invoice> {
  return clinicPatch<Invoice>(token, `clinic_invoices?id=eq.${id}`, data);
}

export async function apiDeleteInvoice(token: string, id: string): Promise<void> {
  await apiFetch(`${INSFORGE_URL}/api/database/records/clinic_invoices?id=eq.${id}`, {
    method: "DELETE",
    headers: authHeaders(token),
  });
}

export async function apiGetNextInvoiceNumber(token: string): Promise<string> {
  const data = await apiJSON<{ numero: string }>(
    `${INSFORGE_URL}/api/facturation/next-number`,
    { headers: authHeaders(token) }
  );
  return data.numero;
}

export async function apiDownloadInvoiceDocx(token: string, id: string, numero: string): Promise<void> {
  const res = await apiFetch(`${INSFORGE_URL}/api/facturation/${id}/docx`, {
    method: "POST",
    headers: authHeaders(token),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? `HTTP ${res.status}`);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `facture-${numero}.docx`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function fetchImageAsBlob(token: string, key: string): Promise<string> {
  const res = await fetch(
    `${INSFORGE_URL}/api/storage/buckets/chat-images/objects/${key}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!res.ok) throw new Error(`Image fetch failed: HTTP ${res.status}`);
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

// ─── Clinic Types ─────────────────────────────────────────────────────────────

export interface ClinicStaff {
  id: string;
  user_id: string;
  role: "admin" | "practitioner" | "receptionist";
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  specialty: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Patient {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  date_of_birth: string | null;
  gender: "male" | "female" | "other" | null;
  address: string | null;
  city: string | null;
  postal_code: string | null;
  health_card_number: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  notes: string | null;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ClinicAppointment {
  id: string;
  patient_id: string;
  practitioner_id: string;
  start_time: string;
  end_time: string;
  type: string;
  status: "scheduled" | "confirmed" | "cancelled" | "completed" | "no_show";
  reason: string | null;
  notes: string | null;
  google_event_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  is_virtual: boolean;
  virtual_meeting_url: string | null;
}

// ─── Patient Portal types ─────────────────────────────────────────────────────

export interface PortalAppointment {
  id: string;
  start_time: string;
  end_time: string;
  type: string;
  status: string;
  reason: string | null;
  is_virtual: boolean;
  virtual_meeting_url: string | null;
}

export interface PortalDossier {
  id: string;
  type: string;
  title: string;
  content: string | null;
  created_at: string;
}

export interface PortalInvoice {
  id: string;
  numero: string;
  statut: string;
  date_visite: string | null;
  total: number;
  created_at: string;
}

export interface Dossier {
  id: string;
  patient_id: string;
  practitioner_id: string | null;
  appointment_id: string | null;
  type: "note" | "consultation" | "prescription" | "lab_result" | "imaging" | "referral" | "other";
  title: string;
  content: string | null;
  is_confidential: boolean;
  created_at: string;
  updated_at: string;
}

// ─── Clinic helpers ───────────────────────────────────────────────────────────

async function clinicFetch<T>(token: string, path: string, options: RequestInit = {}): Promise<T> {
  const url = `${INSFORGE_URL}/api/database/records/${path}`;
  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    ...((options.headers as Record<string, string>) ?? {}),
  };
  const res = await apiFetch(url, { ...options, headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.message ?? err?.details ?? `HTTP ${res.status}`);
  }
  return safeJson<T>(res);
}

async function clinicPatch<T>(token: string, path: string, data: Partial<T>): Promise<T> {
  const url = `${INSFORGE_URL}/api/database/records/${path}`;
  const res = await apiFetch(url, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.message ?? `HTTP ${res.status}`);
  }
  const rows = await safeJson<T | T[]>(res);
  return (Array.isArray(rows) ? rows[0] : rows) as T;
}

async function clinicPost<T>(token: string, table: string, data: Partial<T>): Promise<T> {
  const res = await apiFetch(`${INSFORGE_URL}/api/database/records/${table}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.message ?? err?.details ?? `HTTP ${res.status}`);
  }
  const rows = await safeJson<T | T[]>(res);
  return (Array.isArray(rows) ? rows[0] : rows) as T;
}

// ─── Clinic Staff API ─────────────────────────────────────────────────────────

export async function apiGetMyStaffProfile(token: string): Promise<ClinicStaff | null> {
  const sub = decodeJwtSub(token);
  if (!sub) return null;
  const rows = await clinicFetch<ClinicStaff[]>(token, `clinic_staff?user_id=eq.${sub}`);
  return rows[0] ?? null;
}

export async function apiListStaff(token: string): Promise<ClinicStaff[]> {
  return clinicFetch<ClinicStaff[]>(token, "clinic_staff?is_active=eq.true&order=last_name.asc");
}

export async function apiCreateStaff(token: string, data: Partial<ClinicStaff>): Promise<ClinicStaff> {
  return clinicPost<ClinicStaff>(token, "clinic_staff", data);
}

export async function apiInviteStaff(token: string, data: {
  email: string; password: string; first_name: string; last_name: string;
  role: string; phone?: string | null; specialty?: string | null;
}): Promise<ClinicStaff> {
  const res = await apiFetch(`${INSFORGE_URL}/api/staff/invite`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error ?? `HTTP ${res.status}`);
  }
  return res.json();
}

export async function apiUpdateStaff(token: string, id: string, data: Partial<ClinicStaff>): Promise<ClinicStaff> {
  return clinicPatch<ClinicStaff>(token, `clinic_staff?id=eq.${id}`, data);
}

// ─── Patients API ─────────────────────────────────────────────────────────────

export async function apiListPatients(token: string, search?: string): Promise<Patient[]> {
  let path = "clinic_patients?is_active=eq.true&order=last_name.asc";
  if (search) {
    path += `&or=(first_name.ilike.*${encodeURIComponent(search)}*,last_name.ilike.*${encodeURIComponent(search)}*,phone.ilike.*${encodeURIComponent(search)}*)`;
  }
  return clinicFetch<Patient[]>(token, path);
}

export async function apiGetPatient(token: string, id: string): Promise<Patient> {
  const rows = await clinicFetch<Patient[]>(token, `clinic_patients?id=eq.${id}`);
  if (!rows[0]) throw new Error("Patient introuvable");
  return rows[0];
}

export async function apiCreatePatient(token: string, data: Partial<Patient>): Promise<Patient> {
  return clinicPost<Patient>(token, "clinic_patients", data);
}

export async function apiUpdatePatient(token: string, id: string, data: Partial<Patient>): Promise<Patient> {
  return clinicPatch<Patient>(token, `clinic_patients?id=eq.${id}`, data);
}

// ─── Appointments API ─────────────────────────────────────────────────────────

export async function apiListAppointments(
  token: string,
  filters?: {
    status?: string;
    practitioner_id?: string;
    date_from?: string;
    date_to?: string;
    patient_id?: string;
  }
): Promise<ClinicAppointment[]> {
  let path = "clinic_appointments?order=start_time.asc";
  if (filters?.status) path += `&status=eq.${filters.status}`;
  if (filters?.practitioner_id) path += `&practitioner_id=eq.${filters.practitioner_id}`;
  if (filters?.patient_id) path += `&patient_id=eq.${filters.patient_id}`;
  if (filters?.date_from) path += `&start_time=gte.${filters.date_from}`;
  if (filters?.date_to) path += `&start_time=lte.${filters.date_to}`;
  return clinicFetch<ClinicAppointment[]>(token, path);
}

export async function apiGetAppointment(token: string, id: string): Promise<ClinicAppointment> {
  const rows = await clinicFetch<ClinicAppointment[]>(token, `clinic_appointments?id=eq.${id}`);
  if (!rows[0]) throw new Error("Rendez-vous introuvable");
  return rows[0];
}

export async function apiCreateAppointment(token: string, data: Partial<ClinicAppointment>): Promise<ClinicAppointment> {
  return clinicPost<ClinicAppointment>(token, "clinic_appointments", data);
}

export async function apiUpdateAppointment(
  token: string,
  id: string,
  data: Partial<ClinicAppointment>
): Promise<ClinicAppointment> {
  return clinicPatch<ClinicAppointment>(token, `clinic_appointments?id=eq.${id}`, data);
}

export async function apiSmsConfirm(
  token: string,
  data: { patient_name: string; patient_phone: string; start_time: string }
): Promise<{ sent: boolean }> {
  try {
    const res = await fetch(`${FUNCTIONS_URL}/sms_confirm`, {
      method: "POST",
      headers: authHeaders(token),
      body: JSON.stringify(data),
    });
    if (!res.ok) return { sent: false };
    return safeJson(res);
  } catch {
    return { sent: false };
  }
}

// ─── Dossiers API ─────────────────────────────────────────────────────────────

export async function apiListDossiers(token: string, patientId: string): Promise<Dossier[]> {
  return clinicFetch<Dossier[]>(token, `clinic_dossiers?patient_id=eq.${patientId}&order=created_at.desc`);
}

export async function apiCreateDossier(token: string, data: Partial<Dossier>): Promise<Dossier> {
  return clinicPost<Dossier>(token, "clinic_dossiers", data);
}

export async function apiUpdateDossier(token: string, id: string, data: Partial<Dossier>): Promise<Dossier> {
  return clinicPatch<Dossier>(token, `clinic_dossiers?id=eq.${id}`, data);
}

export async function apiDeleteDossier(token: string, id: string): Promise<void> {
  await apiFetch(`${INSFORGE_URL}/api/database/records/clinic_dossiers?id=eq.${id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
}

// ─── Clinic Settings API ──────────────────────────────────────────────────────

export interface ClinicSettings {
  id: string;
  clinic_name: string;
  clinic_type: string;
  responsible_name: string;
  responsible_title: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  postal_code: string;
  country: string;
  timezone: string;
  website: string;
  appointment_duration_mins: number;
  working_hours_start: string;
  working_hours_end: string;
  working_days: string;
  voice_agent_base_url: string;
  elevenlabs_agent_id: string;
  updated_at: string;
}

export async function apiGetClinicSettings(token: string): Promise<ClinicSettings | null> {
  const rows = await clinicFetch<ClinicSettings[]>(token, "clinic_settings?limit=1");
  return rows[0] ?? null;
}

export async function apiUpdateClinicSettings(
  token: string,
  id: string,
  data: Partial<ClinicSettings>
): Promise<ClinicSettings> {
  return clinicPatch<ClinicSettings>(token, `clinic_settings?id=eq.${id}`, {
    ...data,
    updated_at: new Date().toISOString(),
  });
}

// ─── Google Calendar sync ─────────────────────────────────────────────────────

export async function apiSyncClinicCalendar(
  token: string,
  data: {
    action: "create" | "update" | "delete";
    event_id?: string | null;
    summary?: string;
    description?: string;
    start_time?: string;
    end_time?: string;
    patient_email?: string | null;
  }
): Promise<{ event_id?: string; deleted?: boolean }> {
  // Use plain fetch (not apiFetch) so a calendar error never triggers logout
  try {
    const res = await fetch(`${FUNCTIONS_URL}/clinic_cal_sync`, {
      method: "POST",
      headers: authHeaders(token),
      body: JSON.stringify(data),
    });
    if (!res.ok) return {};
    return safeJson(res);
  } catch {
    return {};
  }
}

// ─── Patient Portal API ───────────────────────────────────────────────────────

export async function apiPortalRequestOtp(
  email: string,
  clinicId: string
): Promise<{ sent: boolean; dev_otp?: string }> {
  const res = await fetch(`${INSFORGE_URL}/api/portal/auth/request-otp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, clinic_id: clinicId }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || "Erreur serveur");
  }
  return res.json();
}

export async function apiPortalVerifyOtp(
  email: string,
  clinicId: string,
  otp: string
): Promise<{ token: string; patient_id: string }> {
  const res = await fetch(`${INSFORGE_URL}/api/portal/auth/verify-otp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, clinic_id: clinicId, otp }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || "Code invalide");
  }
  return res.json();
}

export async function apiPortalAppointments(token: string): Promise<PortalAppointment[]> {
  const res = await fetch(`${INSFORGE_URL}/api/portal/appointments`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Erreur chargement rendez-vous");
  return res.json();
}

export async function apiPortalDossiers(token: string): Promise<PortalDossier[]> {
  const res = await fetch(`${INSFORGE_URL}/api/portal/dossiers`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Erreur chargement dossiers");
  return res.json();
}

export async function apiPortalInvoices(token: string): Promise<PortalInvoice[]> {
  const res = await fetch(`${INSFORGE_URL}/api/portal/invoices`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Erreur chargement factures");
  return res.json();
}

export interface PortalProfile {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  date_of_birth: string | null;
  gender: string | null;
  address: string | null;
  city: string | null;
  postal_code: string | null;
}

export async function apiPortalGetProfile(token: string): Promise<PortalProfile> {
  const res = await fetch(`${INSFORGE_URL}/api/portal/profile`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Erreur chargement profil");
  return res.json();
}

export async function apiPortalUpdateProfile(
  token: string,
  data: { phone?: string; email?: string }
): Promise<PortalProfile> {
  const res = await fetch(`${INSFORGE_URL}/api/portal/profile`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || "Erreur mise à jour profil");
  }
  return res.json();
}

export async function apiSendPortalInvite(
  token: string,
  patientId: string
): Promise<{ sent: boolean; portal_url?: string; dev?: boolean }> {
  const res = await fetch(`${INSFORGE_URL}/api/portal/send-invite`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({ patient_id: patientId }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || "Erreur envoi invitation");
  }
  return res.json();
}

export async function apiSendAppointmentEmail(
  token: string,
  appointmentId: string
): Promise<{ sent: boolean; portal_url?: string; dev?: boolean }> {
  const res = await fetch(`${INSFORGE_URL}/api/portal/send-appointment-email`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({ appointment_id: appointmentId }),
  });
  if (!res.ok) return { sent: false };
  return res.json();
}
