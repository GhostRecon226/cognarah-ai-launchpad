import { createContext, useContext } from "react";

export type AppRole = "admin" | "editor" | "author";

export const ROLE_LABELS: Record<AppRole, string> = {
  admin: "Admin",
  editor: "Editor",
  author: "Author",
};

interface RolesContextValue {
  userId: string;
  roles: AppRole[];
  hasRole: (role: AppRole) => boolean;
  hasAny: (roles: AppRole[]) => boolean;
}

export const RolesContext = createContext<RolesContextValue | null>(null);

export function useRoles(): RolesContextValue {
  const v = useContext(RolesContext);
  if (!v) throw new Error("useRoles must be used inside AdminShell");
  return v;
}
