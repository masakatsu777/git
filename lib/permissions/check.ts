import { ROLE_PERMISSIONS, type AppRole, type PermissionCode } from "@/lib/permissions/definitions";

export type SessionUser = {
  id: string;
  name: string;
  role: AppRole;
  teamIds: string[];
};

export function getRolePermissions(role: AppRole): PermissionCode[] {
  return ROLE_PERMISSIONS[role];
}

export function hasPermission(user: SessionUser, permission: PermissionCode): boolean {
  return getRolePermissions(user.role).includes(permission);
}

export function canAccessTeam(user: SessionUser, teamId: string): boolean {
  return user.role === "admin" || user.role === "president" || user.teamIds.includes(teamId);
}

export function canViewManagerReview(user: SessionUser, teamId: string, memberId?: string): boolean {
  if (user.role === "admin" || user.role === "president") return true;
  if (user.role === "leader") return true;
  if (user.role === "employee") {
    return !memberId || memberId === user.id;
  }
  return false;
}

export function canEditManagerReview(user: SessionUser, teamId: string, memberId?: string): boolean {
  if (user.role === "leader" && memberId === user.id) {
    return false;
  }
  return hasPermission(user, "evaluation:team:write") && canAccessTeam(user, teamId);
}

export function canViewFinalReview(user: SessionUser, memberId?: string): boolean {
  if (user.role === "admin" || user.role === "president" || user.role === "leader") return true;
  if (user.role === "employee") {
    return !memberId || memberId === user.id;
  }
  return false;
}

export function requirePermission(user: SessionUser, permission: PermissionCode, teamId?: string) {
  if (!hasPermission(user, permission)) {
    throw new Error(`Missing permission: ${permission}`);
  }

  if (teamId && !canAccessTeam(user, teamId)) {
    throw new Error(`Team access denied: ${teamId}`);
  }
}