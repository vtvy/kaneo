import { createFileRoute } from "@tanstack/react-router";
import { Plus, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { CreateUserDialog } from "@/components/admin/create-user-dialog";
import { ManageUserDialog } from "@/components/admin/manage-user-dialog";
import PageTitle from "@/components/page-title";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Frame, FramePanel } from "@/components/ui/frame";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { AdminUser } from "@/fetchers/admin/list-admin-users";
import useAdminUsers from "@/hooks/queries/admin/use-admin-users";

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/settings/admin/users",
)({
  component: RouteComponent,
});

const PAGE_SIZE = 25;

type RoleFilter = "all" | "admin" | "user";
type StatusFilter = "all" | "active" | "banned";

function formatDate(value: string | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(
    new Date(value),
  );
}

function RouteComponent() {
  const { t } = useTranslation();
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [role, setRole] = useState<RoleFilter>("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timeout);
  }, [searchInput]);

  const { data, isLoading } = useAdminUsers({
    search: search || undefined,
    role: role === "all" ? undefined : role,
    status: status === "all" ? undefined : status,
    page: String(page),
    limit: String(PAGE_SIZE),
  });
  const users = data?.users ?? [];
  const total = data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const selected: AdminUser | null =
    users.find((user) => user.id === selectedId) ?? null;

  const roleOptions: Record<RoleFilter, string> = {
    all: t("settings:adminPanel.filters.allRoles"),
    admin: t("settings:adminPanel.roles.admin"),
    user: t("settings:adminPanel.roles.user"),
  };
  const statusOptions: Record<StatusFilter, string> = {
    all: t("settings:adminPanel.filters.allStatuses"),
    active: t("settings:adminPanel.status.active"),
    banned: t("settings:adminPanel.status.banned"),
  };

  return (
    <>
      <PageTitle title={t("settings:adminPanel.users")} />
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold">
              {t("settings:adminPanel.users")}
            </h1>
            <p className="text-muted-foreground">
              {t("settings:adminPanel.usersSubtitle")}
            </p>
          </div>
          <Button onClick={() => setCreateOpen(true)} className="gap-2">
            <Plus className="size-4" />
            {t("settings:adminPanel.createUser.title")}
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-8"
              placeholder={t("settings:adminPanel.filters.searchPlaceholder")}
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
          </div>
          <Select
            value={role}
            onValueChange={(value) => {
              setRole(value as RoleFilter);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-40">
              <SelectValue>{roleOptions[role]}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {Object.entries(roleOptions).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={status}
            onValueChange={(value) => {
              setStatus(value as StatusFilter);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-40">
              <SelectValue>{statusOptions[status]}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {Object.entries(statusOptions).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {isLoading || users.length === 0 ? (
          <Frame>
            <FramePanel className="p-8">
              <p className="text-sm text-muted-foreground text-center">
                {isLoading
                  ? t("settings:adminPanel.loading")
                  : t("settings:adminPanel.noUsers")}
              </p>
            </FramePanel>
          </Frame>
        ) : (
          <Frame>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("settings:adminPanel.columns.user")}</TableHead>
                  <TableHead>{t("settings:adminPanel.columns.role")}</TableHead>
                  <TableHead>
                    {t("settings:adminPanel.columns.status")}
                  </TableHead>
                  <TableHead>
                    {t("settings:adminPanel.columns.lastActive")}
                  </TableHead>
                  <TableHead>
                    {t("settings:adminPanel.columns.created")}
                  </TableHead>
                  <TableHead className="w-[100px] text-right" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <p className="font-medium">{user.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {user.email}
                      </p>
                    </TableCell>
                    <TableCell>
                      {user.role === "admin" ? (
                        <Badge variant="info">
                          {t("settings:adminPanel.roles.admin")}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">
                          {t("settings:adminPanel.roles.user")}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      {user.banned ? (
                        <Badge variant="error">
                          {t("settings:adminPanel.status.banned")}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">
                          {t("settings:adminPanel.status.active")}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(user.lastActiveAt)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(user.createdAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedId(user.id)}
                      >
                        {t("settings:adminPanel.manage.open")}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Frame>
        )}

        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>{t("settings:adminPanel.totalUsers", { count: total })}</span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
            >
              {t("settings:adminPanel.previous")}
            </Button>
            <span>
              {t("settings:adminPanel.pageOf", { page, count: pageCount })}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= pageCount}
              onClick={() => setPage(page + 1)}
            >
              {t("settings:adminPanel.next")}
            </Button>
          </div>
        </div>
      </div>

      <CreateUserDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
      />
      <ManageUserDialog
        key={selected?.id}
        user={selected}
        onClose={() => setSelectedId(null)}
      />
    </>
  );
}
