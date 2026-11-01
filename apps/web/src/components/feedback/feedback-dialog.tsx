import { MessageSquareIcon } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
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
import { Textarea } from "@/components/ui/textarea";
import useSendFeedback from "@/hooks/mutations/feedback/use-send-feedback";
import useGetConfig from "@/hooks/queries/config/use-get-config";
import { toast } from "@/lib/toast";

export function FeedbackButton() {
  const { t } = useTranslation();
  const { data: config } = useGetConfig();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const { mutateAsync, isPending } = useSendFeedback();

  const handleClose = () => {
    if (isPending) return;
    setOpen(false);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = message.trim();
    if (!trimmed) return;

    try {
      await mutateAsync({
        message: trimmed,
        pageUrl: `${window.location.origin}${window.location.pathname}`,
      });
      setMessage("");
      setOpen(false);
      toast.success(t("common:feedback.sent"));
    } catch (error) {
      const detail = error instanceof Error ? error.message : "";
      toast.error(
        detail.includes("SMTP_NOT_CONFIGURED")
          ? t("common:feedback.smtpUnavailable")
          : t("common:feedback.sendError"),
      );
    }
  };

  if (!config?.hasFeedback) return null;
  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-full justify-start"
        onClick={() => setOpen(true)}
      >
        <MessageSquareIcon />
        {t("common:feedback.button")}
      </Button>
      <Dialog open={open} onOpenChange={(next) => !next && handleClose()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("common:feedback.title")}</DialogTitle>
            <DialogDescription>
              {t("common:feedback.description")}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="contents">
            <DialogPanel>
              <Textarea
                aria-label={t("common:feedback.title")}
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                placeholder={t("common:feedback.placeholder")}
                maxLength={5000}
                rows={5}
                disabled={isPending}
                required
              />
            </DialogPanel>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleClose}
                disabled={isPending}
              >
                {t("common:actions.cancel")}
              </Button>
              <Button
                type="submit"
                size="sm"
                loading={isPending}
                disabled={!message.trim()}
              >
                {isPending
                  ? t("common:feedback.sending")
                  : t("common:feedback.send")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
