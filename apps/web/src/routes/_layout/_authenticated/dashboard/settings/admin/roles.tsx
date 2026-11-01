import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  assignInstanceRole,
  listInstanceRoles,
  removeInstanceRole,
  saveInstanceRole,
} from "@/fetchers/admin/instance-management";
import useAdminUsers from "@/hooks/queries/admin/use-admin-users";
import { toast } from "@/lib/toast";

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/settings/admin/roles",
)({ component: RolesPage });

function RolesPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { data, error } = useQuery({
    queryKey: ["admin", "roles"],
    queryFn: listInstanceRoles,
  });
  const [editing, setEditing] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [permissions, setPermissions] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const users = useAdminUsers({ search, role: "user", page: "1", limit: "25" });
  const mutation = useMutation({
    mutationFn: (action: () => Promise<unknown>) => action(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin"] });
    },
    onError: (error) => toast.error(error.message),
  });
  const reset = () => {
    setEditing(null);
    setName("");
    setPermissions([]);
  };
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <h1 className="text-2xl font-semibold">
        {t("settings:adminPanel.customRoles.title")}
      </h1>
      <p className="text-sm text-muted-foreground">
        {t("settings:adminPanel.customRoles.hint")}
      </p>
      {error && <p role="alert">{error.message}</p>}
      <form
        className="space-y-4 rounded-lg border p-4"
        onSubmit={(event) => {
          event.preventDefault();
          mutation.mutate(async () => {
            await saveInstanceRole(editing, name, permissions);
            reset();
          });
        }}
      >
        <Label htmlFor="instance-role-name">
          {t("settings:adminPanel.customRoles.name")}
        </Label>
        <Input
          id="instance-role-name"
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
          pattern="[a-z][a-z0-9-]{1,31}"
          required
          maxLength={32}
        />
        <fieldset className="grid sm:grid-cols-2 gap-3">
          <legend className="mb-3 text-sm">
            {t("settings:adminPanel.customRoles.permissions")}
          </legend>
          {data?.permissions.map((permission) => (
            <Label key={permission} className="flex items-center gap-2">
              <Checkbox
                checked={permissions.includes(permission)}
                onCheckedChange={(checked) =>
                  setPermissions((current) =>
                    checked
                      ? [...current, permission]
                      : current.filter((value) => value !== permission),
                  )
                }
              />
              {t(
                `settings:adminPanel.instancePermissions.${permission.replace(":", "_")}`,
              )}
            </Label>
          ))}
        </fieldset>
        <div className="flex gap-2">
          <Button type="submit" disabled={mutation.isPending || !data}>
            {t("settings:adminPanel.customRoles.save")}
          </Button>
          {editing && (
            <Button type="button" variant="outline" onClick={reset}>
              {t("common:actions.cancel")}
            </Button>
          )}
        </div>
      </form>
      <div className="space-y-2">
        {data?.roles.map((role) => (
          <div
            key={role.id}
            className="flex justify-between items-center rounded-lg border p-3 gap-3"
          >
            <span>
              {role.name}{" "}
              <span className="text-muted-foreground">
                (
                {
                  data.assignments.filter((row) => row.roleId === role.id)
                    .length
                }
                )
              </span>
            </span>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setEditing(role.id);
                  setName(role.name);
                  setPermissions(role.permissions);
                }}
              >
                {t("settings:adminPanel.customRoles.edit")}
              </Button>
              <Button
                type="button"
                variant="destructive"
                disabled={
                  mutation.isPending ||
                  data.assignments.some((row) => row.roleId === role.id)
                }
                onClick={() =>
                  mutation.mutate(() => removeInstanceRole(role.id))
                }
              >
                {t("common:actions.delete")}
              </Button>
            </div>
          </div>
        ))}
      </div>
      <h2 className="text-lg font-semibold">
        {t("settings:adminPanel.customRoles.assign")}
      </h2>
      <Input
        type="search"
        aria-label={t("settings:adminPanel.customRoles.searchUsers")}
        placeholder={t("settings:adminPanel.customRoles.searchUsers")}
        value={search}
        onChange={(event) => setSearch(event.target.value)}
      />
      {users.error && <p role="alert">{users.error.message}</p>}
      {users.data?.users.map((user) => {
        const assigned =
          data?.assignments.find((row) => row.userId === user.id)?.roleId ??
          "none";
        const items = [
          { label: t("settings:adminPanel.customRoles.none"), value: "none" },
          ...(data?.roles.map((role) => ({
            label: role.name,
            value: role.id,
          })) ?? []),
        ];
        return (
          <div
            key={user.id}
            className="flex justify-between gap-3 items-center"
          >
            <span className="truncate">
              {user.name}{" "}
              <span className="text-muted-foreground">{user.email}</span>
            </span>
            <Select
              items={items}
              value={assigned}
              disabled={mutation.isPending}
              onValueChange={(value) => {
                if (value)
                  mutation.mutate(() =>
                    assignInstanceRole(
                      user.id,
                      value === "none" ? null : value,
                    ),
                  );
              }}
            >
              <SelectTrigger
                aria-label={`${t("settings:adminPanel.customRoles.assign")}: ${user.email}`}
                className="w-48"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {items.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        );
      })}
    </div>
  );
}
