import type { Role } from "./enums";
import { ADMIN_ROLES } from "./enums";

/**
 * Permission strings checked on the server. Roles map to permissions here, in one place.
 * Object-level checks (is this user a participant of this conversation?) live in the services.
 */
export const PERMISSIONS = [
  "listing:create",
  "listing:manage_own",
  "agency:manage",
  "admin:access",
  "admin:listings.moderate",
  /** Edit any listing's details and photos, and delete listings permanently. Super administrators only. */
  "admin:listings.edit",
  "admin:verification.review",
  "admin:reports.handle",
  "admin:users.manage",
  "admin:roles.assign",
  "admin:catalog.manage",
  "admin:locations.manage",
  "admin:payments.view",
  "admin:payments.manage",
  "admin:plans.manage",
  "admin:settings.manage",
  "admin:content.manage",
  "admin:audit.view",
  "admin:messages.moderate",
  "admin:documents.view",
] as const;
export type Permission = (typeof PERMISSIONS)[number];

const ALL = PERMISSIONS;

export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  USER: [],
  OWNER: ["listing:create", "listing:manage_own"],
  AGENT: ["listing:create", "listing:manage_own", "agency:manage"],
  SUPER_ADMIN: ALL,
  MODERATOR: [
    "admin:access",
    "admin:listings.moderate",
    "admin:reports.handle",
    "admin:messages.moderate",
    "admin:catalog.manage",
    "admin:locations.manage",
    "admin:content.manage",
    "admin:audit.view",
  ],
  VERIFICATION_OFFICER: ["admin:access", "admin:verification.review", "admin:documents.view", "admin:audit.view"],
  SUPPORT: ["admin:access", "admin:reports.handle", "admin:users.manage", "admin:messages.moderate"],
  FINANCE: ["admin:access", "admin:payments.view", "admin:payments.manage", "admin:plans.manage", "admin:audit.view"],
};

export function permissionsFor(roles: readonly Role[]): Set<Permission> {
  const set = new Set<Permission>();
  for (const r of roles) for (const p of ROLE_PERMISSIONS[r] ?? []) set.add(p);
  return set;
}

export function hasPermission(roles: readonly Role[], permission: Permission): boolean {
  return roles.some((r) => (ROLE_PERMISSIONS[r] ?? []).includes(permission));
}

export function isStaff(roles: readonly Role[]): boolean {
  return roles.some((r) => ADMIN_ROLES.includes(r));
}

/** Roles a user may pick for themselves at sign-up. Staff roles can only be granted by a super admin. */
export const SELF_SERVICE_ROLES: readonly Role[] = ["USER", "OWNER", "AGENT"];

export const ROLE_LABELS: Record<Role, string> = {
  USER: "Tenant / buyer",
  OWNER: "Landlord / owner",
  AGENT: "Agent",
  SUPER_ADMIN: "Super administrator",
  MODERATOR: "Moderator",
  VERIFICATION_OFFICER: "Verification officer",
  SUPPORT: "Customer support",
  FINANCE: "Finance",
};
