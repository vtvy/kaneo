import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import {
  createFileRoute,
  Link,
  useNavigate,
  useSearch,
} from "@tanstack/react-router";
import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { z } from "zod/v4";
import PageTitle from "@/components/page-title";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
import useResetPassword from "@/hooks/mutations/use-reset-password";
import { toast } from "@/lib/toast";
import { AuthLayout } from "../../components/auth/layout";

const resetPasswordSearchSchema = z.object({
  token: z.string().optional(),
  error: z.string().optional(),
});

export const Route = createFileRoute("/auth/reset-password")({
  component: ResetPassword,
  validateSearch: resetPasswordSearchSchema,
});

type ResetPasswordFormValues = {
  password: string;
  confirmPassword: string;
};

function ResetPassword() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const search = useSearch({ from: "/auth/reset-password" });
  const [showPassword, setShowPassword] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const { mutateAsync: resetPassword } = useResetPassword();

  const token = search.token;
  const invalidToken = Boolean(search.error) || !token;

  const form = useForm<ResetPasswordFormValues>({
    resolver: standardSchemaResolver(
      z
        .object({
          password: z.string().min(8, {
            message: t("auth:resetPassword.passwordTooShort"),
          }),
          confirmPassword: z.string(),
        })
        .refine((data) => data.password === data.confirmPassword, {
          message: t("auth:resetPassword.passwordMismatch"),
          path: ["confirmPassword"],
        }),
    ),
    defaultValues: {
      password: "",
      confirmPassword: "",
    },
  });

  const onSubmit = async (data: ResetPasswordFormValues) => {
    if (!token) return;
    setIsPending(true);
    try {
      await resetPassword({
        newPassword: data.password,
        token,
      });
      toast.success(t("auth:resetPassword.success"));
      navigate({ to: "/auth/sign-in" });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("auth:resetPassword.failed"),
      );
    } finally {
      setIsPending(false);
    }
  };

  return (
    <>
      <PageTitle title={t("auth:resetPassword.pageTitle")} />
      <AuthLayout
        title={t("auth:resetPassword.title")}
        subtitle={t("auth:resetPassword.subtitle")}
      >
        {invalidToken ? (
          <div className="mt-4 space-y-4">
            <Alert variant="error">
              <AlertDescription>
                {t("auth:resetPassword.invalidToken")}
              </AlertDescription>
            </Alert>
            <Button
              render={<Link to="/auth/forgot-password" />}
              variant="outline"
              size="sm"
              className="w-full"
            >
              {t("auth:resetPassword.requestNewLink")}
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
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium">
                      {t("auth:resetPassword.newPassword")}
                    </FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          placeholder={t("auth:forms.passwordPlaceholder")}
                          type={showPassword ? "text" : "password"}
                          autoComplete="new-password"
                          {...field}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                          aria-label={
                            showPassword
                              ? t("auth:forms.hidePassword")
                              : t("auth:forms.showPassword")
                          }
                          aria-pressed={showPassword}
                        >
                          {showPassword ? (
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
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium">
                      {t("auth:resetPassword.confirmPassword")}
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder={t("auth:forms.passwordPlaceholder")}
                        type={showPassword ? "text" : "password"}
                        autoComplete="new-password"
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
                  ? t("auth:resetPassword.submitting")
                  : t("auth:resetPassword.submit")}
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
