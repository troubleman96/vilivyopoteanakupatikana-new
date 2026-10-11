const base = (process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8080/api/v1').replace(
  /\/+$/,
  ''
);

export type Institution = { id: string; name: string; region: string };
export type CaseRecord = {
  id: string;
  item_id: string;
  status: string;
  kind: string;
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
export type Claim = {
  id: string;
  item_id: string;
  claimant_id: string;
  statement: string;
  contact_details?: string;
  status: string;
  created_at: string;
  verification_method?: string;
  verified_at?: string;
};
export type Stats = { open_cases: number; open_claims: number };

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
export const institutions = () => request<Institution[]>('/staff/institutions');
export const cases = (id: string) => request<CaseRecord[]>(`/staff/institutions/${id}/cases`);
export const claims = (id: string) => request<Claim[]>(`/staff/institutions/${id}/claims`);
export const stats = (id: string) => request<Stats>(`/institutions/${id}/stats`);
export const reviewClaim = (
  institutionID: string,
  claimID: string,
  status: string,
  staff_note: string
) =>
  request<{ status: string }>(`/staff/institutions/${institutionID}/claims/${claimID}/review`, {
    method: 'POST',
    body: JSON.stringify({ status, staff_note })
  });
export const updateCase = (institutionID: string, caseID: string, status: string) =>
  request<{ status: string }>(`/staff/institutions/${institutionID}/cases/${caseID}`, {
    method: 'PATCH',
    body: JSON.stringify({ status })
  });
export const reviewItem = (
  institutionID: string,
  itemID: string,
  status: 'approved' | 'rejected',
  summary: { public_title: string; public_description: string; public_location: string }
) =>
  request<{ review_status: string; visibility: string }>(
    `/staff/institutions/${institutionID}/items/${itemID}/review`,
    { method: 'POST', body: JSON.stringify({ status, ...summary }) }
  );
export const verifyClaim = (
  institutionID: string,
  claimID: string,
  verification_method: string,
  verification_note: string
) =>
  request<{ status: string; verified_at: string }>(
    `/staff/institutions/${institutionID}/claims/${claimID}/verification`,
    { method: 'POST', body: JSON.stringify({ verification_method, verification_note }) }
  );
export const recordHandover = (
  institutionID: string,
  caseID: string,
  payload: { claim_id: string; handover_at: string; details: string; recipient: string }
) =>
  request<{ status: string }>(`/staff/institutions/${institutionID}/cases/${caseID}/handover`, {
    method: 'POST',
    body: JSON.stringify(payload)
  });
