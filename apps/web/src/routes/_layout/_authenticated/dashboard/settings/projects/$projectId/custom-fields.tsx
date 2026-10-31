import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import PageTitle from "@/components/page-title";
import CustomFieldsSettings from "@/components/project/custom-fields/custom-fields-settings";

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/settings/projects/$projectId/custom-fields",
)({
  component: RouteComponent,
});

function RouteComponent() {
  const { t } = useTranslation();
  const { projectId } = Route.useParams();

  return (
    <>
      <PageTitle title={t("settings:projectCustomFields.pageTitle")} />
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold">
            {t("settings:projectCustomFields.title")}
          </h1>
          <p className="text-muted-foreground">
            {t("settings:projectCustomFields.subtitle")}
          </p>
        </div>
        <CustomFieldsSettings projectId={projectId} />
      </div>
    </>
  );
}
