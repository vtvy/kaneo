import { useState } from "react";
import { useTranslation } from "react-i18next";
import { OtpSignInForm } from "./otp-sign-in-form";
import { SignInForm } from "./sign-in-form";

type EmailSignInSectionProps = {
  hasSmtp: boolean;
  invitationId?: string;
  defaultEmail?: string;
  redirect?: string;
  onSuccess?: () => void;
};

export function EmailSignInSection({
  hasSmtp,
  invitationId,
  defaultEmail,
  redirect,
  onSuccess,
}: EmailSignInSectionProps) {
  const { t } = useTranslation();
  const [method, setMethod] = useState<"password" | "otp">("password");

  return (
    <div>
      {method === "password" ? (
        <SignInForm
          defaultEmail={defaultEmail}
          onSuccess={onSuccess}
          showForgotPassword={hasSmtp}
        />
      ) : (
        <OtpSignInForm
          invitationId={invitationId}
          defaultEmail={defaultEmail}
          redirect={redirect}
          onSuccess={onSuccess}
        />
      )}
      {hasSmtp && (
        <div className="text-center pt-3">
          <button
            type="button"
            onClick={() =>
              setMethod((prev) => (prev === "password" ? "otp" : "password"))
            }
            className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            {method === "password"
              ? t("auth:signIn.useOtpInstead")
              : t("auth:signIn.usePasswordInstead")}
          </button>
        </div>
      )}
    </div>
  );
}
