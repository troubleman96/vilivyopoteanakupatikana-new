import type { LostFoundItem } from '@/lib/demo-data';

const API_BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL ?? '').replace(/\/+$/, '');

type ApiEnvelope<T> = { data: T };

export type LocalAuthUser = { id: string; email: string };
export type LocalAuthSession = { access_token: string; expires_at: string; user: LocalAuthUser };

type PublicApiItem = {
  id: string;
  institution_id: string;
  institution_name: string;
  category: string;
  title: string;
  description: string;
  location: string;
  occurred_on?: string;
  kind?: 'lost' | 'found';
  status: string;
};

export type PublicInstitution = {
  id: string;
  name: string;
  region: string;
};

export type CreateReportInput = {
  institution_id: string;
  kind: 'lost' | 'found';
  category: string;
  title: string;
  description: string;
  location: string;
  occurred_on?: string;
  contact_details?: string;
};

export type PrivateReport = {
  id: string;
  kind: 'lost' | 'found';
  status: string;
  review_status: string;
  created_at: string;
};

export type PrivateClaim = {
  id: string;
  item_id: string;
  status: string;
  created_at: string;
};

export type StaffCase = {
  id: string;
  item_id: string;
  status: string;
  kind: 'lost' | 'found';
  category: string;
  private_title: string;
  private_description: string;
  private_location: string;
  review_status: string;
  visibility: string;
  public_title: string;
  public_description: string;
  public_location: string;
};

export type StaffClaim = {
  id: string;
  item_id: string;
  claimant_id: string;
  statement: string;
  contact_details?: string | null;
  evidence_reference?: string | null;
  status: string;
  created_at: string;
};

export type MatchSuggestion = {
  candidate_id: string;
  title: string;
  category: string;
  rank: number;
  signal?: { name: string; version: string; score: number; interpretation: string };
  explanations: string[];
};

export type SearchRankingSource = 'embeddinggemma' | 'assistive_ai' | 'text_search';

export type PublicSearchResponse = {
  source: SearchRankingSource;
  items: PublicApiItem[];
  ranking?: string;
  notice?: string;
};

export type MatchSuggestionResponse = {
  source: SearchRankingSource;
  suggestions: MatchSuggestion[];
  decision: 'staff_review_required';
  ranking?: string;
  notice?: string;
};

export type InstitutionStats = { open_cases: number; open_claims: number };
export type PlatformStats = { institutions: number; public_items: number; open_cases: number };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function readData<T>(payload: unknown): T {
  if (!isRecord(payload) || !('data' in payload)) {
    throw new Error('The API returned an unexpected response.');
  }
  return (payload as ApiEnvelope<T>).data;
}

function getErrorMessage(payload: unknown): string {
  if (isRecord(payload) && isRecord(payload.error) && typeof payload.error.message === 'string') {
    return payload.error.message;
  }
  return 'The request could not be completed.';
}

async function requestData<T>(
  path: string,
  options: { token?: string; method?: 'GET' | 'POST' | 'PATCH'; body?: unknown } = {}
): Promise<T> {
  if (!API_BASE_URL)
    throw new Error(
      'The Go API is not configured. Start the local PostgreSQL-backed application stack.'
    );
  const headers = new Headers({ Accept: 'application/json' });
  if (options.body !== undefined) headers.set('Content-Type', 'application/json');
  if (options.token) headers.set('Authorization', `Bearer ${options.token}`);

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    cache: 'no-store'
  });
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) throw new Error(getErrorMessage(payload));
  return readData<T>(payload);
}

export function isApiConfigured(): boolean {
  return API_BASE_URL.length > 0;
}

export async function registerLocalAccount(
  email: string,
  password: string
): Promise<LocalAuthSession> {
  return requestData('/auth/register', { method: 'POST', body: { email, password } });
}

export async function signInLocalAccount(
  email: string,
  password: string
): Promise<LocalAuthSession> {
  return requestData('/auth/login', { method: 'POST', body: { email, password } });
}

export function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.sessionStorage.getItem('vp-access-token');
}

export function saveAccessToken(token: string): void {
  window.sessionStorage.setItem('vp-access-token', token);
}

export function clearAccessToken(): void {
  if (typeof window !== 'undefined') window.sessionStorage.removeItem('vp-access-token');
}

export async function fetchCurrentAccount(token: string): Promise<LocalAuthUser> {
  return requestData('/auth/me', { token });
}

export async function signOutLocalAccount(token: string): Promise<void> {
  try {
    await requestData('/auth/logout', { method: 'POST', token, body: {} });
  } finally {
    clearAccessToken();
  }
}

export async function fetchPublicItems(): Promise<PublicApiItem[]> {
  const data = await requestData<unknown>('/items');
  if (!Array.isArray(data)) throw new Error('The API returned an invalid listing collection.');
  return data.filter(isPublicApiItem);
}

function isPublicApiItem(item: unknown): item is PublicApiItem {
  return (
    isRecord(item) &&
    typeof item.id === 'string' &&
    typeof item.institution_id === 'string' &&
    typeof item.institution_name === 'string' &&
    typeof item.category === 'string' &&
    typeof item.title === 'string' &&
    typeof item.description === 'string' &&
    typeof item.location === 'string' &&
    typeof item.status === 'string'
  );
}

export async function searchPublicItems(
  filters: { query?: string; kind?: 'lost' | 'found'; category?: string } = {}
): Promise<PublicSearchResponse> {
  const params = new URLSearchParams();
  if (filters.query?.trim()) params.set('q', filters.query.trim());
  if (filters.kind) params.set('kind', filters.kind);
  if (filters.category) params.set('category', filters.category);
  const data = await requestData<unknown>(`/items/search?${params.toString()}`);
  if (
    !isRecord(data) ||
    !Array.isArray(data.items) ||
    !['embeddinggemma', 'assistive_ai', 'text_search'].includes(String(data.source))
  ) {
    throw new Error('The API returned an invalid search response.');
  }
  return {
    source: data.source as SearchRankingSource,
    items: data.items.filter(isPublicApiItem),
    ranking: typeof data.ranking === 'string' ? data.ranking : undefined,
    notice: typeof data.notice === 'string' ? data.notice : undefined
  };
}

export async function fetchPublicInstitutions(): Promise<PublicInstitution[]> {
  const data = await requestData<unknown>('/institutions');
  if (!Array.isArray(data)) throw new Error('The API returned an invalid institution collection.');
  return data.filter(
    (item): item is PublicInstitution =>
      isRecord(item) &&
      typeof item.id === 'string' &&
      typeof item.name === 'string' &&
      typeof item.region === 'string'
  );
}

export function toListingCard(item: PublicApiItem): LostFoundItem {
  const category = item.category
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
  const normalized = `${item.category} ${item.title}`.toLowerCase();
  const icon: LostFoundItem['icon'] = normalized.includes('key')
    ? 'keys'
    : normalized.includes('headphone')
      ? 'headphones'
      : normalized.includes('bag') || normalized.includes('sleeve')
        ? 'bag'
        : normalized.includes('laptop') || normalized.includes('electronic')
          ? 'laptop'
          : 'bottle';
  const tone: LostFoundItem['tone'] =
    icon === 'keys'
      ? 'sand'
      : icon === 'headphones'
        ? 'lavender'
        : icon === 'bag'
          ? 'peach'
          : icon === 'laptop'
            ? 'mint'
            : 'blue';
  const rawDate = item.occurred_on ?? '';
  const parsedDate = rawDate ? new Date(`${rawDate}T00:00:00Z`) : null;
  const date =
    parsedDate && !Number.isNaN(parsedDate.valueOf())
      ? new Intl.DateTimeFormat('en-GB', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
          timeZone: 'UTC'
        }).format(parsedDate)
      : 'Date not shared';

  return {
    id: item.id,
    title: item.title,
    category,
    kind: (item.kind ?? item.status) === 'lost' ? 'Missing' : 'Found',
    place: `${item.location || 'Area not shared'} · ${item.institution_name}`,
    date,
    status: 'Reviewed',
    description: item.description,
    icon,
    tone
  };
}

export async function submitReport(
  token: string,
  input: CreateReportInput
): Promise<{ id: string; status: string }> {
  return requestData('/reports', { method: 'POST', token, body: input });
}

export async function submitPrivateClaim(
  token: string,
  itemId: string,
  statement: string
): Promise<{ id: string; status: string }> {
  return requestData('/me/claims', { method: 'POST', token, body: { item_id: itemId, statement } });
}

export async function fetchMyReports(token: string): Promise<PrivateReport[]> {
  return requestData('/me/reports', { token });
}

export async function fetchMyClaims(token: string): Promise<PrivateClaim[]> {
  return requestData('/me/claims', { token });
}

export async function fetchStaffCases(token: string, institutionId: string): Promise<StaffCase[]> {
  return requestData(`/staff/institutions/${encodeURIComponent(institutionId)}/cases`, { token });
}

export async function fetchStaffClaims(
  token: string,
  institutionId: string
): Promise<StaffClaim[]> {
  return requestData(`/staff/institutions/${encodeURIComponent(institutionId)}/claims`, { token });
}

export async function updateStaffCase(
  token: string,
  institutionId: string,
  caseId: string,
  status: string
): Promise<{ status: string }> {
  return requestData(
    `/staff/institutions/${encodeURIComponent(institutionId)}/cases/${encodeURIComponent(caseId)}`,
    { method: 'PATCH', token, body: { status } }
  );
}

export async function reviewStaffClaim(
  token: string,
  institutionId: string,
  claimId: string,
  status: string,
  staffNote: string
): Promise<{ status: string }> {
  return requestData(
    `/staff/institutions/${encodeURIComponent(institutionId)}/claims/${encodeURIComponent(claimId)}/review`,
    { method: 'POST', token, body: { status, staff_note: staffNote } }
  );
}

export async function reviewStaffItem(
  token: string,
  institutionId: string,
  itemId: string,
  input: {
    status: 'approved' | 'rejected';
    public_title?: string;
    public_description?: string;
    public_location?: string;
  }
): Promise<{ review_status: string; visibility: string }> {
  return requestData(
    `/staff/institutions/${encodeURIComponent(institutionId)}/items/${encodeURIComponent(itemId)}/review`,
    { method: 'POST', token, body: input }
  );
}

export async function suggestStaffMatches(
  token: string,
  institutionId: string,
  itemId: string
): Promise<MatchSuggestionResponse> {
  const data = await requestData<unknown>(
    `/staff/institutions/${encodeURIComponent(institutionId)}/matches/suggest`,
    { method: 'POST', token, body: { item_id: itemId } }
  );
  if (!isRecord(data) || !Array.isArray(data.suggestions)) {
    throw new Error('The API returned an invalid match suggestion response.');
  }
  return data as unknown as MatchSuggestionResponse;
}

export async function fetchInstitutionStats(
  token: string,
  institutionId: string
): Promise<InstitutionStats> {
  return requestData(`/institutions/${encodeURIComponent(institutionId)}/stats`, { token });
}

export async function fetchPlatformStats(token: string): Promise<PlatformStats> {
  return requestData('/platform/stats', { token });
}
