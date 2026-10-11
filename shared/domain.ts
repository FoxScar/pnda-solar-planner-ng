// Domain vocabulary shared by the API server and the frontend.
// Keep this file free of runtime dependencies so both sides can import it.

export const ROLES = ["consumer", "installer", "engineer", "admin"] as const;
export type Role = (typeof ROLES)[number];

/** Roles inherit downwards: admin ⊃ engineer ⊃ installer ⊃ consumer (PRD §20.2). */
export const ROLE_RANK: Record<Role, number> = {
  consumer: 0,
  installer: 1,
  engineer: 2,
  admin: 3,
};

export function hasRoleAtLeast(role: Role, minimum: Role): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[minimum];
}

export const COMPONENT_TYPES = ["inverter", "battery", "panel"] as const;
export type ComponentType = (typeof COMPONENT_TYPES)[number];

export const BATTERY_CHEMISTRIES = ["lithium", "gel", "tubular"] as const;
export type BatteryChemistry = (typeof BATTERY_CHEMISTRIES)[number];

export const DC_VOLTAGES = [12, 24, 48] as const;

export const QUOTE_STATUSES = ["draft", "generated", "viewed", "expired"] as const;
export type QuoteStatus = (typeof QUOTE_STATUSES)[number];

export const QUOTE_FLAGS = ["PRICE_CHANGED", "COMPONENT_UNAVAILABLE", "UNDERSIZED_IN_WET_SEASON"] as const;
export type QuoteFlag = (typeof QUOTE_FLAGS)[number];

export const AUDIT_ACTIONS = [
  "PRICE_UPDATE",
  "AVAILABILITY_TOGGLE",
  "COMPONENT_CREATE",
  "COMPONENT_UPDATE",
  "APPLIANCE_CREATE",
  "APPLIANCE_UPDATE",
  "SUN_HOUR_UPDATE",
  "ROLE_CHANGE",
  "ENGINEER_OVERRIDE",
] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

/** Error codes from PRD §23.2 plus generic transport codes. */
export const ERROR_CODES = [
  "VOLTAGE_MISMATCH",
  "CHEMISTRY_RESTRICTED",
  "CHEMISTRY_MIXED",
  "CAPACITY_MIXED",
  "OVERSIZE_REQUIRED",
  "NO_SKU_AVAILABLE",
  "STATE_NOT_FOUND",
  "INVALID_PAYLOAD",
  "RATE_LIMITED",
  "UNAUTHENTICATED",
  "FORBIDDEN",
  "NOT_FOUND",
  "INTERNAL_ERROR",
] as const;
export type ErrorCode = (typeof ERROR_CODES)[number];

export interface ApiSuccess<T> {
  success: true;
  data: T;
  meta: { requestId: string; engineVersion: string };
}

export interface ApiFailure {
  success: false;
  error: { code: ErrorCode; message: string; field?: string; details?: unknown };
}

export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

/** The 36 states plus the Federal Capital Territory. */
export const NIGERIAN_STATES = [
  "Abia", "Adamawa", "Akwa Ibom", "Anambra", "Bauchi", "Bayelsa", "Benue", "Borno", "Cross River",
  "Delta", "Ebonyi", "Edo", "Ekiti", "Enugu", "FCT", "Gombe", "Imo", "Jigawa", "Kaduna", "Kano",
  "Katsina", "Kebbi", "Kogi", "Kwara", "Lagos", "Nasarawa", "Niger", "Ogun", "Ondo", "Osun", "Oyo",
  "Plateau", "Rivers", "Sokoto", "Taraba", "Yobe", "Zamfara",
] as const;
export type NigerianState = (typeof NIGERIAN_STATES)[number];

/** National fallback when a state has no sun-hour record (PRD §19.2). */
export const NATIONAL_DEFAULT_SUN_HOURS = 4.5;
