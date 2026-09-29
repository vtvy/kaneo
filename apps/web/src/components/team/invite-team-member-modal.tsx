import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { z } from "zod/v4";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import useInviteWorkspaceUser from "@/hooks/mutations/workspace-user/use-invite-workspace-user";
import useActiveWorkspace from "@/hooks/queries/workspace/use-active-workspace";
import useSearchUserDirectory from "@/hooks/queries/workspace-users/use-search-user-directory";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";
import { cn } from "@/lib/cn";
import { toast } from "@/lib/toast";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogClose,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "../ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "../ui/form";
import { Input } from "../ui/input";

type Props = {
  open: boolean;
  onClose: () => void;
};

const teamMemberSchema = z.object({
  email: z.string().email(),
});

type TeamMemberFormValues = z.infer<typeof teamMemberSchema>;

function initials(name: string, email: string) {
  const source = name.trim() || email;
  return source
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function InviteTeamMemberModal({ open, onClose }: Props) {
  const { t } = useTranslation();
  const { mutateAsync, isPending } = useInviteWorkspaceUser();
  const queryClient = useQueryClient();
  const { data: workspace } = useActiveWorkspace();
  const workspaceId = workspace?.id;
  const { canInviteUsers } = useWorkspacePermission();
  const canInvite = canInviteUsers();

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [listOpen, setListOpen] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search), 200);
    return () => window.clearTimeout(timer);
  }, [search]);

  const trimmedSearch = search.trim();
  const canAutocomplete = trimmedSearch.length >= 1;

  const { data: directoryUsers = [], isFetching } = useSearchUserDirectory(
    open ? workspaceId : undefined,
    debouncedSearch,
  );

  const isSearching = isFetching || trimmedSearch !== debouncedSearch.trim();

  const form = useForm<TeamMemberFormValues>({
    resolver: standardSchemaResolver(teamMemberSchema),
    defaultValues: {
      email: "",
    },
  });

  const selectedEmail = form.watch("email");

  const filteredUsers = useMemo(() => directoryUsers, [directoryUsers]);

  const onSubmit = async ({ email }: TeamMemberFormValues) => {
    if (!workspaceId) {
      toast.error(t("team:inviteModal.error"));
      return;
    }
    if (!canInvite) {
      toast.error(t("team:inviteModal.error"));
      return;
    }
    try {
      await mutateAsync({ email, workspaceId, role: "member" });
      await queryClient.refetchQueries({
        queryKey: ["workspace-users", workspaceId],
      });

      toast.success(t("team:inviteModal.success"));

      resetInviteTeamMember();
      onClose();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("team:inviteModal.error"),
      );
    }
  };

  const resetInviteTeamMember = async () => {
    if (workspaceId) {
      await queryClient.invalidateQueries({
        queryKey: ["workspace-users", workspaceId],
      });
      await queryClient.invalidateQueries({
        queryKey: ["workspace-user-directory", workspaceId],
      });
    }
    form.reset();
    setSearch("");
    setDebouncedSearch("");
    setListOpen(false);
  };

  const resetAndCloseModal = () => {
    void resetInviteTeamMember();
    onClose();
  };

  const pickUser = (email: string) => {
    form.setValue("email", email, { shouldValidate: true, shouldDirty: true });
    setSearch(email);
    setListOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={resetAndCloseModal}>
      <DialogPopup className="w-full max-w-md">
        <DialogHeader>
          <DialogTitle>{t("team:inviteModal.title")}</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="contents">
            <DialogPanel>
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("team:inviteModal.emailLabel")}</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          {...field}
                          value={search || field.value}
                          placeholder={t("team:inviteModal.searchHint")}
                          autoFocus
                          autoComplete="off"
                          onFocus={() => setListOpen(true)}
                          onChange={(e) => {
                            const value = e.target.value;
                            setSearch(value);
                            field.onChange(value);
                            setListOpen(true);
                          }}
                          onBlur={() => {
                            // Delay so click on a suggestion still registers.
                            window.setTimeout(() => setListOpen(false), 150);
                            field.onBlur();
                          }}
                        />
                        {listOpen && canAutocomplete && (
                          <div className="absolute z-50 mt-1 max-h-56 w-full overflow-auto rounded-lg border bg-popover p-1 shadow-md">
                            {isSearching && filteredUsers.length === 0 ? (
                              <p className="px-2 py-1.5 text-muted-foreground text-sm">
                                {t("team:inviteModal.searchLoading")}
                              </p>
                            ) : filteredUsers.length === 0 ? (
                              <p className="px-2 py-1.5 text-muted-foreground text-sm">
                                {t("team:inviteModal.searchEmpty")}
                              </p>
                            ) : (
                              filteredUsers.slice(0, 8).map((user) => {
                                const active =
                                  selectedEmail.trim().toLowerCase() ===
                                  user.email.toLowerCase();
                                return (
                                  <button
                                    key={user.id}
                                    type="button"
                                    className={cn(
                                      "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm outline-none hover:bg-accent hover:text-accent-foreground",
                                      active &&
                                        "bg-accent text-accent-foreground",
                                    )}
                                    onMouseDown={(e) => e.preventDefault()}
                                    onClick={() => pickUser(user.email)}
                                  >
                                    <Avatar className="size-7">
                                      <AvatarImage
                                        src={user.image ?? undefined}
                                        alt={user.name}
                                      />
                                      <AvatarFallback className="text-[10px]">
                                        {initials(user.name, user.email)}
                                      </AvatarFallback>
                                    </Avatar>
                                    <span className="min-w-0 flex-1">
                                      <span className="block truncate font-medium">
                                        {user.name || user.email}
                                      </span>
                                      <span className="block truncate text-muted-foreground text-xs">
                                        {user.email}
                                      </span>
                                    </span>
                                  </button>
                                );
                              })
                            )}
                          </div>
                        )}
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </DialogPanel>

            <DialogFooter>
              <DialogClose
                render={<Button variant="outline" size="sm" type="button" />}
              >
                {t("common:actions.cancel")}
              </DialogClose>
              <Button
                type="submit"
                size="sm"
                disabled={!workspaceId || !canInvite || isPending}
              >
                {t("team:inviteModal.sendInvitation")}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogPopup>
    </Dialog>
  );
}

export default InviteTeamMemberModal;
