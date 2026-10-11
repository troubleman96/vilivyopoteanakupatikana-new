const base = (process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8080/api/v1').replace(
  /\/+$/,
  ''
);
export type Stats = { institutions: number; public_items: number; open_cases: number };
export type Institution = {
  id: string;
  name: string;
  region: string;
  active: boolean;
  created_at: string;
  members: number;
  open_cases: number;
};
export type Membership = { user_id: string; email: string; role: string; active: boolean };
export type PlatformAdmin = { user_id: string; email: string; active: boolean };
export type AuditEvent = {
  id: string;
  action: string;
  target_type: string;
  target_id: string;
  details: Record<string, unknown>;
  created_at: string;
  actor_email?: string | null;
};
async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${base}${path}`, {
    ...init,
    credentials: 'include',
    cache: 'no-store',
    headers: {
      Accept: 'application/json',
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...init.headers
    }
  });
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const error =
      payload && typeof payload === 'object' && 'error' in payload
        ? (payload as { error?: { message?: string } }).error?.message
        : undefined;
    throw new Error(error || 'The request could not be completed.');
  }
  if (!payload || typeof payload !== 'object' || !('data' in payload))
    throw new Error('The API returned an unexpected response.');
  return (payload as { data: T }).data;
}
export const currentAccount = () => request<{ id: string; email: string }>('/auth/me');
export const stats = () => request<Stats>('/platform/stats');
export const institutions = () => request<Institution[]>('/platform/institutions');
export const createInstitution = (name: string, region: string) =>
  request<{ id: string }>('/platform/institutions', {
    method: 'POST',
    body: JSON.stringify({ name, region })
  });
export const updateInstitution = (
  id: string,
  patch: Partial<Pick<Institution, 'name' | 'region' | 'active'>>
) =>
  request<{ name: string; region: string; active: boolean }>(`/platform/institutions/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(patch)
  });
export const memberships = (id: string) =>
  request<Membership[]>(`/platform/institutions/${id}/memberships`);
export const setMembership = (id: string, email: string, role: string, active: boolean) =>
  request<Membership>(`/platform/institutions/${id}/memberships`, {
    method: 'PUT',
    body: JSON.stringify({ email, role, active })
  });
export const admins = () => request<PlatformAdmin[]>('/platform/admins');
export const setAdmin = (email: string, active: boolean) =>
  request<PlatformAdmin>('/platform/admins', {
    method: 'PUT',
    body: JSON.stringify({ email, active })
  });
export const auditEvents = () => request<AuditEvent[]>('/platform/audit-events');
