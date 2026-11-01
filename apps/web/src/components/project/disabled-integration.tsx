import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";

export function DisabledIntegration({
  connected,
  pending,
  onDisconnect,
}: {
  connected: boolean;
  pending: boolean;
  onDisconnect: () => Promise<void>;
}) {
  const { t } = useTranslation();
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        {t("settings:projectIntegrations.disabledByAdmin")}
      </p>
      {connected && (
        <Button
          type="button"
          variant="destructive-outline"
          disabled={pending}
          onClick={onDisconnect}
        >
          {t("settings:projectIntegrations.disconnect")}
        </Button>
      )}
    </div>
  );
}
