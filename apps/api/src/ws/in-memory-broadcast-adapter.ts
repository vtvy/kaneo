import type { BroadcastAdapter, BroadcastMessage } from "./broadcast-adapter";
import type { SocketRevocation } from "./socket-revocation";

export class InMemoryBroadcastAdapter implements BroadcastAdapter {
  private handler?: (msg: BroadcastMessage) => void;
  private revocationHandler?: (msg: SocketRevocation) => void;

  async publish(msg: BroadcastMessage): Promise<void> {
    // Deliver directly in the same process
    this.handler?.(msg);
  }

  async subscribe(handler: (msg: BroadcastMessage) => void): Promise<void> {
    this.handler = handler;
  }

  async publishRevocation(msg: SocketRevocation): Promise<void> {
    this.revocationHandler?.(msg);
  }

  async subscribeRevocation(
    handler: (msg: SocketRevocation) => void,
  ): Promise<void> {
    this.revocationHandler = handler;
  }

  async shutdown(): Promise<void> {
    this.handler = undefined;
    this.revocationHandler = undefined;
  }
}
