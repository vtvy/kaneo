import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import PageTitle from "@/components/page-title";
import { Button } from "@/components/ui/button";
import { Frame, FramePanel } from "@/components/ui/frame";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { AdminSettings } from "@/fetchers/admin/get-admin-settings";
import type { UpdateAdminSettingsRequest } from "@/fetchers/admin/update-admin-settings";
import useUpdateAdminSettings from "@/hooks/mutations/admin/use-update-admin-settings";
import useAdminSettings from "@/hooks/queries/admin/use-admin-settings";
import { toast } from "@/lib/toast";

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/settings/admin/settings",
)({
  component: RouteComponent,
});

type ToggleKey =
  | "registrationEnabled"
  | "passwordRegistrationEnabled"
  | "requireEmailVerification"
  | "workspaceCreationRestricted";

const TOGGLES: ToggleKey[] = [
  "registrationEnabled",
  "passwordRegistrationEnabled",
  "requireEmailVerification",
  "workspaceCreationRestricted",
];

const ENV_VARIABLES: Record<ToggleKey, string> = {
  registrationEnabled: "DISABLE_REGISTRATION",
  passwordRegistrationEnabled: "DISABLE_PASSWORD_REGISTRATION",
  requireEmailVerification: "REQUIRE_EMAIL_VERIFICATION",
  workspaceCreationRestricted: "DISABLE_WORKSPACE_CREATION",
};

function SettingRow({
  label,
  hint,
  checked,
  disabled,
  onCheckedChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  disabled?: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <div className="space-y-0.5">
        <Label className="text-sm font-medium">{label}</Label>
        {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      </div>
      <Switch
        checked={checked}
        disabled={disabled}
        onCheckedChange={onCheckedChange}
      />
    </div>
  );
}

function RouteComponent() {
  const { t } = useTranslation();
  const { data, isLoading } = useAdminSettings();
  const update = useUpdateAdminSettings();
  const [instanceName, setInstanceName] = useState("");

  useEffect(() => {
    setInstanceName(data?.instanceName ?? "");
  }, [data?.instanceName]);

  const save = async (json: UpdateAdminSettingsRequest) => {
    try {
      await update.mutateAsync(json);
      toast.success(t("settings:adminPanel.instanceSettings.saved"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    }
  };

  const toggleHint = (settings: AdminSettings, key: ToggleKey) => {
    if (settings.lockedByEnv.includes(key)) {
      return t("settings:adminPanel.instanceSettings.lockedByEnv", {
        variable: ENV_VARIABLES[key],
      });
    }
    if (
      key === "requireEmailVerification" &&
      !settings.emailDeliveryConfigured
    ) {
      return t("settings:adminPanel.instanceSettings.needsSmtp");
    }
    return t(`settings:adminPanel.instanceSettings.${key}Hint`);
  };

  return (
    <>
      <PageTitle title={t("settings:adminPanel.instanceSettings.title")} />
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">
            {t("settings:adminPanel.instanceSettings.title")}
          </h1>
          <p className="text-muted-foreground">
            {t("settings:adminPanel.instanceSettings.subtitle")}
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
              <FramePanel className="space-y-2 p-4">
                <Label htmlFor="instance-name" className="text-sm font-medium">
                  {t("settings:adminPanel.instanceSettings.instanceName")}
                </Label>
                <p className="text-xs text-muted-foreground">
                  {t("settings:adminPanel.instanceSettings.instanceNameHint")}
                </p>
                <form
                  className="flex gap-2"
                  onSubmit={(event) => {
                    event.preventDefault();
                    save({ instanceName: instanceName.trim() || null });
                  }}
                >
                  <Input
                    id="instance-name"
                    value={instanceName}
                    maxLength={60}
                    placeholder="Kaneo"
                    onChange={(event) => setInstanceName(event.target.value)}
                  />
                  <Button
                    type="submit"
                    disabled={
                      update.isPending ||
                      instanceName.trim() === (data.instanceName ?? "")
                    }
                  >
                    {t("settings:adminPanel.instanceSettings.save")}
                  </Button>
                </form>
              </FramePanel>
            </Frame>

            <Frame>
              <FramePanel className="divide-y divide-border px-4">
                {TOGGLES.map((key) => (
                  <SettingRow
                    key={key}
                    label={t(`settings:adminPanel.instanceSettings.${key}`)}
                    hint={toggleHint(data, key)}
                    checked={data[key]}
                    disabled={
                      update.isPending ||
                      data.lockedByEnv.includes(key) ||
                      (key === "requireEmailVerification" &&
                        !data.emailDeliveryConfigured &&
                        !data[key])
                    }
                    onCheckedChange={(checked) => save({ [key]: checked })}
                  />
                ))}
              </FramePanel>
            </Frame>

            <Frame>
              <FramePanel className="px-4 py-2">
                <h2 className="py-2 text-sm font-medium">
                  {t("settings:adminPanel.instanceSettings.integrations")}
                </h2>
                <p className="pb-2 text-xs text-muted-foreground">
                  {t("settings:adminPanel.instanceSettings.integrationsHint")}
                </p>
                <div className="divide-y divide-border">
                  {data.integrationTypes.map((type) => {
                    const enabled = !data.disabledIntegrations.includes(type);
                    return (
                      <SettingRow
                        key={type}
                        label={t(
                          `settings:adminPanel.instanceSettings.integrationNames.${type}`,
                          { defaultValue: type },
                        )}
                        checked={enabled}
                        disabled={update.isPending}
                        onCheckedChange={(checked) =>
                          save({
                            disabledIntegrations: (checked
                              ? data.disabledIntegrations.filter(
                                  (item) => item !== type,
                                )
                              : [
                                  ...data.disabledIntegrations,
                                  type,
                                ]) as NonNullable<
                              UpdateAdminSettingsRequest["disabledIntegrations"]
                            >,
                          })
                        }
                      />
                    );
                  })}
                </div>
              </FramePanel>
            </Frame>
          </>
        )}
      </div>
    </>
  );
}
