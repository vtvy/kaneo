import { createFileRoute, useParams } from "@tanstack/react-router";
import {
  EllipsisIcon,
  ShieldIcon,
  TrashIcon,
  UserPlusIcon,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import PageTitle from "@/components/page-title";
import { useAuth } from "@/components/providers/auth-provider/hooks/use-auth";
import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Menu, MenuItem, MenuPopup, MenuTrigger } from "@/components/ui/menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import useAddProjectMember from "@/hooks/mutations/project-rbac/use-add-project-member";
import useAssignMemberRoles from "@/hooks/mutations/project-rbac/use-assign-member-roles";
import useRemoveProjectMember from "@/hooks/mutations/project-rbac/use-remove-project-member";
import useProjectMembers from "@/hooks/queries/project-rbac/use-project-members";
import useProjectRoles from "@/hooks/queries/project-rbac/use-project-roles";
import useSearchProjectUserDirectory from "@/hooks/queries/project-rbac/use-search-project-user-directory";
import { useProjectPermission } from "@/hooks/use-project-permission";
import { cn } from "@/lib/cn";
import { toast } from "@/lib/toast";

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/settings/projects/$projectId/members",
)({
  component: RouteComponent,
});

type ProjectMember = {
  id: string;
  userId: string;
  userName: string | null;
  userEmail: string;
  userImage: string | null;
  roles: { id: string; name: string; isSystem: boolean }[];
};

type ProjectRole = {
  id: string;
  name: string;
  isSystem: boolean;
};

const AVATAR_TONES = [
  "bg-rose-500/15 text-rose-600 dark:text-rose-300",
  "bg-amber-500/15 text-amber-600 dark:text-amber-300",
  "bg-sky-500/15 text-sky-600 dark:text-sky-300",
  "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300",
  "bg-violet-500/15 text-violet-600 dark:text-violet-300",
  "bg-indigo-500/15 text-indigo-600 dark:text-indigo-300",
] as const;

function toneFor(value: string): string {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return AVATAR_TONES[Math.abs(hash) % AVATAR_TONES.length];
}

function initials(value: string | null | undefined): string {
  if (!value) return "?";
  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function RouteComponent() {
  const { projectId: rawProjectId } = useParams({ strict: false });
  const projectId = rawProjectId ?? "";

  const { t } = useTranslation("settings");
  const { user: currentUser } = useAuth();
  const { can, isCheckingPermissions } = useProjectPermission(projectId);
  const canManage = !isCheckingPermissions && can("member", "manage");

  const { data: rawMembers = [], isLoading: isLoadingMembers } =
    useProjectMembers(projectId);
  const members = rawMembers as ProjectMember[];

  const { data: rawRoles = [] } = useProjectRoles(projectId);
  const roles = rawRoles as ProjectRole[];

  const { mutateAsync: addMember, isPending: isAdding } =
    useAddProjectMember(projectId);
  const { mutateAsync: assignRoles, isPending: isAssigning } =
    useAssignMemberRoles(projectId);
  const { mutateAsync: removeMember, isPending: isRemoving } =
    useRemoveProjectMember(projectId);

  // Add Member dialog state
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [debouncedEmail, setDebouncedEmail] = useState("");
  const [listOpen, setListOpen] = useState(false);
  const [selectedRoleId, setSelectedRoleId] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedEmail(inviteEmail), 200);
    return () => window.clearTimeout(timer);
  }, [inviteEmail]);

  const trimmedEmail = inviteEmail.trim();
  const canAutocomplete = trimmedEmail.length >= 1;
  const { data: directoryUsers = [], isFetching: isSearchingDirectory } =
    useSearchProjectUserDirectory(
      addDialogOpen ? projectId : undefined,
      debouncedEmail,
    );
  const isSearching =
    isSearchingDirectory || trimmedEmail !== debouncedEmail.trim();

  // Remove confirm state
  const [memberToRemove, setMemberToRemove] = useState<ProjectMember | null>(
    null,
  );

  const nonSystemRoles = roles.filter((r) => !r.isSystem);
  const selectedRole = nonSystemRoles.find((r) => r.id === selectedRoleId);
  const selectedRoleLabel = selectedRole?.name ?? null;

  const resetDialog = () => {
    setInviteEmail("");
    setDebouncedEmail("");
    setListOpen(false);
    setSelectedRoleId("");
  };

  const pickUser = (email: string) => {
    setInviteEmail(email);
    setDebouncedEmail(email);
    setListOpen(false);
  };

  const handleAddMember = async () => {
    const email = inviteEmail.trim();
    if (!isValidEmail(email)) {
      toast.error(t("projectMembers.addDialog.emailInvalid"));
      return;
    }
    const roleName = selectedRole?.name;
    try {
      await addMember({ email, roleNames: roleName ? [roleName] : [] });
      toast.success(t("projectMembers.toast.added"));
      setAddDialogOpen(false);
      resetDialog();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("projectMembers.toast.addError"),
      );
    }
  };

  const handleChangeRole = async (member: ProjectMember, roleId: string) => {
    try {
      await assignRoles({ memberId: member.id, roleIds: [roleId] });
      toast.success(t("projectMembers.toast.roleUpdated"));
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("projectMembers.toast.roleUpdateError"),
      );
    }
  };

  const handleRemoveMember = async () => {
    if (!memberToRemove) return;
    try {
      await removeMember(memberToRemove.id);
      toast.success(t("projectMembers.toast.removed"));
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("projectMembers.toast.removeError"),
      );
    } finally {
      setMemberToRemove(null);
    }
  };

  const isOwnerRole = (member: ProjectMember) =>
    member.roles.some((r) => r.isSystem);

  return (
    <>
      <PageTitle title={t("projectMembers.pageTitle")} />
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold">
              {t("projectMembers.title")}
            </h1>
            <p className="text-muted-foreground">
              {t("projectMembers.subtitle")}
            </p>
          </div>
          {canManage && (
            <Button size="sm" onClick={() => setAddDialogOpen(true)}>
              <UserPlusIcon className="mr-2 size-4" />
              {t("projectMembers.addMember")}
            </Button>
          )}
        </div>

        <div className="border border-border rounded-md bg-sidebar overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="ps-6 text-foreground font-medium">
                  {t("projectMembers.memberColumn")}
                </TableHead>
                <TableHead className="text-foreground font-medium">
                  {t("projectMembers.roleColumn")}
                </TableHead>
                <TableHead className="w-px pe-6" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoadingMembers ? (
                <TableRow>
                  <TableCell
                    colSpan={3}
                    className="py-12 text-center text-sm text-muted-foreground"
                  >
                    {t("projectMembers.loading")}
                  </TableCell>
                </TableRow>
              ) : members.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="py-12 text-center">
                    <p className="text-sm font-medium text-foreground">
                      {t("projectMembers.noMembers")}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {t("projectMembers.noMembersHint")}
                    </p>
                  </TableCell>
                </TableRow>
              ) : (
                members.map((member) => {
                  const isSelf = currentUser?.id === member.userId;
                  const isOwner = isOwnerRole(member);
                  const currentRoleId = member.roles[0]?.id ?? "";
                  const tone = toneFor(member.userEmail);
                  const showRoleSelect = canManage && !isOwner;
                  const showRemove = canManage && !isOwner && !isSelf;

                  return (
                    <TableRow key={member.id}>
                      <TableCell className="ps-6 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar className={cn("size-8", tone)}>
                            <AvatarImage
                              src={member.userImage ?? ""}
                              alt={member.userName ?? ""}
                            />
                            <AvatarFallback className="bg-transparent text-[11px] font-medium">
                              {initials(member.userName)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium">
                                {member.userName}
                              </span>
                              {isSelf && (
                                <span className="text-xs text-muted-foreground">
                                  {t("projectMembers.you")}
                                </span>
                              )}
                            </div>
                            <div className="truncate text-xs text-muted-foreground">
                              {member.userEmail}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="py-3">
                        {isOwner ? (
                          <Badge variant="outline" className="gap-1">
                            <ShieldIcon className="size-3" />
                            {member.roles[0]?.name ?? "Owner"}
                          </Badge>
                        ) : showRoleSelect ? (
                          <Select
                            value={currentRoleId}
                            onValueChange={(roleId) => {
                              if (roleId) handleChangeRole(member, roleId);
                            }}
                            disabled={isAssigning}
                          >
                            <SelectTrigger size="sm" className="h-8 w-36">
                              <SelectValue>
                                {member.roles[0]?.name ?? "—"}
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              {nonSystemRoles.map((r) => (
                                <SelectItem key={r.id} value={r.id}>
                                  {r.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <Badge variant="secondary">
                            {member.roles[0]?.name ?? "—"}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="pe-6 py-3 text-right">
                        {showRemove ? (
                          <Menu>
                            <MenuTrigger
                              render={
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-muted-foreground"
                                  aria-label="Member options"
                                />
                              }
                            >
                              <EllipsisIcon className="size-4" />
                            </MenuTrigger>
                            <MenuPopup align="end">
                              <MenuItem
                                onClick={() => setMemberToRemove(member)}
                              >
                                <TrashIcon className="size-4" />
                                {t("projectMembers.removeMenu")}
                              </MenuItem>
                            </MenuPopup>
                          </Menu>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Add Member Dialog */}
      <Dialog
        open={addDialogOpen}
        onOpenChange={(open) => {
          setAddDialogOpen(open);
          if (!open) resetDialog();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("projectMembers.addDialog.title")}</DialogTitle>
            <DialogDescription>
              {t("projectMembers.addDialog.description")}
            </DialogDescription>
          </DialogHeader>
          <DialogPanel className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="invite-email">
                {t("projectMembers.addDialog.emailLabel")}
              </Label>
              <div className="space-y-1">
                <Input
                  id="invite-email"
                  type="text"
                  inputMode="email"
                  autoComplete="off"
                  placeholder={t("projectMembers.addDialog.emailPlaceholder")}
                  value={inviteEmail}
                  onChange={(e) => {
                    setInviteEmail(e.target.value);
                    setListOpen(true);
                  }}
                  onFocus={() => setListOpen(true)}
                  onBlur={() => {
                    window.setTimeout(() => setListOpen(false), 150);
                  }}
                  onKeyDown={(e) => {
                    if (
                      e.nativeEvent.isComposing ||
                      e.nativeEvent.keyCode === 229
                    ) {
                      return;
                    }
                    if (e.key === "Enter") {
                      e.preventDefault();
                      void handleAddMember();
                    }
                  }}
                  autoFocus
                  disabled={isAdding}
                />
                {listOpen && canAutocomplete && (
                  <div className="max-h-44 w-full overflow-auto rounded-lg border bg-popover p-1 shadow-md">
                    {isSearching && directoryUsers.length === 0 ? (
                      <p className="px-2 py-1.5 text-muted-foreground text-sm">
                        {t("projectMembers.addDialog.searchLoading")}
                      </p>
                    ) : directoryUsers.length === 0 ? (
                      <p className="px-2 py-1.5 text-muted-foreground text-sm">
                        {t("projectMembers.addDialog.searchEmpty")}
                      </p>
                    ) : (
                      directoryUsers.map((user) => {
                        const active =
                          inviteEmail.trim().toLowerCase() ===
                          user.email.toLowerCase();
                        return (
                          <button
                            key={user.id}
                            type="button"
                            className={cn(
                              "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm outline-none hover:bg-accent hover:text-accent-foreground",
                              active && "bg-accent text-accent-foreground",
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
                                {initials(user.name || user.email)}
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
            </div>
            <div className="space-y-2">
              <Label>{t("projectMembers.addDialog.roleLabel")}</Label>
              <Select
                value={selectedRoleId}
                onValueChange={(next) => setSelectedRoleId(next ?? "")}
              >
                <SelectTrigger className="w-full">
                  <SelectValue
                    placeholder={t("projectMembers.addDialog.rolePlaceholder")}
                  >
                    {selectedRoleLabel}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {nonSystemRoles.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </DialogPanel>
          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setAddDialogOpen(false);
                resetDialog();
              }}
              disabled={isAdding}
            >
              {t("projectMembers.addDialog.cancel")}
            </Button>
            <Button
              size="sm"
              onClick={handleAddMember}
              disabled={!inviteEmail.trim() || isAdding}
            >
              {isAdding
                ? t("projectMembers.addDialog.adding")
                : t("projectMembers.addDialog.submit")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remove Confirm */}
      <AlertDialog
        open={!!memberToRemove}
        onOpenChange={(open) => !open && setMemberToRemove(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("projectMembers.removeDialog.title")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("projectMembers.removeDialog.description", {
                name: memberToRemove?.userName || memberToRemove?.userEmail,
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogClose disabled={isRemoving}>
              <Button variant="outline" size="sm" disabled={isRemoving}>
                {t("projectMembers.removeDialog.cancel")}
              </Button>
            </AlertDialogClose>
            <AlertDialogClose
              onClick={handleRemoveMember}
              disabled={isRemoving}
            >
              <Button variant="destructive" size="sm" disabled={isRemoving}>
                <TrashIcon className="mr-2 size-4" />
                {isRemoving
                  ? t("projectMembers.removeDialog.removing")
                  : t("projectMembers.removeDialog.confirm")}
              </Button>
            </AlertDialogClose>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
