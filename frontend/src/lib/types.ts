export const ROLES = ['admin', 'staff', 'viewer'] as const;
export type Role = (typeof ROLES)[number];

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
}

export const DEMO_DISCLAIMER = 'Synthetic data only — not HIPAA-compliant.';

export interface ActivityItem {
  id: string;
  action: string;
  entityType: string;
  entityId?: string;
  summary: string;
  actor: string;
  createdAt: string;
}

export interface DashboardSummary {
  generatedAt: string;
  patients: {
    total: number;
    byRisk: Record<string, number>;
    byStatus: Record<string, number>;
  };
  tasks: {
    total: number;
    byStatus: Record<string, number>;
    byPriority: Record<string, number>;
    overdue: number;
    unassigned: number;
  };
  recentActivity: ActivityItem[];
}

export type PatientStatus = 'active' | 'inactive';
export type RiskLevel = 'low' | 'medium' | 'high';

export interface Patient {
  id: string;
  firstName: string;
  lastName: string;
  dateOfBirth?: string;
  memberId: string;
  phone?: string;
  email?: string;
  status: PatientStatus;
  riskLevel: RiskLevel;
  primaryCareManager?: string | null;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PatientsResponse {
  patients: Patient[];
  total: number;
  page: number;
  limit: number;
}

export type TaskStatus = 'open' | 'in_progress' | 'blocked' | 'done' | 'cancelled';
export type TaskPriority = 'urgent' | 'high' | 'medium' | 'low';
export type TaskCategory =
  | 'follow_up'
  | 'documentation'
  | 'access_issue'
  | 'medication'
  | 'appointment'
  | 'billing'
  | 'other';

export interface CareTask {
  id: string;
  patient: string;
  title: string;
  description?: string;
  category: TaskCategory;
  priority: TaskPriority;
  status: TaskStatus;
  assignedTo?: string | null;
  createdBy: string;
  dueDate?: string;
  blockedReason?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CareTasksResponse {
  tasks: CareTask[];
  total: number;
  page: number;
  limit: number;
}

export interface DirectoryUser {
  id: string;
  name: string;
  email: string;
  role: Role;
}

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  active: boolean;
  createdAt: string;
}
