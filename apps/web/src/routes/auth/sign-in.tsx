import {
  createFileRoute,
  useNavigate,
  useRouter,
  useSearch,
} from "@tanstack/react-router";
import { Github, KeyRound } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { z } from "zod/v4";
import PageTitle from "@/components/page-title";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import useGetConfig from "@/hooks/queries/config/use-get-config";
import useInstanceStatus from "@/hooks/queries/instance/use-instance-status";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/cn";
import { toast } from "@/lib/toast";
import { EmailSignInSection } from "../../components/auth/email-sign-in-section";
import { AuthLayout } from "../../components/auth/layout";
import { SignInFormSkeleton } from "../../components/auth/sign-in-form-skeleton";
import { AuthToggle } from "../../components/auth/toggle";

const signInSearchSchema = z.object({
  invitationId: z.string().optional(),
  email: z.string().optional(),
  redirect: z.string().optional(),
});

export const Route = createFileRoute("/auth/sign-in")({
  component: SignIn,
  validateSearch: signInSearchSchema,
});

function SignIn() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { history } = useRouter();
  const search = useSearch({ from: "/auth/sign-in" });
  const [isCustomOAuthLoading, setIsCustomOAuthLoading] = useState(false);
  const [isGithubLoading, setIsGithubLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const lastLoginMethod = authClient.getLastUsedLoginMethod();
  const { data: config, isLoading: isConfigLoading } = useGetConfig();
  const {
    data: instanceStatus,
    isLoading: isInstanceStatusLoading,
    isError: isInstanceStatusError,
    error: instanceStatusError,
  } = useInstanceStatus();

  useEffect(() => {
    if (instanceStatus && instanceStatus.hasUsers === false) {
      navigate({ to: "/auth/sign-up", replace: true });
    }
  }, [instanceStatus, navigate]);

  useEffect(() => {
    if (isInstanceStatusError) {
      toast.error(
        instanceStatusError instanceof Error
          ? instanceStatusError.message
          : t("auth:signIn.instanceStatusError", {
              defaultValue:
                "Couldn't reach the server. Please retry in a moment.",
            }),
      );
    }
  }, [isInstanceStatusError, instanceStatusError, t]);

  const invitationId = search.invitationId;
  const defaultEmail = search.email;

  const getSafeRedirectPath = () => {
    const redirectPath = search.redirect;
    if (redirectPath?.startsWith("/") && !redirectPath.includes("//")) {
      return redirectPath;
    }
    return undefined;
  };

  const getCallbackUrl = () => {
    const baseUrl = import.meta.env.VITE_CLIENT_URL;
    const redirectPath = getSafeRedirectPath();
    if (redirectPath) {
      return `${baseUrl}${redirectPath}`;
    }
    if (invitationId) {
      return `${baseUrl}/invitation/accept/${invitationId}`;
    }
    return `${baseUrl}/dashboard`;
  };

  const handleCustomOAuth = async () => {
    setIsCustomOAuthLoading(true);
    try {
      const result = await authClient.signIn.oauth2({
        providerId: "custom",
        callbackURL: getCallbackUrl(),
        errorCallbackURL: `${import.meta.env.VITE_CLIENT_URL}/auth/sign-in`,
      });
      if (result.error) {
        throw new Error(result.error.message);
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("auth:signIn.oidcError"),
      );
    } finally {
      setIsCustomOAuthLoading(false);
    }
  };

  const handleSignInGoogle = async () => {
    setIsGoogleLoading(true);
    try {
      const result = await authClient.signIn.social({
        provider: "google",
        callbackURL: getCallbackUrl(),
        errorCallbackURL: `${import.meta.env.VITE_CLIENT_URL}/auth/sign-in`,
      });
      if (result.error) {
        throw new Error(result.error.message);
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("auth:signIn.googleError"),
      );
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const handleSignInGithub = async () => {
    setIsGithubLoading(true);
    try {
      const result = await authClient.signIn.social({
        provider: "github",
        callbackURL: getCallbackUrl(),
        errorCallbackURL: `${import.meta.env.VITE_CLIENT_URL}/auth/sign-in`,
      });
      if (result.error) {
        throw new Error(result.error.message);
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("auth:signIn.githubError"),
      );
    } finally {
      setIsGithubLoading(false);
    }
  };

  const handleSignInSuccess = () => {
    const redirectPath = getSafeRedirectPath();
    if (redirectPath) {
      // history.push preserves search params (e.g. ?taskId=); navigate({ to }) does not.
      history.push(redirectPath);
    } else if (invitationId) {
      history.push(`/invitation/accept/${invitationId}`);
    } else {
      history.push("/dashboard");
    }
  };

  // Treat "no users yet" as still loading so the skeleton stays visible
  // while the useEffect above redirects to /auth/sign-up. Otherwise the
  // form briefly paints before the redirect fires.
  if (
    isConfigLoading ||
    isInstanceStatusLoading ||
    instanceStatus?.hasUsers === false
  ) {
    return (
      <>
        <PageTitle title={t("auth:signIn.pageTitle")} />
        <AuthLayout
          title={t("auth:signIn.title")}
          subtitle={t("auth:signIn.subtitle")}
        >
          <SignInFormSkeleton />
        </AuthLayout>
      </>
    );
  }

  return (
    <>
      <PageTitle title={t("auth:signIn.pageTitle")} />
      <AuthLayout
        title={t("auth:signIn.title")}
        subtitle={
          invitationId
            ? t("auth:signIn.invitationSubtitle")
            : t("auth:signIn.subtitle")
        }
      >
        <div className="mt-6">
          {invitationId && (
            <Alert className="mb-4">
              <AlertDescription>
                {t("auth:signIn.invitationAlert")}
              </AlertDescription>
            </Alert>
          )}

          {(config?.hasGoogleSignIn ||
            config?.hasGithubSignIn ||
            config?.hasCustomOAuth) && (
            <>
              <div className="space-y-3">
                {config?.hasGoogleSignIn && (
                  <div className="relative">
                    <Button
                      variant="outline"
                      onClick={handleSignInGoogle}
                      disabled={isGoogleLoading}
                      className={cn(
                        "w-full",
                        lastLoginMethod === "google" && "border-primary/50!",
                      )}
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        className="w-5 h-5 mr-2"
                        aria-label={t("auth:providers.google")}
                      >
                        <title>Google</title>
                        <path
                          d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z"
                          fill="currentColor"
                        />
                      </svg>
                      {isGoogleLoading
                        ? t("auth:signIn.signingIn")
                        : t("auth:signIn.continueWithGoogle")}
                    </Button>
                    {lastLoginMethod === "google" && (
                      <span className="absolute rounded-md -top-3 right-1 px-1.5 text-xs text-primary font-medium bg-sidebar border border-primary/50">
                        {t("auth:signIn.lastUsed")}
                      </span>
                    )}
                  </div>
                )}

                {config?.hasGithubSignIn && (
                  <div className="relative">
                    <Button
                      variant="outline"
                      onClick={handleSignInGithub}
                      disabled={isGithubLoading}
                      className={cn(
                        "w-full",
                        lastLoginMethod === "github" && "border-primary/50!",
                      )}
                    >
                      <Github className="w-5 h-5 mr-2" />
                      {isGithubLoading
                        ? t("auth:signIn.signingIn")
                        : t("auth:signIn.continueWithGithub")}
                    </Button>
                    {lastLoginMethod === "github" && (
                      <span className="absolute rounded-md -top-3 right-1 px-1.5 text-xs text-primary font-medium bg-sidebar border border-primary/50">
                        {t("auth:signIn.lastUsed")}
                      </span>
                    )}
                  </div>
                )}

                {config?.hasCustomOAuth && (
                  <div className="relative">
                    <Button
                      variant="outline"
                      onClick={handleCustomOAuth}
                      disabled={isCustomOAuthLoading}
                      className={cn(
                        "w-full",
                        lastLoginMethod === "custom" && "border-primary/50!",
                      )}
                    >
                      <KeyRound className="w-5 h-5 mr-2" />
                      {isCustomOAuthLoading
                        ? t("auth:signIn.signingIn")
                        : t("auth:signIn.continueWithOidc")}
                    </Button>
                    {lastLoginMethod === "custom" && (
                      <span className="absolute rounded-md -top-3 right-1 px-1.5 text-xs text-primary font-medium bg-sidebar border border-primary/50">
                        {t("auth:signIn.lastUsed")}
                      </span>
                    )}
                  </div>
                )}
              </div>

              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-card text-muted-foreground">
                    {t("auth:forms.or")}
                  </span>
                </div>
              </div>
            </>
          )}
          <EmailSignInSection
            hasSmtp={Boolean(config?.hasSmtp)}
            invitationId={invitationId}
            defaultEmail={defaultEmail}
            redirect={getSafeRedirectPath()}
            onSuccess={handleSignInSuccess}
          />
          {config?.disableRegistration ||
          config?.disablePasswordRegistration ? (
            <div className="text-center pt-4">
              <p className="text-sm text-muted-foreground">
                {config?.disableRegistration
                  ? t("auth:signIn.registrationDisabled")
                  : t("auth:signIn.passwordRegistrationDisabled")}
              </p>
            </div>
          ) : (
            <AuthToggle
              message={t("auth:signIn.toggleMessage")}
              linkText={t("auth:signIn.toggleLink")}
              linkTo="/auth/sign-up"
            />
          )}
        </div>
      </AuthLayout>
    </>
  );
}
