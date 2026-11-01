import { type FormEvent, useState } from "react";
import { useTranslation } from "react-i18next";
import useCreateAdminUser from "@/hooks/mutations/admin/use-create-admin-user";
import useInstanceAccess from "@/hooks/queries/admin/use-instance-access";
import useGetConfig from "@/hooks/queries/config/use-get-config";
import { toast } from "@/lib/toast";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { Switch } from "../ui/switch";

type CreateUserDialogProps = {
  open: boolean;
  onClose: () => void;
};

const initialState = {
  name: "",
  email: "",
  password: "",
  role: "user" as "admin" | "user",
  sendSetupEmail: true,
};

export function CreateUserDialog({ open, onClose }: CreateUserDialogProps) {
  const { t } = useTranslation();
  const { data: config } = useGetConfig();
  const { data: access } = useInstanceAccess();
  const { mutateAsync: createUser, isPending } = useCreateAdminUser();
  const [form, setForm] = useState(initialState);
  const hasSmtp = Boolean(config?.hasSmtp);

  const close = () => {
    if (isPending) return;
    setForm(initialState);
    onClose();
  };

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    try {
      const result = await createUser({
        name: form.name,
        email: form.email,
        password: form.password || undefined,
        role: access?.isAdmin ? form.role : "user",
        sendSetupEmail: hasSmtp && form.sendSetupEmail,
      });
      toast.success(
        result.setupEmailSent
          ? t("settings:adminPanel.createUser.createdWithEmail")
          : t("settings:adminPanel.createUser.created"),
      );
      setForm(initialState);
      onClose();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("settings:adminPanel.createUser.failed"),
      );
    }
  };

  const roleLabel = (role: "admin" | "user") =>
    role === "admin"
      ? t("settings:adminPanel.roles.admin")
      : t("settings:adminPanel.roles.user");

  return (
    <Dialog open={open} onOpenChange={(next) => !next && close()}>
      <DialogContent className="sm:max-w-lg p-0 gap-0">
        <DialogHeader className="px-6 py-5 border-b border-border">
          <DialogTitle>{t("settings:adminPanel.createUser.title")}</DialogTitle>
          <DialogDescription>
            {t("settings:adminPanel.createUser.description")}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit}>
          <div className="space-y-4 px-6 py-5">
            <div className="space-y-2">
              <Label htmlFor="admin-create-name">
                {t("settings:adminPanel.createUser.name")}
              </Label>
              <Input
                id="admin-create-name"
                required
                maxLength={100}
                value={form.name}
                disabled={isPending}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="admin-create-email">
                {t("settings:adminPanel.createUser.email")}
              </Label>
              <Input
                id="admin-create-email"
                type="email"
                required
                value={form.email}
                disabled={isPending}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="admin-create-password">
                {t("settings:adminPanel.createUser.password")}
              </Label>
              <Input
                id="admin-create-password"
                type="password"
                autoComplete="new-password"
                minLength={8}
                maxLength={128}
                value={form.password}
                disabled={isPending}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                {hasSmtp
                  ? t("settings:adminPanel.createUser.passwordHintSmtp")
                  : t("settings:adminPanel.createUser.passwordHintNoSmtp")}
              </p>
            </div>
            {hasSmtp && !form.password && (
              <div className="flex items-center justify-between gap-4">
                <Label htmlFor="admin-create-setup-email">
                  {t("settings:adminPanel.createUser.sendSetupEmail")}
                </Label>
                <Switch
                  id="admin-create-setup-email"
                  checked={form.sendSetupEmail}
                  disabled={isPending}
                  onCheckedChange={(checked) =>
                    setForm({ ...form, sendSetupEmail: checked })
                  }
                />
              </div>
            )}
            <div className="space-y-2">
              <Label>{t("settings:adminPanel.createUser.role")}</Label>
              <Select
                value={form.role}
                disabled={isPending}
                onValueChange={(value) =>
                  setForm({ ...form, role: value as "admin" | "user" })
                }
              >
                <SelectTrigger>
                  <SelectValue>{roleLabel(form.role)}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">{roleLabel("user")}</SelectItem>
                  {access?.isAdmin && (
                    <SelectItem value="admin">{roleLabel("admin")}</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={close}
              disabled={isPending}
            >
              {t("common:actions.cancel")}
            </Button>
            <Button type="submit" disabled={isPending}>
              {t("settings:adminPanel.createUser.submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
