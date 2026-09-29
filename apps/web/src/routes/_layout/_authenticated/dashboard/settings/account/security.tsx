import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { createFileRoute } from "@tanstack/react-router";
import { Eye, EyeOff, KeyRound } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { z } from "zod/v4";
import PageTitle from "@/components/page-title";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import useChangePassword from "@/hooks/mutations/use-change-password";
import useLinkedAccounts from "@/hooks/queries/use-linked-accounts";
import { toast } from "@/lib/toast";
import { hasCredentialAccount } from "@/lib/utils/has-credential-account";

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/settings/account/security",
)({
  component: RouteComponent,
});

type ChangePasswordFormValues = {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
};

function RouteComponent() {
  const { t } = useTranslation();
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const { mutateAsync: changePassword, isPending } = useChangePassword();
  const { data: linkedAccounts, isLoading: isLoadingAccounts } =
    useLinkedAccounts();
  const canChangePassword = hasCredentialAccount(linkedAccounts);

  const form = useForm<ChangePasswordFormValues>({
    resolver: standardSchemaResolver(
      z
        .object({
          currentPassword: z.string().min(1, {
            message: t("settings:securityPage.validation.currentRequired"),
          }),
          newPassword: z.string().min(8, {
            message: t("settings:securityPage.validation.passwordTooShort"),
          }),
          confirmPassword: z.string(),
        })
        .refine((data) => data.newPassword === data.confirmPassword, {
          message: t("settings:securityPage.validation.passwordMismatch"),
          path: ["confirmPassword"],
        })
        .refine((data) => data.currentPassword !== data.newPassword, {
          message: t("settings:securityPage.validation.passwordSame"),
          path: ["newPassword"],
        }),
    ),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  const onSubmit = async (data: ChangePasswordFormValues) => {
    try {
      await changePassword({
        currentPassword: data.currentPassword,
        newPassword: data.newPassword,
      });
      toast.success(t("settings:securityPage.updateSuccess"));
      form.reset();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("settings:securityPage.updateError"),
      );
    }
  };

  return (
    <>
      <PageTitle title={t("settings:securityPage.pageTitle")} />
      <div className="space-y-6 p-4 sm:p-6">
        <div>
          <h2 className="text-lg font-medium tracking-tight">
            {t("settings:securityPage.title")}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("settings:securityPage.subtitle")}
          </p>
        </div>

        <Separator />

        <div className="max-w-md space-y-4">
          <div className="flex items-center gap-2 text-sm font-medium">
            <KeyRound className="h-4 w-4 text-muted-foreground" />
            {t("settings:securityPage.sectionTitle")}
          </div>
          <p className="text-sm text-muted-foreground">
            {t("settings:securityPage.sectionSubtitle")}
          </p>

          {isLoadingAccounts ? null : !canChangePassword ? (
            <p className="rounded-lg border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
              {t("settings:securityPage.oauthOnly")}
            </p>
          ) : (
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="space-y-3"
              >
                <FormField
                  control={form.control}
                  name="currentPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        {t("settings:securityPage.currentPassword")}
                      </FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input
                            type={showCurrent ? "text" : "password"}
                            autoComplete="current-password"
                            {...field}
                          />
                          <button
                            type="button"
                            onClick={() => setShowCurrent(!showCurrent)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                            aria-label={
                              showCurrent
                                ? t("auth:forms.hidePassword")
                                : t("auth:forms.showPassword")
                            }
                          >
                            {showCurrent ? (
                              <EyeOff size={16} />
                            ) : (
                              <Eye size={16} />
                            )}
                          </button>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="newPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        {t("settings:securityPage.newPassword")}
                      </FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input
                            type={showNew ? "text" : "password"}
                            autoComplete="new-password"
                            {...field}
                          />
                          <button
                            type="button"
                            onClick={() => setShowNew(!showNew)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                            aria-label={
                              showNew
                                ? t("auth:forms.hidePassword")
                                : t("auth:forms.showPassword")
                            }
                          >
                            {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
                          </button>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="confirmPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        {t("settings:securityPage.confirmPassword")}
                      </FormLabel>
                      <FormControl>
                        <Input
                          type={showNew ? "text" : "password"}
                          autoComplete="new-password"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" size="sm" disabled={isPending}>
                  {isPending
                    ? t("settings:securityPage.saving")
                    : t("settings:securityPage.save")}
                </Button>
              </form>
            </Form>
          )}
        </div>
      </div>
    </>
  );
}
