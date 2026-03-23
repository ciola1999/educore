/**
 * RBAC (Role-Based Access Control) Service
 *
 * Provides functions for checking permissions and role-based access.
 * This is used for both Tauri desktop and web environments.
 */

import { AUTH_ROLES, type AuthRole } from "@/core/auth/roles";

/**
 * Permission types
 */
export type Permission =
  | "users:read"
  | "users:write"
  | "users:delete"
  | "academic:read"
  | "academic:write"
  | "attendance:read"
  | "attendance:write"
  | "finance:read"
  | "finance:write"
  | "reports:generate"
  | "settings:manage";

/**
 * Role types
 */
export type Role = AuthRole;

/**
 * Default role-permission mapping
 * These are the minimum permissions for each role
 */
export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  super_admin: [
    "users:read",
    "users:write",
    "users:delete",
    "academic:read",
    "academic:write",
    "attendance:read",
    "attendance:write",
    "finance:read",
    "finance:write",
    "reports:generate",
    "settings:manage",
  ],
  admin: [
    "users:read",
    "users:write",
    "users:delete",
    "academic:read",
    "academic:write",
    "attendance:read",
    "attendance:write",
    "finance:read",
    "finance:write",
    "reports:generate",
    "settings:manage",
  ],
  teacher: [
    "academic:read",
    "academic:write",
    "attendance:read",
    "attendance:write",
    "reports:generate",
  ],
  staff: [
    "users:read",
    "academic:read",
    "attendance:read",
    "attendance:write",
    "finance:read",
    "finance:write",
  ],
  student: ["attendance:read"],
  parent: ["academic:read", "attendance:read", "finance:read"],
};

/**
 * Check if a role has a specific permission
 */
export function hasPermission(role: Role, permission: Permission): boolean {
  const rolePerms = ROLE_PERMISSIONS[role];
  if (!rolePerms) {
    console.warn(`[RBAC] Unknown role: ${role}`);
    return false;
  }
  return rolePerms.includes(permission);
}

/**
 * Check if a role has any of the specified permissions
 */
export function hasAnyPermission(
  role: Role,
  permissions: Permission[],
): boolean {
  return permissions.some((perm) => hasPermission(role, perm));
}

/**
 * Check if a role has all of the specified permissions
 */
export function hasAllPermissions(
  role: Role,
  permissions: Permission[],
): boolean {
  return permissions.every((perm) => hasPermission(role, perm));
}

/**
 * Get all permissions for a role
 */
export function getPermissions(role: Role): Permission[] {
  return ROLE_PERMISSIONS[role] || [];
}

/**
 * Get user role from session/user object
 * Works with both NextAuth session and Tauri user data
 */
export function getUserRole(user: unknown): Role | null {
  if (!user) return null;

  // Try custom format
  if (typeof user === "object") {
    const userObj = user as Record<string, unknown>;
    const candidates = [
      userObj.role,
      typeof userObj.user === "object" && userObj.user
        ? (userObj.user as Record<string, unknown>).role
        : undefined,
    ];

    for (const candidate of candidates) {
      if (
        typeof candidate === "string" &&
        AUTH_ROLES.includes(candidate as Role)
      ) {
        return candidate as Role;
      }
    }
  }

  return null;
}

/**
 * Check if user has one of the allowed roles
 */
export function hasRole(user: unknown, roles: Role[]): boolean {
  const role = getUserRole(user);
  if (!role) return false;
  return roles.includes(role);
}

/**
 * Check if user has permission
 * Uses the role from the user object
 */
export function checkPermission(
  user: unknown,
  permission: Permission,
): boolean {
  const role = getUserRole(user);
  if (!role) return false;
  return hasPermission(role, permission);
}

/**
 * Check if user has any permission
 */
export function checkAnyPermission(
  user: unknown,
  permissions: Permission[],
): boolean {
  const role = getUserRole(user);
  if (!role) return false;
  return hasAnyPermission(role, permissions);
}

/**
 * Check if user has all permissions
 */
export function checkAllPermissions(
  user: unknown,
  permissions: Permission[],
): boolean {
  const role = getUserRole(user);
  if (!role) return false;
  return hasAllPermissions(role, permissions);
}

/**
 * Require permission - throws error if user doesn't have permission
 */
export function requirePermission(user: unknown, permission: Permission): void {
  if (!checkPermission(user, permission)) {
    const role = getUserRole(user);
    throw new Error(
      `Akses ditolak. Anda membutuhkan permission '${permission}' untuk melakukan operasi ini. Role Anda: ${role || "tidak diketahui"}`,
    );
  }
}

/**
 * Require any permission - throws error if user doesn't have any of the permissions
 */
export function requireAnyPermission(
  user: unknown,
  permissions: Permission[],
): void {
  if (!checkAnyPermission(user, permissions)) {
    const role = getUserRole(user);
    throw new Error(
      `Akses ditolak. Anda membutuhkan salah satu permission dari [${permissions.join(", ")}] untuk melakukan operasi ini. Role Anda: ${role || "tidak diketahui"}`,
    );
  }
}

/**
 * Require all permissions - throws error if user doesn't have all of the permissions
 */
export function requireAllPermissions(
  user: unknown,
  permissions: Permission[],
): void {
  if (!checkAllPermissions(user, permissions)) {
    const role = getUserRole(user);
    throw new Error(
      `Akses ditolak. Anda membutuhkan semua permission [${permissions.join(", ")}] untuk melakukan operasi ini. Role Anda: ${role || "tidak diketahui"}`,
    );
  }
}

/**
 * Require specific role
 */
export function requireRole(user: unknown, requiredRole: Role): void {
  const role = getUserRole(user);
  if (role !== requiredRole) {
    throw new Error(
      `Akses ditolak. Anda membutuhkan role '${requiredRole}'. Role Anda: ${role || "tidak diketahui"}`,
    );
  }
}

/**
 * Require any of the specified roles
 */
export function requireAnyRole(user: unknown, roles: Role[]): void {
  const role = getUserRole(user);
  if (!role || !roles.includes(role)) {
    throw new Error(
      `Akses ditolak. Anda membutuhkan salah satu role dari [${roles.join(", ")}]. Role Anda: ${role || "tidak diketahui"}`,
    );
  }
}
