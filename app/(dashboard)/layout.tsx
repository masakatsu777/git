import { ReactNode } from "react";

import { getSessionUser } from "@/lib/auth/demo-session";
import { getUserMenuVisibility } from "@/lib/menu-visibility/menu-visibility-service";
import { hasPermission } from "@/lib/permissions/check";
import { PERMISSIONS } from "@/lib/permissions/definitions";

type DashboardLayoutProps = {
  children: ReactNode;
};

export default async function DashboardLayout({ children }: DashboardLayoutProps) {
  const user = await getSessionUser();
  const visibility = await getUserMenuVisibility(user.id, user.role);
  const hasPrimaryTeam = user.teamIds.length > 0;
  void visibility;
  void hasPrimaryTeam;
  void user;
  void hasPermission;
  void PERMISSIONS;

  return (
    children
  );
}
