// Shared types used by backend and frontend.
export const ROLES = ['admin', 'staff', 'viewer'] as const;
export type Role = (typeof ROLES)[number];

export const DEMO_DISCLAIMER = 'Synthetic data only. Not HIPAA-compliant. No real patient data.';
