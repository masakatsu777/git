export const PERMISSIONS = {
  evaluationSelfWrite: "evaluation:self:write",
  evaluationTeamWrite: "evaluation:team:write",
  evaluationFinalize: "evaluation:finalize",
  plTeamRead: "pl:team:read",
  plTeamWrite: "pl:team:write",
  plAllRead: "pl:all:read",
  costWrite: "cost:write",
  salaryRead: "salary:read",
  salaryWrite: "salary:write",
  salaryApprove: "salary:approve",
  masterWrite: "master:write",
} as const;

export type PermissionCode = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export type AppRole = "employee" | "leader" | "admin" | "president";

export const ROLE_PERMISSIONS: Record<AppRole, PermissionCode[]> = {
  employee: [PERMISSIONS.evaluationSelfWrite, PERMISSIONS.plTeamRead],
  leader: [
    PERMISSIONS.evaluationSelfWrite,
    PERMISSIONS.evaluationTeamWrite,
    PERMISSIONS.plTeamRead,
    PERMISSIONS.plTeamWrite,
  ],
  admin: Object.values(PERMISSIONS),
  president: [
    PERMISSIONS.evaluationFinalize,
    PERMISSIONS.plAllRead,
    PERMISSIONS.salaryRead,
    PERMISSIONS.salaryApprove,
  ],
};