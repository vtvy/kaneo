import { useRouter } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";

export function SessionConnectionError({ reset }: { reset: () => void }) {
  const { t } = useTranslation();
  const router = useRouter();

  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6">
      <div className="max-w-md space-y-4 text-center" role="alert">
        <h1 className="text-lg font-semibold">{t("common:error.title")}</h1>
        <p className="text-sm text-muted-foreground">
          {t("auth:signIn.instanceStatusError")}
        </p>
        <Button onClick={() => void router.invalidate().then(reset)}>
          {t("common:error.tryAgain")}
        </Button>
      </div>
    </div>
  );
}
