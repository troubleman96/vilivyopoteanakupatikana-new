export type UserRole = 'super_admin' | 'university_admin' | 'security_officer';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  universityId?: string;
  createdAt: string;
  lastLogin?: string;
}

export interface University {
  id: string;
  name: string;
  shortName: string;
  emailDomain: string;
  campuses: string[];
  contactEmail: string;
  contactPhone: string;
  address: string;
  isActive: boolean;
  createdAt: string;
  totalItems: number;
  activeItems: number;
}

export type ItemStatus = 'pending' | 'matched' | 'verified' | 'returned' | 'archived';
export type ItemType = 'lost' | 'found';

export interface LostFoundItem {
  id: string;
  type: ItemType;
  category: string;
  title: string;
  description: string;
  location: string;
  dateReported: string;
  dateOccurred: string;
  status: ItemStatus;
  reporterName: string;
  reporterEmail: string;
  reporterPhone: string;
  universityId: string;
  universityName: string;
  imageUrl?: string;
  matchedItemId?: string;
  verifiedBy?: string;
  verifiedAt?: string;
  returnedAt?: string;
  notes?: string;
}

export interface MatchRequest {
  id: string;
  lostItemId: string;
  foundItemId: string;
  requestedAt: string;
  status: 'pending' | 'approved' | 'rejected';
  reviewedBy?: string;
  reviewedAt?: string;
  notes?: string;
}

export interface AuditLog {
  id: string;
  action: string;
  userId: string;
  userName: string;
  userRole: UserRole;
  targetType: string;
  targetId: string;
  details: string;
  timestamp: string;
  universityId?: string;
}

export interface DashboardStats {
  totalLostItems: number;
  totalFoundItems: number;
  pendingVerifications: number;
  matchedItems: number;
  returnedItems: number;
  activeUniversities: number;
}
