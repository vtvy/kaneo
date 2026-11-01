import { client } from "@kaneo/libs";

type SendFeedbackRequest = {
  message: string;
  pageUrl?: string;
};

async function readErrorMessage(response: Response) {
  const text = await response.text();
  try {
    const parsed = JSON.parse(text) as { message?: string };
    if (parsed.message) return parsed.message;
  } catch {
    // The body was not JSON.
  }
  return text;
}

async function sendFeedback(input: SendFeedbackRequest) {
  const response = await client.feedback.$post({
    json: input,
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  return response.json();
}

export default sendFeedback;
