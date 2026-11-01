import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import useCreateWorkspace from "@/hooks/queries/workspace/use-create-workspace";
import { useCanCreateWorkspace } from "@/hooks/use-can-create-workspace";
import { authClient } from "@/lib/auth-client";
import { createStarterProject } from "@/lib/onboarding/create-starter-project";
import { starterTasks } from "@/lib/onboarding/starter-tasks";
import { toast } from "@/lib/toast";

type CreateWorkspaceModalProps = {
  open: boolean;
  onClose: () => void;
};

function CreateWorkspaceModal({ open, onClose }: CreateWorkspaceModalProps) {
  const { t } = useTranslation();
  const canCreateWorkspace = useCanCreateWorkspace();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [projectName, setProjectName] = useState(() =>
    t("auth:onboarding.projectNameDefault"),
  );
  const inputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { mutateAsync } = useCreateWorkspace();

  useEffect(() => {
    if (open && inputRef.current) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [open]);

  const handleClose = () => {
    setName("");
    setDescription("");
    setProjectName(t("auth:onboarding.projectNameDefault"));
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canCreateWorkspace || !name.trim() || !projectName.trim()) return;

    try {
      const createdWorkspace = await mutateAsync({ name, description });
      toast.success(t("common:modals.createWorkspace.successToast"));
      await queryClient.invalidateQueries({ queryKey: ["workspaces"] });

      await authClient.organization.setActive({
        organizationId: createdWorkspace.id,
      });
      await createStarterProject({
        workspaceId: createdWorkspace.id,
        name: projectName.trim() || t("auth:onboarding.projectNameDefault"),
        tasks: starterTasks(t, "team"),
      }).catch(() => null);
      await queryClient.invalidateQueries({ queryKey: ["projects"] });

      navigate({
        to: "/dashboard/workspace/$workspaceId",
        params: {
          workspaceId: createdWorkspace.id,
        },
      });

      handleClose();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("common:modals.createWorkspace.errorToast"),
      );
    }
  };

  if (!canCreateWorkspace) return null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle asChild>
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem className="text-muted-foreground font-semibold tracking-wider text-sm">
                  {t("common:modals.createWorkspace.breadcrumbKaneo")}
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem className="text-foreground font-medium text-sm">
                  {t("common:modals.createWorkspace.title")}
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </DialogTitle>
          <DialogDescription className="sr-only">
            {t("common:modals.createWorkspace.description")}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4 px-6">
            <Input
              ref={inputRef}
              unstyled
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("common:modals.createWorkspace.namePlaceholder")}
              className="w-full [&_[data-slot=input]]:h-auto [&_[data-slot=input]]:px-0 [&_[data-slot=input]]:py-2 [&_[data-slot=input]]:text-2xl [&_[data-slot=input]]:leading-tight [&_[data-slot=input]]:font-semibold [&_[data-slot=input]]:tracking-tight [&_[data-slot=input]]:text-foreground [&_[data-slot=input]]:placeholder:text-muted-foreground [&_[data-slot=input]]:outline-none"
              required
            />

            <Input
              unstyled
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t(
                "common:modals.createWorkspace.descriptionPlaceholder",
              )}
              className="w-full [&_[data-slot=input]]:h-auto [&_[data-slot=input]]:px-0 [&_[data-slot=input]]:py-2 [&_[data-slot=input]]:text-base [&_[data-slot=input]]:leading-relaxed [&_[data-slot=input]]:text-foreground [&_[data-slot=input]]:placeholder:text-muted-foreground [&_[data-slot=input]]:outline-none"
            />
            <div className="space-y-1">
              <Input
                unstyled
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder={t("auth:onboarding.projectName")}
                aria-label={t("auth:onboarding.projectName")}
                className="w-full [&_[data-slot=input]]:h-auto [&_[data-slot=input]]:px-0 [&_[data-slot=input]]:py-2 [&_[data-slot=input]]:text-base [&_[data-slot=input]]:leading-relaxed [&_[data-slot=input]]:text-foreground [&_[data-slot=input]]:placeholder:text-muted-foreground [&_[data-slot=input]]:outline-none"
                required
              />
              <p className="text-muted-foreground text-xs">
                {t("auth:onboarding.projectNameHint")}
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              onClick={handleClose}
              variant="outline"
              size="sm"
              className="border-border text-foreground hover:bg-accent"
            >
              {t("common:actions.cancel")}
            </Button>
            <Button
              type="submit"
              disabled={!name.trim() || !projectName.trim()}
              size="sm"
              className="disabled:opacity-50"
            >
              {t("common:modals.createWorkspace.createButton")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default CreateWorkspaceModal;
