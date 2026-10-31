import { Link, useCanGoBack, useRouter } from "@tanstack/react-router";
import { ArrowLeft, Home, MapPinOff } from "lucide-react";
import { useTranslation } from "react-i18next";
import PageTitle from "@/components/page-title";
import { Button } from "@/components/ui/button";

export function NotFound() {
  const { t } = useTranslation();
  const router = useRouter();
  const canGoBack = useCanGoBack();

  return (
    <main className="flex min-h-svh w-full items-center justify-center bg-sidebar p-6">
      <PageTitle title={t("common:notFound.title")} />
      <section className="w-full max-w-md rounded-xl border border-border/80 bg-background p-8 shadow-sm sm:p-10">
        <div className="mb-6 flex items-center gap-3 text-muted-foreground">
          <MapPinOff className="size-5" aria-hidden="true" />
          <span className="font-mono text-sm">404</span>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {t("common:notFound.title")}
        </h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          {t("common:notFound.description")}
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button render={<Link to="/dashboard" replace />}>
            <Home className="size-4" aria-hidden="true" />
            {t("common:notFound.home")}
          </Button>
          {canGoBack && (
            <Button variant="outline" onClick={() => router.history.back()}>
              <ArrowLeft className="size-4" aria-hidden="true" />
              {t("common:notFound.back")}
            </Button>
          )}
        </div>
      </section>
    </main>
  );
}
