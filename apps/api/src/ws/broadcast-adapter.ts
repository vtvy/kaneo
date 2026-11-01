import type { SocketRevocation } from "./socket-revocation";

export type ProjectBroadcastMessage = {
  type: string;
  projectId: string;
  taskId?: string;
  sourceTaskId?: string;
  targetTaskId?: string;
};

export type BroadcastMessage = {
  projectId: string;
  message: ProjectBroadcastMessage;
  excludeInitiatorId?: string;
};

export type BroadcastAdapter = {
  /** Publish a message to all instances watching this project */
  publish(msg: BroadcastMessage): Promise<void>;

  /** Subscribe to messages for delivery to local connections */
  subscribe(handler: (msg: BroadcastMessage) => void): Promise<void>;

  /** Publish a socket revocation to every instance (this one included) */
  publishRevocation(msg: SocketRevocation): Promise<void>;

  /** Subscribe to socket revocations published by any instance */
  subscribeRevocation(handler: (msg: SocketRevocation) => void): Promise<void>;

  /** Cleanup on shutdown */
  shutdown(): Promise<void>;
};
