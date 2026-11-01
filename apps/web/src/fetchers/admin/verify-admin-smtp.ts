import { client } from "@kaneo/libs";

async function verifyAdminSmtp() {
  const response = await client.admin.system["verify-smtp"].$post();

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return response.json();
}

export default verifyAdminSmtp;
