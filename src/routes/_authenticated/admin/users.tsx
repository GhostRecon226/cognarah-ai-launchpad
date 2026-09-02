import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { AdminShell } from "@/components/admin/admin-shell";
import { useServerFn } from "@tanstack/react-start";
import { listUsersWithRoles, grantRole, revokeRole } from "@/lib/admin-users.functions";
import { ROLE_LABELS, type AppRole } from "@/lib/admin-roles";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

export const Route = createFileRoute("/_authenticated/admin/users")({
  head: () => ({ meta: [{ title: "Users: Cognarah CMS" }, { name: "robots", content: "noindex" }] }),
  component: UsersPage,
});

interface UserRow {
  id: string;
  email: string;
  last_sign_in_at: string | null;
  created_at: string;
  roles: AppRole[];
}

const ALL_ROLES: AppRole[] = ["admin", "editor", "author"];

function UsersPage() {
  const [rows, setRows] = useState<UserRow[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const list = useServerFn(listUsersWithRoles);
  const grant = useServerFn(grantRole);
  const revoke = useServerFn(revokeRole);

  const load = useCallback(async () => {
    try {
      const res = await list();
      setRows(res.users);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to load users");
      setRows([]);
    }
  }, [list]);

  useEffect(() => {
    load();
  }, [load]);

  async function toggle(userId: string, role: AppRole, hasIt: boolean) {
    const key = `${userId}:${role}`;
    setBusy(key);
    try {
      if (hasIt) await revoke({ data: { userId, role } });
      else await grant({ data: { userId, role } });
      await load();
      toast.success(hasIt ? `Revoked ${ROLE_LABELS[role]}` : `Granted ${ROLE_LABELS[role]}`);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <AdminShell title="Users & roles" requiredRoles={["admin"]}>
      <p className="mb-4 max-w-2xl text-sm text-muted-foreground">
        Grant or revoke roles for anyone who has signed in. Admins manage everything. Editors can publish articles and manage categories/authors. Authors can create and edit their own drafts only.
      </p>

      {rows === null ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-muted-foreground">No users yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-background">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-secondary text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Last sign-in</th>
                <th className="px-4 py-3">Roles</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((u) => (
                <tr key={u.id} className="align-top">
                  <td className="px-4 py-3">
                    <div className="font-medium">{u.email || "None"}</div>
                    <div className="text-xs text-muted-foreground" suppressHydrationWarning>
                      Joined {formatDistanceToNow(new Date(u.created_at), { addSuffix: true })}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground" suppressHydrationWarning>
                    {u.last_sign_in_at ? formatDistanceToNow(new Date(u.last_sign_in_at), { addSuffix: true }) : "Never"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      {ALL_ROLES.map((role) => {
                        const hasIt = u.roles.includes(role);
                        const key = `${u.id}:${role}`;
                        return (
                          <button
                            key={role}
                            disabled={busy === key}
                            onClick={() => toggle(u.id, role, hasIt)}
                            className={
                              hasIt
                                ? "rounded-full bg-brand px-3 py-1 text-xs font-semibold text-white hover:bg-brand/90 disabled:opacity-50"
                                : "rounded-full border border-border px-3 py-1 text-xs text-muted-foreground hover:border-brand hover:text-brand disabled:opacity-50"
                            }
                          >
                            {hasIt ? "✓ " : "+ "}{ROLE_LABELS[role]}
                          </button>
                        );
                      })}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AdminShell>
  );
}
