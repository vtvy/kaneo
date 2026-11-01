import { sendFeedbackEmail } from "@kaneo/email";
import { HTTPException } from "hono/http-exception";
import { resolveFeedbackRecipient } from "../feedback-recipient";

type SendFeedbackInput = {
  message: string;
  pageUrl?: string;
  senderName: string;
  senderEmail: string;
};

async function sendFeedback(input: SendFeedbackInput) {
  const recipient = resolveFeedbackRecipient();
  if (!recipient)
    throw new HTTPException(503, { message: "FEEDBACK_NOT_CONFIGURED" });
  const result = await sendFeedbackEmail(recipient, {
    message: input.message,
    pageUrl: input.pageUrl,
    senderName: input.senderName,
    senderEmail: input.senderEmail,
  });

  if (!result.success) {
    throw new HTTPException(503, { message: "SMTP_NOT_CONFIGURED" });
  }

  return { ok: true as const };
}

export default sendFeedback;
