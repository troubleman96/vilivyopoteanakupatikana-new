export type UserRole = 'super_admin' | 'university_admin' | 'security_officer';

export interface User {
  id: string | number;
  email: string;
  username: string;
  name?: string;
  role: UserRole;
  universityId?: string | number;
  university?: number;
  university_name?: string;
  createdAt?: string;
  lastLogin?: string;
}

export interface University {
  id: string | number;
  name: string;
  shortName: string;
  short_name?: string;
  emailDomain: string;
  email_domain?: string;
  campuses: string[];
  contactEmail: string;
  contact_email?: string;
  contactPhone: string;
  contact_phone?: string;
  address: string;
  isActive: boolean;
  is_active?: boolean;
  createdAt?: string;
  totalItems: number;
  total_items?: number;
  activeItems: number;
  active_items?: number;
}

export type ItemStatus = 'pending' | 'matched' | 'verified' | 'returned' | 'archived' | 'open' | 'potential_match' | 'claimed';
export type ItemType = 'lost' | 'found';

export interface LostFoundItem {
  id: string | number;
  type: ItemType;
  item_type?: ItemType;
  category: string;
  title: string;
  description: string;
  location: string;
  location_display?: string;
  dateReported: string;
  date_reported?: string;
  dateOccurred: string;
  date_occurred?: string;
  status: ItemStatus;
  reporterName: string;
  reporter_name?: string;
  reporterEmail: string;
  reporter_email?: string;
  reporterPhone?: string;
  reporter_phone?: string;
  universityId: string | number;
  university?: number;
  universityName?: string;
  university_name?: string;
  imageUrl?: string;
  image_url?: string;
  matchedItemId?: string | number;
  verifiedBy?: string;
  verifiedAt?: string;
  returnedAt?: string;
  notes?: string;
}

export interface MatchRequest {
  id: string | number;
  lostItemId: string | number;
  lost_item_id?: string | number;
  lost_item?: LostFoundItem;
  foundItemId: string | number;
  found_item_id?: string | number;
  found_item?: LostFoundItem;
  requestedAt: string;
  requested_at?: string;
  status: 'pending' | 'approved' | 'rejected';
  reviewedBy?: string;
  reviewed_by?: string | number;
  reviewedAt?: string;
  reviewed_at?: string;
  notes?: string;
}

export interface AuditLog {
  id: string | number;
  action: string;
  userId: string | number;
  user_id?: string | number;
  userName: string;
  user_name?: string;
  userRole: UserRole;
  user_role?: UserRole;
  targetType: string;
  target_type?: string;
  targetId: string | number;
  target_id?: string | number;
  details: string;
  timestamp: string;
  created_at?: string;
  universityId?: string | number;
  university_id?: string | number;
  university_name?: string;
}

export interface DashboardStats {
  totalLostItems: number;
  totalFoundItems: number;
  pendingVerifications: number;
  matchedItems: number;
  returnedItems: number;
  activeUniversities: number;
}
