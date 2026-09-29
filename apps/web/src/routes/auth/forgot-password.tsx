import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Trans, useTranslation } from "react-i18next";
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
import useRequestPasswordReset from "@/hooks/mutations/use-request-password-reset";
import useGetConfig from "@/hooks/queries/config/use-get-config";
import { toast } from "@/lib/toast";
import { AuthLayout } from "../../components/auth/layout";

export const Route = createFileRoute("/auth/forgot-password")({
  component: ForgotPassword,
});

type ForgotPasswordFormValues = {
  email: string;
};

function ForgotPassword() {
  const { t } = useTranslation();
  const [isPending, setIsPending] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const { mutateAsync: requestReset } = useRequestPasswordReset();
  const { data: config, isLoading: isConfigLoading } = useGetConfig();
  const smtpUnavailable = !isConfigLoading && !config?.hasSmtp;

  const form = useForm<ForgotPasswordFormValues>({
    resolver: standardSchemaResolver(
      z.object({
        email: z.email(),
      }),
    ),
    defaultValues: { email: "" },
  });

  const onSubmit = async (data: ForgotPasswordFormValues) => {
    setIsPending(true);
    try {
      const clientUrl =
        import.meta.env.VITE_CLIENT_URL || window.location.origin;
      await requestReset({
        email: data.email,
        redirectTo: `${clientUrl}/auth/reset-password`,
      });
      toast.success(t("auth:forgotPassword.emailSent"));
      setSentTo(data.email);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("auth:forgotPassword.sendFailed"),
      );
    } finally {
      setIsPending(false);
    }
  };

  return (
    <>
      <PageTitle title={t("auth:forgotPassword.pageTitle")} />
      <AuthLayout
        title={
          sentTo
            ? t("auth:forgotPassword.sentTitle")
            : t("auth:forgotPassword.title")
        }
        subtitle={sentTo ? undefined : t("auth:forgotPassword.subtitle")}
      >
        {smtpUnavailable ? (
          <p className="mt-4 rounded-lg border border-border bg-muted/40 p-3 text-sm leading-relaxed text-muted-foreground">
            {t("auth:forgotPassword.smtpUnavailable")}
          </p>
        ) : sentTo ? (
          <div className="mt-4 space-y-4">
            <p className="text-sm leading-relaxed text-muted-foreground">
              <Trans
                i18nKey="auth:forgotPassword.sentMessage"
                values={{ email: sentTo }}
                components={{
                  email: <span className="font-medium text-foreground" />,
                }}
              />
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => setSentTo(null)}
            >
              {t("auth:forgotPassword.sendAgain")}
            </Button>
          </div>
        ) : (
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(onSubmit)}
              className="mt-4 space-y-3"
            >
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium">
                      {t("auth:forms.email")}
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder={t("auth:forms.emailPlaceholder")}
                        type="email"
                        autoComplete="email"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button
                type="submit"
                disabled={isPending}
                size="sm"
                className="mt-4 w-full"
              >
                {isPending
                  ? t("auth:forgotPassword.sending")
                  : t("auth:forgotPassword.sendLink")}
              </Button>
            </form>
          </Form>
        )}
        <div className="mt-3 text-center text-sm text-muted-foreground">
          <Link
            to="/auth/sign-in"
            className="underline underline-offset-4 hover:text-primary"
          >
            {t("auth:forgotPassword.backToSignIn")}
          </Link>
        </div>
      </AuthLayout>
    </>
  );
}
