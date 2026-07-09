export const ROLES = ['admin', 'staff', 'viewer'] as const;
export type Role = (typeof ROLES)[number];

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
}

export const DEMO_DISCLAIMER = 'Synthetic data only — not HIPAA-compliant.';
