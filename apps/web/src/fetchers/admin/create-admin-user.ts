import { client } from "@kaneo/libs";
import type { InferRequestType } from "hono/client";

export type CreateAdminUserRequest = InferRequestType<
  typeof client.admin.users.$post
>["json"];

async function createAdminUser(json: CreateAdminUserRequest) {
  const response = await client.admin.users.$post({ json });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return response.json();
}

export default createAdminUser;
