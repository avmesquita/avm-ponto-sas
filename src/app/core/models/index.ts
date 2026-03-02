// ==================== ENUMS ====================

export enum UserRole {
  SUPER_ADMIN   = 'SuperAdmin',
  COMPANY_ADMIN = 'CompanyAdmin',
  USER          = 'User'
}

export enum UserStatus {
  PENDING   = 'pending',
  ACTIVE    = 'active',
  SUSPENDED = 'suspended'
}

export enum CompanyStatus {
  ACTIVE    = 'active',
  SUSPENDED = 'suspended',
  TRIAL     = 'trial'
}

// ==================== PLAN ====================

export interface Plan {
  id?: string;
  name: string;
  maxUsers: number;
  price: number;
  currency: string;
  active: boolean;
  createdAt: Date;
}

// ==================== COMPANY ====================

export interface Company {
  id?: string;
  name: string;
  slug: string;
  logoURL?: string;
  planId: string;
  planName?: string;
  maxUsers: number;
  country: string;       // ISO 3166-1 alpha-2 — define feriados nacionais carregados
  status: CompanyStatus;
  createdAt: Date;
  createdBy: string;
}

// ==================== USER ====================

export interface AppUser {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  role: UserRole;
  status: UserStatus;
  companyId: string;
  companySlug?: string;
  companyCountry: string;  // ISO 3166-1 — desnormalizado de Company.country
  workHoursPerDay: number;
  createdAt: Date;
  updatedAt: Date;
}

// ==================== INVITE ====================

export type InviteStatus = 'pending' | 'accepted' | 'expired';

export interface Invite {
  id?: string;
  companyId: string;
  companySlug: string;
  companyName: string;
  companyCountry: string;  // desnormalizado para usar no accept-invite
  email: string;
  token: string;
  status: InviteStatus;
  createdBy: string;
  createdAt: Date;
  expiresAt: Date;
  acceptedAt?: Date;
}

// ==================== TIME ENTRY ====================

export type PunchType = 'entry' | 'exit';

export interface TimeEntry {
  id?: string;
  companyId: string;
  userId: string;
  date: string;
  timestamp: Date;
  type: PunchType;
  note?: string;
  manual?: boolean;
  manualNote?: string;
  manualBy?: string;
  manualAt?: Date;
  imported?: boolean;
  importedBy?: string;
  importedAt?: Date;
  createdAt: Date;
}

// ==================== DAILY SUMMARY ====================

export interface DailySummary {
  date: string;
  entries: TimeEntry[];
  workedMinutes: number;
  expectedMinutes: number;
  balanceMinutes: number;
  isHoliday: boolean;
  isWeekend: boolean;
  isAbsence: boolean;
  absenceTypeName?: string;
  absenceTypeColor?: string;
  inconsistencies: Inconsistency[];
}

// ==================== INCONSISTENCIES ====================

export type InconsistencyType =
  | 'ODD_PUNCHES'
  | 'MISSING_EXIT'
  | 'MISSING_ENTRY'
  | 'EXCESSIVE_HOURS'
  | 'INSUFFICIENT_INTERVAL';

export interface Inconsistency {
  id?: string;
  companyId?: string;
  userId: string;
  date: string;
  type: InconsistencyType;
  description: string;
  resolved: boolean;
  createdAt: Date;
}

// ==================== HOLIDAY ====================

export interface Holiday {
  id?: string;
  companyId: string;     // '' = feriado do sistema (por país)
  country: string;       // ISO 3166-1 alpha-2: 'BR', 'PT', 'US' — '' para feriados de empresa
  date: string;
  nameKey: string;       // chave ngx-translate: 'holiday.christmas'
  name?: string;         // fallback legado / feriados criados manualmente
  national: boolean;
  hoursExpected?: number;
  createdBy: string;
  createdAt: Date;
}

// ==================== ABSENCE ====================

export interface AbsenceType {
  id?: string;
  companyId: string;
  name: string;
  color: string;
  deductsBalance: boolean;
  createdBy: string;
  createdAt: Date;
}

export type AbsenceStatus = 'pending' | 'approved' | 'rejected';

export interface Absence {
  id?: string;
  companyId: string;
  userId: string;
  userDisplayName?: string;
  absenceTypeId: string;
  absenceTypeName?: string;
  absenceTypeColor?: string;
  startDate: string;
  endDate: string;
  note?: string;
  status: AbsenceStatus;
  requestedAt: Date;
  reviewedBy?: string;
  reviewedAt?: Date;
  reviewNote?: string;
}

// ==================== MESSAGES ====================

export interface AppMessage {
  id?: string;
  companyId: string;
  title: string;
  body: string;
  icon?: string;
  iconColor?: string;
  link?: string;
  publishedAt: Date;
  createdBy: string;
  active: boolean;
}

export interface MessageRead {
  id?: string;
  userId: string;
  messageId: string;
  readAt: Date;
}

// ==================== AUTH LOG ====================

export interface AuthLog {
  id?: string;
  companyId?: string;
  userId: string;
  email: string;
  displayName: string;
  action: 'LOGIN' | 'LOGOUT' | 'REGISTER';
  timestamp: Date;
  userAgent?: string;
}

// ==================== IMPORT ====================

export interface ImportRow {
  userId: string;
  datetime: string;
  type: PunchType;
  note?: string;
}

export interface ImportResult {
  success: number;
  failed: number;
  errors: string[];
}

// ==================== HOUR BANK ====================

export interface HourBank {
  companyId: string;
  userId: string;
  totalBalanceMinutes: number;
  updatedAt: Date;
}
