'use client';

import { createContext, useContext, useSyncExternalStore, type ReactNode } from 'react';

export type DemoRole = 'individual' | 'staff' | 'institution' | 'platform';
const validRoles: DemoRole[] = ['individual', 'staff', 'institution', 'platform'];
type RoleContextValue = { role: DemoRole; setRole: (role: DemoRole) => void };
const RoleContext = createContext<RoleContextValue | null>(null);

function getRoleSnapshot(): DemoRole {
  if (typeof window === 'undefined') return 'staff';
  const stored = window.localStorage.getItem('vp-demo-role');
  return stored && validRoles.includes(stored as DemoRole) ? stored as DemoRole : 'staff';
}

function subscribeToRole(callback: () => void) {
  window.addEventListener('storage', callback);
  window.addEventListener('vp-demo-role-change', callback);
  return () => {
    window.removeEventListener('storage', callback);
    window.removeEventListener('vp-demo-role-change', callback);
  };
}

function chooseRole(role: DemoRole) {
  window.localStorage.setItem('vp-demo-role', role);
  window.dispatchEvent(new Event('vp-demo-role-change'));
}

export function DemoRoleProvider({ children }: { children: ReactNode }) {
  const role = useSyncExternalStore(subscribeToRole, getRoleSnapshot, () => 'staff' as DemoRole);
  return <RoleContext.Provider value={{ role, setRole: chooseRole }}>{children}</RoleContext.Provider>;
}

export function useDemoRole() {
  const value = useContext(RoleContext);
  if (!value) throw new Error('useDemoRole must be used inside DemoRoleProvider');
  return value;
}
