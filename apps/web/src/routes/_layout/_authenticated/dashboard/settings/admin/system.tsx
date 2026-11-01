import { createFileRoute } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import PageTitle from "@/components/page-title";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Frame, FramePanel } from "@/components/ui/frame";
import useSendAdminTestEmail from "@/hooks/mutations/admin/use-send-admin-test-email";
import useVerifyAdminSmtp from "@/hooks/mutations/admin/use-verify-admin-smtp";
import useAdminSystemStatus from "@/hooks/queries/admin/use-admin-system-status";
import { formatUptime } from "@/lib/admin/format-uptime";
import { toast } from "@/lib/toast";

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/settings/admin/system",
)({
  component: RouteComponent,
});

type ServiceStatus = "ok" | "down" | "not_configured";

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right">{children}</span>
    </div>
  );
}

function RouteComponent() {
  const { t } = useTranslation();
  const { data, isLoading } = useAdminSystemStatus();
  const verify = useVerifyAdminSmtp();
  const testEmail = useSendAdminTestEmail();

  const statusBadge = (status: ServiceStatus) => (
    <Badge
      variant={
        status === "ok" ? "success" : status === "down" ? "error" : "secondary"
      }
    >
      {t(`settings:adminPanel.system.status.${status}`)}
    </Badge>
  );

  const runVerify = async () => {
    try {
      const result = await verify.mutateAsync();
      if (result.status === "ok") {
        toast.success(t("settings:adminPanel.system.smtpOk"));
      } else if (result.status === "not_configured") {
        toast.error(t("settings:adminPanel.system.smtpNotConfigured"));
      } else {
        toast.error(
          t("settings:adminPanel.system.smtpFailed", {
            code: [result.code, result.responseCode].filter(Boolean).join(" "),
          }),
        );
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    }
  };

  const runTestEmail = async () => {
    try {
      const result = await testEmail.mutateAsync();
      toast.success(
        t("settings:adminPanel.system.testEmailSent", { email: result.to }),
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    }
  };

  return (
    <>
      <PageTitle title={t("settings:adminPanel.system.title")} />
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">
            {t("settings:adminPanel.system.title")}
          </h1>
          <p className="text-muted-foreground">
            {t("settings:adminPanel.system.subtitle")}
          </p>
        </div>

        {isLoading || !data ? (
          <Frame>
            <FramePanel className="p-8">
              <p className="text-sm text-muted-foreground text-center">
                {t("settings:adminPanel.loading")}
              </p>
            </FramePanel>
          </Frame>
        ) : (
          <>
            <Frame>
              <FramePanel className="divide-y divide-border px-4 py-2">
                <Row label={t("settings:adminPanel.system.version")}>
                  {data.version ?? "-"}
                </Row>
                <Row label={t("settings:adminPanel.system.node")}>
                  {data.nodeVersion}
                </Row>
                <Row label={t("settings:adminPanel.system.uptime")}>
                  {formatUptime(data.uptimeSeconds)}
                </Row>
              </FramePanel>
            </Frame>

            <Frame>
              <FramePanel className="divide-y divide-border px-4 py-2">
                <Row label={t("settings:adminPanel.system.database")}>
                  <span className="inline-flex items-center gap-2">
                    {data.database.latencyMs !== null && (
                      <span className="text-xs text-muted-foreground">
                        {data.database.latencyMs} ms
                      </span>
                    )}
                    {statusBadge(data.database.status)}
                  </span>
                </Row>
                <Row label={t("settings:adminPanel.system.migrations")}>
                  {data.database.migrationsApplied ?? "-"}
                </Row>
                <Row label={t("settings:adminPanel.system.redis")}>
                  {statusBadge(data.redis.status)}
                </Row>
                <Row label={t("settings:adminPanel.system.storage")}>
                  {data.storage.s3Configured
                    ? t("settings:adminPanel.system.storageS3", {
                        driver: data.storage.documentDriver,
                      })
                    : data.storage.documentDriver}
                </Row>
              </FramePanel>
            </Frame>

            <Frame>
              <FramePanel className="space-y-3 p-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h2 className="text-sm font-medium">
                      {t("settings:adminPanel.system.email")}
                    </h2>
                    <p className="text-xs text-muted-foreground">
                      {data.email.configured
                        ? t("settings:adminPanel.system.emailConfigured", {
                            host: data.email.host ?? "",
                          })
                        : t("settings:adminPanel.system.smtpNotConfigured")}
                    </p>
                  </div>
                  {statusBadge(data.email.configured ? "ok" : "not_configured")}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!data.email.configured || verify.isPending}
                    onClick={runVerify}
                  >
                    {t("settings:adminPanel.system.verifySmtp")}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!data.email.configured || testEmail.isPending}
                    onClick={runTestEmail}
                  >
                    {t("settings:adminPanel.system.sendTestEmail")}
                  </Button>
                </div>
              </FramePanel>
            </Frame>
          </>
        )}
      </div>
    </>
  );
}
