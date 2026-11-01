import { Hono } from "hono";
import { describeRoute, resolver } from "hono-openapi";
import { getInstanceSettings } from "../instance-settings/get-instance-settings";
import {
  DEFAULT_STORED_SETTINGS,
  resolveInstanceSettings,
} from "../instance-settings/resolve-instance-settings";
import { configSchema } from "../schemas";
import getSettings from "../utils/get-settings";

const config = new Hono().get(
  "/",
  describeRoute({
    operationId: "getConfig",
    tags: ["Config"],
    description: "Get application settings and configuration",
    responses: {
      200: {
        description: "Application settings",
        content: {
          "application/json": { schema: resolver(configSchema) },
        },
      },
    },
  }),
  async (c) => {
    // Instance settings already apply the environment overrides. This route
    // is public, so a database hiccup falls back to the environment alone.
    const instance = await getInstanceSettings().catch(() =>
      resolveInstanceSettings(DEFAULT_STORED_SETTINGS, process.env),
    );
    return c.json({
      ...getSettings(),
      disableRegistration: !instance.registrationEnabled,
      disablePasswordRegistration: !instance.passwordRegistrationEnabled,
      instanceName: instance.instanceName,
      workspaceCreationRestricted: instance.workspaceCreationRestricted,
      disabledIntegrations: instance.disabledIntegrations,
    });
  },
);

export default config;
