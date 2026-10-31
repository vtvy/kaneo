import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import PageTitle from "@/components/page-title";
import { Button } from "@/components/ui/button";
import { Frame, FramePanel } from "@/components/ui/frame";
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
import useAdminAuditLog from "@/hooks/queries/admin/use-admin-audit-log";
import {
  getAuditActionKey,
  getAuditEntryDetail,
} from "@/lib/admin/audit-entry";

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/settings/admin/audit-log",
)({
  component: RouteComponent,
});

const PAGE_SIZE = 50;

const ACTION_FILTERS = [
  "all",
  "user.created",
  "user.role_changed",
  "user.banned",
  "user.unbanned",
  "user.deleted",
  "user.session_revoked",
  "user.sessions_revoked",
  "user.api_key_revoked",
  "user.api_keys_revoked",
] as const;

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function RouteComponent() {
  const { t } = useTranslation();
  const [action, setAction] = useState<(typeof ACTION_FILTERS)[number]>("all");
  const [page, setPage] = useState(1);
  const { data, isLoading } = useAdminAuditLog({
    action: action === "all" ? undefined : action,
    page: String(page),
    limit: String(PAGE_SIZE),
  });
  const entries = data?.entries ?? [];
  const pageCount = Math.max(1, Math.ceil((data?.total ?? 0) / PAGE_SIZE));

  const actionLabel = (value: string) => {
    if (value === "all") return t("settings:adminPanel.auditLog.allActions");
    const key = getAuditActionKey(value);
    return key ? t(key) : value;
  };

  return (
    <>
      <PageTitle title={t("settings:adminPanel.auditLog.title")} />
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">
            {t("settings:adminPanel.auditLog.title")}
          </h1>
          <p className="text-muted-foreground">
            {t("settings:adminPanel.auditLog.subtitle")}
          </p>
        </div>

        <Select
          value={action}
          onValueChange={(value) => {
            setAction(value as (typeof ACTION_FILTERS)[number]);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-64">
            <SelectValue>{actionLabel(action)}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {ACTION_FILTERS.map((value) => (
              <SelectItem key={value} value={value}>
                {actionLabel(value)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {isLoading || entries.length === 0 ? (
          <Frame>
            <FramePanel className="p-8">
              <p className="text-sm text-muted-foreground text-center">
                {isLoading
                  ? t("settings:adminPanel.loading")
                  : t("settings:adminPanel.auditLog.empty")}
              </p>
            </FramePanel>
          </Frame>
        ) : (
          <Frame>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    {t("settings:adminPanel.auditLog.columns.time")}
                  </TableHead>
                  <TableHead>
                    {t("settings:adminPanel.auditLog.columns.actor")}
                  </TableHead>
                  <TableHead>
                    {t("settings:adminPanel.auditLog.columns.action")}
                  </TableHead>
                  <TableHead>
                    {t("settings:adminPanel.auditLog.columns.target")}
                  </TableHead>
                  <TableHead>
                    {t("settings:adminPanel.auditLog.columns.details")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {formatDateTime(entry.createdAt)}
                    </TableCell>
                    <TableCell>
                      <p>
                        {entry.actor.name ??
                          t("settings:adminPanel.auditLog.deletedActor")}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {entry.actor.email ?? ""}
                        {entry.ipAddress ? ` · ${entry.ipAddress}` : ""}
                      </p>
                    </TableCell>
                    <TableCell>{actionLabel(entry.action)}</TableCell>
                    <TableCell>{entry.targetLabel ?? entry.targetId}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {getAuditEntryDetail(entry.metadata)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Frame>
        )}

        <div className="flex items-center justify-end gap-2 text-sm text-muted-foreground">
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
    </>
  );
}
