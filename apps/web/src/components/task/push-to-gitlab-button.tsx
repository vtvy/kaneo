import { Gitlab } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { usePushTaskToGitlab } from "@/hooks/mutations/task/use-push-task-to-gitlab";
import useExternalLinks from "@/hooks/queries/external-link/use-external-links";
import useGetGitlabIntegration from "@/hooks/queries/gitlab-integration/use-get-gitlab-integration";
import { toast } from "@/lib/toast";

type PushToGitlabButtonProps = {
  taskId: string;
  projectId: string;
};

export default function PushToGitlabButton({
  taskId,
  projectId,
}: PushToGitlabButtonProps) {
  const { t } = useTranslation();
  const { data: integration, isLoading: integrationLoading } =
    useGetGitlabIntegration(projectId);
  const { data: externalLinks = [], isLoading: linksLoading } =
    useExternalLinks(taskId);
  const { mutateAsync, isPending } = usePushTaskToGitlab(taskId);

  const hasGitlabIssue = externalLinks.some(
    (link) =>
      link.resourceType === "issue" &&
      (link.integration?.type === "gitlab" ||
        link.metadata?.createdFrom === "gitlab" ||
        link.metadata?.createdFrom === "gitlab-import"),
  );

  if (integrationLoading || linksLoading) {
    return null;
  }

  if (!integration?.isActive || hasGitlabIssue) {
    return null;
  }

  const handlePush = async () => {
    try {
      const result = await mutateAsync();
      toast.success(
        result.created
          ? t("tasks:gitlab.pushSuccess")
          : t("tasks:gitlab.pushAlreadyLinked"),
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("tasks:gitlab.pushError"),
      );
    }
  };

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="h-7 gap-1.5 text-xs"
      disabled={isPending}
      onClick={handlePush}
    >
      <Gitlab className="size-3.5" />
      {isPending ? t("tasks:gitlab.pushing") : t("tasks:gitlab.pushToGitlab")}
    </Button>
  );
}
