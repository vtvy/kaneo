import { client } from "@kaneo/libs";

async function sendAdminTestEmail() {
  const response = await client.admin.system["test-email"].$post();

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return response.json();
}

export default sendAdminTestEmail;
