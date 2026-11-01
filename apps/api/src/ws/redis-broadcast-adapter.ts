import * as v from "valibot";
import { closeRedis, getRedisPub, getRedisSub } from "../redis";
import type { BroadcastAdapter, BroadcastMessage } from "./broadcast-adapter";
import type { SocketRevocation } from "./socket-revocation";

const CHANNEL_PREFIX = "kaneo:ws:";
const CHANNEL_SUFFIX = ":broadcast";
const CHANNEL_PATTERN = `${CHANNEL_PREFIX}*${CHANNEL_SUFFIX}`;
// Outside the project pattern above, so it never reaches project handlers.
const REVOCATION_CHANNEL = "kaneo:ws-revocation";

const broadcastMessageSchema = v.object({
  projectId: v.string(),
  message: v.object({
    type: v.string(),
    projectId: v.string(),
    taskId: v.optional(v.string()),
    sourceTaskId: v.optional(v.string()),
    targetTaskId: v.optional(v.string()),
  }),
  excludeInitiatorId: v.optional(v.string()),
});

const revocationSchema = v.variant("kind", [
  v.object({ kind: v.literal("sessions"), sessionIds: v.array(v.string()) }),
  v.object({ kind: v.literal("apiKeys"), apiKeyIds: v.array(v.string()) }),
  v.object({ kind: v.literal("user"), userId: v.string() }),
  v.object({
    kind: v.literal("access"),
    userId: v.string(),
    projectId: v.optional(v.string()),
    workspaceId: v.optional(v.string()),
  }),
]);

export class RedisBroadcastAdapter implements BroadcastAdapter {
  private subscribed = false;
  private _pmessageHandler:
    | ((pattern: string, channel: string, data: string) => void)
    | null = null;
  private _messageHandler: ((channel: string, data: string) => void) | null =
    null;

  async publish(msg: BroadcastMessage): Promise<void> {
    await getRedisPub().publish(
      this.channelForProject(msg.projectId),
      JSON.stringify(msg),
    );
  }

  async subscribe(handler: (msg: BroadcastMessage) => void): Promise<void> {
    if (this.subscribed) return;
    this.subscribed = true;

    // Pattern-subscribe to ALL project channels at once
    await getRedisSub().psubscribe(CHANNEL_PATTERN);

    // "pmessage" fires for pattern subscriptions (not "message")
    this._pmessageHandler = (
      _pattern: string,
      _channel: string,
      data: string,
    ) => {
      try {
        const parsed = v.safeParse(broadcastMessageSchema, JSON.parse(data));
        if (!parsed.success) {
          console.error("Invalid broadcast message:", parsed.issues);
          return;
        }
        handler(parsed.output);
      } catch (err) {
        console.error("Failed to parse broadcast message:", err);
      }
    };
    getRedisSub().on("pmessage", this._pmessageHandler);
  }

  async publishRevocation(msg: SocketRevocation): Promise<void> {
    await getRedisPub().publish(REVOCATION_CHANNEL, JSON.stringify(msg));
  }

  async subscribeRevocation(
    handler: (msg: SocketRevocation) => void,
  ): Promise<void> {
    if (this._messageHandler) return;
    await getRedisSub().subscribe(REVOCATION_CHANNEL);
    this._messageHandler = (channel: string, data: string) => {
      if (channel !== REVOCATION_CHANNEL) return;
      try {
        const parsed = v.safeParse(revocationSchema, JSON.parse(data));
        if (!parsed.success) {
          console.error("Invalid socket revocation:", parsed.issues);
          return;
        }
        handler(parsed.output);
      } catch (err) {
        console.error("Failed to parse socket revocation:", err);
      }
    };
    getRedisSub().on("message", this._messageHandler);
  }

  async shutdown(): Promise<void> {
    if (this._pmessageHandler) {
      getRedisSub().off("pmessage", this._pmessageHandler);
      this._pmessageHandler = null;
    }
    if (this._messageHandler) {
      getRedisSub().off("message", this._messageHandler);
      this._messageHandler = null;
      await getRedisSub().unsubscribe(REVOCATION_CHANNEL);
    }
    // Unsubscribe from the pattern — covers all project channels
    await getRedisSub().punsubscribe(CHANNEL_PATTERN);
    this.subscribed = false;
    await closeRedis();
  }

  private channelForProject(projectId: string): string {
    return `${CHANNEL_PREFIX}${projectId}${CHANNEL_SUFFIX}`;
  }
}
