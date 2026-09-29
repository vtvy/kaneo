import type { client } from "@kaneo/libs";
import type { InferResponseType } from "hono/client";

export type Sprint = InferResponseType<
  (typeof client)["sprint"][":id"]["$get"],
  200
>;

export type SprintState = Sprint["state"];

export type SprintTask = InferResponseType<
  (typeof client)["sprint"][":id"]["tasks"]["$get"],
  200
>[number];
