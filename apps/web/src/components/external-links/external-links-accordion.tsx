import {
  ChevronDown,
  ChevronRight,
  FolderGit,
  Github,
  Gitlab,
  GitMerge,
  GitPullRequest,
  Link2,
  Plus,
  Trash2,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { useCreateExternalLink } from "@/hooks/mutations/external-link/use-create-external-link";
import { useDeleteExternalLink } from "@/hooks/mutations/external-link/use-delete-external-link";
import type { ExternalLink } from "@/types/external-link";

interface ExternalLinksAccordionProps {
  taskId: string;
  externalLinks: ExternalLink[];
  isLoading?: boolean;
  canUpdate?: boolean;
}

function isManualLink(link: ExternalLink) {
  return link.integrationId == null && link.resourceType === "url";
}

function isGiteaResourceLink(link: ExternalLink) {
  if (link.integration?.type === "gitea") {
    return true;
  }
  const from = link.metadata?.createdFrom;
  return from === "gitea" || from === "gitea-import";
}

function isGitlabResourceLink(link: ExternalLink) {
  if (link.integration?.type === "gitlab") {
    return true;
  }
  const from = link.metadata?.createdFrom;
  return from === "gitlab" || from === "gitlab-import";
}

export function ExternalLinksAccordion({
  taskId,
  externalLinks,
  isLoading,
  canUpdate = false,
}: ExternalLinksAccordionProps) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const createLink = useCreateExternalLink(taskId);
  const deleteLink = useDeleteExternalLink(taskId);

  const linksWithoutRedundantBranches = useMemo(() => {
    const hasPR = externalLinks.some(
      (link) => link.resourceType === "pull_request",
    );
    if (hasPR) {
      return externalLinks.filter((link) => link.resourceType !== "branch");
    }
    return externalLinks;
  }, [externalLinks]);

  if (isLoading) return null;
  if (linksWithoutRedundantBranches.length === 0 && !canUpdate) return null;

  function resetForm() {
    setUrl("");
    setTitle("");
    setIsAdding(false);
  }

  async function handleAdd() {
    const trimmed = url.trim();
    let parsed: URL;
    try {
      parsed = new URL(trimmed);
    } catch {
      toast.error(t("settings:externalLinks.invalidUrl"));
      return;
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      toast.error(t("settings:externalLinks.invalidUrl"));
      return;
    }
    try {
      await createLink.mutateAsync({
        url: trimmed,
        title: title.trim() || undefined,
      });
      resetForm();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("settings:externalLinks.addError"),
      );
    }
  }

  const getStatusBadge = (link: ExternalLink) => {
    const isMerged = link.metadata?.merged === true;
    const isDraft = link.metadata?.draft === true;
    const isPR = link.resourceType === "pull_request";
    const isIssue = link.resourceType === "issue";
    const isBranch = link.resourceType === "branch";

    if (isIssue) {
      return (
        <span className="text-xs font-medium text-muted-foreground">
          {t("settings:externalLinks.issue")}
        </span>
      );
    }

    if (isBranch) {
      return (
        <span className="text-xs font-medium text-muted-foreground">
          {t("settings:externalLinks.branch")}
        </span>
      );
    }

    if (!isPR) return null;

    if (isMerged) {
      return (
        <span className="flex items-center gap-1 font-medium text-info-foreground text-xs">
          <GitMerge className="size-3" />
          {t("settings:externalLinks.merged")}
        </span>
      );
    }

    if (isDraft) {
      return (
        <span className="text-xs font-medium text-muted-foreground flex items-center gap-1">
          <GitPullRequest className="size-3" />
          {t("settings:externalLinks.draft")}
        </span>
      );
    }

    return (
      <span className="flex items-center gap-1 font-medium text-success-foreground text-xs">
        <GitPullRequest className="size-3" />
        {t("settings:externalLinks.open")}
      </span>
    );
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="w-full">
      <CollapsibleTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-1 px-0 h-8 hover:bg-transparent"
        >
          {isOpen ? (
            <ChevronDown className="size-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="size-4 text-muted-foreground" />
          )}
          <span className="text-sm text-muted-foreground">
            {t("settings:externalLinks.resources")}
          </span>
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="flex flex-col gap-1.5 mt-2">
          {linksWithoutRedundantBranches.map((link) => (
            <div
              key={link.id}
              className="group flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-accent/50"
            >
              <a
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex min-w-0 flex-1 items-center gap-2"
              >
                {isManualLink(link) ? (
                  <Link2 className="size-4 flex-shrink-0 text-muted-foreground" />
                ) : isGitlabResourceLink(link) ? (
                  <Gitlab className="size-4 flex-shrink-0 text-muted-foreground" />
                ) : isGiteaResourceLink(link) ? (
                  <FolderGit className="size-4 flex-shrink-0 text-muted-foreground" />
                ) : (
                  <Github className="size-4 flex-shrink-0 text-muted-foreground" />
                )}
                <span className="flex-1 truncate text-sm text-foreground/90 group-hover:text-foreground">
                  {link.title || link.url}
                  {link.resourceType !== "branch" &&
                    link.resourceType !== "url" && (
                      <span className="ml-2 text-muted-foreground">
                        #{link.externalId}
                      </span>
                    )}
                </span>
                {getStatusBadge(link)}
              </a>
              {canUpdate && isManualLink(link) && (
                <button
                  type="button"
                  className="text-muted-foreground hover:text-foreground"
                  aria-label={t("settings:externalLinks.remove", {
                    title: link.title || link.url,
                  })}
                  disabled={deleteLink.isPending}
                  onClick={() => {
                    void deleteLink.mutateAsync(link.id).catch((error) => {
                      toast.error(
                        error instanceof Error
                          ? error.message
                          : t("settings:externalLinks.removeError"),
                      );
                    });
                  }}
                >
                  <Trash2 className="size-3.5" />
                </button>
              )}
            </div>
          ))}
          {linksWithoutRedundantBranches.length === 0 && (
            <p className="px-2 text-sm text-muted-foreground">
              {t("settings:externalLinks.empty")}
            </p>
          )}
          {canUpdate && !isAdding && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="justify-start px-2"
              onClick={() => setIsAdding(true)}
            >
              <Plus className="size-3.5" />
              {t("settings:externalLinks.addResource")}
            </Button>
          )}
          {canUpdate && isAdding && (
            <form
              className="flex flex-col gap-2 px-2"
              onSubmit={(event) => {
                event.preventDefault();
                void handleAdd();
              }}
            >
              <Input
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                placeholder={t("settings:externalLinks.url")}
                aria-label={t("settings:externalLinks.url")}
              />
              <Input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder={t("settings:externalLinks.titleOptional")}
                aria-label={t("settings:externalLinks.titleOptional")}
                maxLength={200}
              />
              <div className="flex gap-2">
                <Button type="submit" size="sm" disabled={createLink.isPending}>
                  {createLink.isPending
                    ? t("settings:externalLinks.adding")
                    : t("settings:externalLinks.addResource")}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={resetForm}
                >
                  {t("settings:externalLinks.cancel")}
                </Button>
              </div>
            </form>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
