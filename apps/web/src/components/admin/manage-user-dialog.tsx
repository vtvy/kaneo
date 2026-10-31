import { useState } from "react";
import { useTranslation } from "react-i18next";
import useAuth from "@/components/providers/auth-provider/hooks/use-auth";
import type { AdminUser } from "@/fetchers/admin/list-admin-users";
import useBanAdminUser from "@/hooks/mutations/admin/use-ban-admin-user";
import useDeleteAdminUser from "@/hooks/mutations/admin/use-delete-admin-user";
import useRevokeAdminUserApiKeys from "@/hooks/mutations/admin/use-revoke-admin-user-api-keys";
import useRevokeAdminUserSessions from "@/hooks/mutations/admin/use-revoke-admin-user-sessions";
import useSetAdminUserRole from "@/hooks/mutations/admin/use-set-admin-user-role";
import useUnbanAdminUser from "@/hooks/mutations/admin/use-unban-admin-user";
import useAdminUserApiKeys from "@/hooks/queries/admin/use-admin-user-api-keys";
import useAdminUserSessions from "@/hooks/queries/admin/use-admin-user-sessions";
import { toast } from "@/lib/toast";
import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../ui/alert-dialog";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Input } from "../ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";

type ManageUserDialogProps = {
  user: AdminUser | null;
  onClose: () => void;
};

function formatDateTime(value: string | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-medium">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}

export function ManageUserDialog({ user, onClose }: ManageUserDialogProps) {
  const { t } = useTranslation();
  const { user: currentUser } = useAuth();
  const userId = user?.id ?? null;
  const isSelf = Boolean(user && currentUser?.id === user.id);
  const [banReason, setBanReason] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const { data: sessions = [], isLoading: sessionsLoading } =
    useAdminUserSessions(userId);
  const { data: apiKeys = [], isLoading: keysLoading } =
    useAdminUserApiKeys(userId);
  const setRole = useSetAdminUserRole();
  const ban = useBanAdminUser();
  const unban = useUnbanAdminUser();
  const remove = useDeleteAdminUser();
  const revokeSessions = useRevokeAdminUserSessions();
  const revokeKeys = useRevokeAdminUserApiKeys();

  const run = async (action: () => Promise<unknown>, success: string) => {
    try {
      await action();
      toast.success(success);
      return true;
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("settings:adminPanel.manage.failed"),
      );
      return false;
    }
  };

  if (!user) return null;

  const roleLabel = (role: "admin" | "user") =>
    role === "admin"
      ? t("settings:adminPanel.roles.admin")
      : t("settings:adminPanel.roles.user");

  return (
    <>
      <Dialog open onOpenChange={(next) => !next && onClose()}>
        <DialogContent className="sm:max-w-2xl p-0 gap-0 max-h-[90vh] overflow-y-auto">
          <DialogHeader className="px-6 py-5 border-b border-border">
            <DialogTitle>{user.name}</DialogTitle>
            <DialogDescription>{user.email}</DialogDescription>
          </DialogHeader>

          <div className="space-y-6 px-6 py-5">
            {isSelf && (
              <p className="text-xs text-muted-foreground">
                {t("settings:adminPanel.manage.selfNotice")}
              </p>
            )}

            <Section title={t("settings:adminPanel.manage.role")}>
              <Select
                value={user.role}
                disabled={isSelf || setRole.isPending}
                onValueChange={(value) =>
                  run(
                    () =>
                      setRole.mutateAsync({
                        userId: user.id,
                        role: value as "admin" | "user",
                      }),
                    t("settings:adminPanel.manage.roleUpdated"),
                  ).then((done) => done && onClose())
                }
              >
                <SelectTrigger className="w-48">
                  <SelectValue>{roleLabel(user.role)}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">{roleLabel("user")}</SelectItem>
                  <SelectItem value="admin">{roleLabel("admin")}</SelectItem>
                </SelectContent>
              </Select>
            </Section>

            <Section title={t("settings:adminPanel.manage.access")}>
              {user.banned ? (
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm text-muted-foreground">
                    {user.banReason
                      ? t("settings:adminPanel.manage.bannedWithReason", {
                          reason: user.banReason,
                        })
                      : t("settings:adminPanel.manage.banned")}
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={unban.isPending}
                    onClick={() =>
                      run(
                        () => unban.mutateAsync(user.id),
                        t("settings:adminPanel.manage.unbanned"),
                      ).then((done) => done && onClose())
                    }
                  >
                    {t("settings:adminPanel.manage.unban")}
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Input
                    placeholder={t(
                      "settings:adminPanel.manage.banReasonPlaceholder",
                    )}
                    maxLength={500}
                    value={banReason}
                    disabled={isSelf}
                    onChange={(e) => setBanReason(e.target.value)}
                  />
                  <Button
                    variant="destructive"
                    size="sm"
                    disabled={isSelf || ban.isPending}
                    onClick={() =>
                      run(
                        () =>
                          ban.mutateAsync({
                            userId: user.id,
                            reason: banReason.trim() || undefined,
                          }),
                        t("settings:adminPanel.manage.bannedToast"),
                      ).then((done) => done && onClose())
                    }
                  >
                    {t("settings:adminPanel.manage.ban")}
                  </Button>
                </div>
              )}
            </Section>

            <Section
              title={t("settings:adminPanel.manage.sessions")}
              action={
                sessions.length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={revokeSessions.isPending}
                    onClick={() =>
                      run(
                        () => revokeSessions.mutateAsync({ userId: user.id }),
                        t("settings:adminPanel.manage.sessionsRevoked"),
                      )
                    }
                  >
                    {t("settings:adminPanel.manage.revokeAll")}
                  </Button>
                )
              }
            >
              {sessionsLoading ? (
                <p className="text-sm text-muted-foreground">
                  {t("settings:adminPanel.loading")}
                </p>
              ) : sessions.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {t("settings:adminPanel.manage.noSessions")}
                </p>
              ) : (
                <ul className="divide-y divide-border rounded-md border border-border">
                  {sessions.map((session) => (
                    <li
                      key={session.id}
                      className="flex items-center justify-between gap-3 px-3 py-2"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm">
                          {session.userAgent ||
                            t("settings:adminPanel.manage.unknownDevice")}
                          {session.current && (
                            <Badge variant="info" className="ml-2">
                              {t("settings:adminPanel.manage.currentSession")}
                            </Badge>
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {session.ipAddress ?? "-"} ·{" "}
                          {t("settings:adminPanel.manage.lastActive", {
                            date: formatDateTime(session.lastActiveAt),
                          })}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive"
                        disabled={revokeSessions.isPending}
                        onClick={() =>
                          run(
                            () =>
                              revokeSessions.mutateAsync({
                                userId: user.id,
                                sessionId: session.id,
                              }),
                            t("settings:adminPanel.manage.sessionRevoked"),
                          )
                        }
                      >
                        {t("settings:adminPanel.manage.revoke")}
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </Section>

            <Section
              title={t("settings:adminPanel.manage.apiKeys")}
              action={
                apiKeys.length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={revokeKeys.isPending}
                    onClick={() =>
                      run(
                        () => revokeKeys.mutateAsync({ userId: user.id }),
                        t("settings:adminPanel.manage.apiKeysRevoked"),
                      )
                    }
                  >
                    {t("settings:adminPanel.manage.revokeAll")}
                  </Button>
                )
              }
            >
              {keysLoading ? (
                <p className="text-sm text-muted-foreground">
                  {t("settings:adminPanel.loading")}
                </p>
              ) : apiKeys.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {t("settings:adminPanel.manage.noApiKeys")}
                </p>
              ) : (
                <ul className="divide-y divide-border rounded-md border border-border">
                  {apiKeys.map((key) => (
                    <li
                      key={key.id}
                      className="flex items-center justify-between gap-3 px-3 py-2"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm">
                          {key.name ||
                            t("settings:adminPanel.manage.unnamedKey")}{" "}
                          <code className="text-xs bg-background px-1.5 py-0.5 rounded border border-border">
                            {key.start ?? key.prefix ?? ""}…
                          </code>
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {t("settings:adminPanel.manage.lastUsed", {
                            date: formatDateTime(key.lastUsedAt),
                          })}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive"
                        disabled={revokeKeys.isPending}
                        onClick={() =>
                          run(
                            () =>
                              revokeKeys.mutateAsync({
                                userId: user.id,
                                keyId: key.id,
                              }),
                            t("settings:adminPanel.manage.apiKeyRevoked"),
                          )
                        }
                      >
                        {t("settings:adminPanel.manage.revoke")}
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </Section>

            <Section title={t("settings:adminPanel.manage.dangerZone")}>
              <Button
                variant="destructive"
                size="sm"
                disabled={isSelf}
                onClick={() => setConfirmDelete(true)}
              >
                {t("settings:adminPanel.manage.deleteUser")}
              </Button>
            </Section>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={confirmDelete}
        onOpenChange={(next) => !next && setConfirmDelete(false)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("settings:adminPanel.manage.deleteConfirmTitle")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("settings:adminPanel.manage.deleteConfirmDescription", {
                email: user.email,
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogClose render={<Button variant="outline" />}>
              {t("common:actions.cancel")}
            </AlertDialogClose>
            <Button
              variant="destructive"
              disabled={remove.isPending}
              onClick={() =>
                run(
                  () => remove.mutateAsync(user.id),
                  t("settings:adminPanel.manage.deleted"),
                ).then((done) => {
                  setConfirmDelete(false);
                  if (done) onClose();
                })
              }
            >
              {t("settings:adminPanel.manage.deleteUser")}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
