import { windowId } from "@kaneo/libs";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { getApiUrl } from "@/fetchers/get-api-url";
import { authClient } from "@/lib/auth-client";

export function getWsUrl(projectId: string) {
  const base = getApiUrl("ws");
  const wsBase = base.replace(/^http/, "ws");
  return `${wsBase}/${encodeURIComponent(projectId)}?windowId=${encodeURIComponent(windowId)}`;
}

const MAX_RETRIES = 5;
const BASE_DELAY = 1000; // 1 second

export function useProjectWebSocket(projectId: string) {
  const queryClient = useQueryClient();
  const { data: session } = authClient.useSession();
  const wsRef = useRef<WebSocket | null>(null);
  const retriesRef = useRef(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!projectId || !session?.user?.id) return;

    let disposed = false;
    retriesRef.current = 0;

    function closeSocket(ws: WebSocket) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
        return;
      }
      if (ws.readyState === WebSocket.CONNECTING) {
        ws.addEventListener("open", () => ws.close(), { once: true });
      }
    }

    function connect() {
      if (disposed) return;
      const url = getWsUrl(projectId);
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        if (disposed || wsRef.current !== ws) {
          ws.close();
          return;
        }
        retriesRef.current = 0;
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          if (message.type === "PROJECT_UPDATED") {
            queryClient.invalidateQueries({ queryKey: ["projects"] });
            queryClient.invalidateQueries({
              queryKey: ["tasks", message.projectId],
            });
            return;
          }
          if (message.type === "PROJECT_MOVED") {
            // The server closes this socket; refetch so the project shows up
            // under its new workspace (or disappears if access was lost).
            queryClient.invalidateQueries({ queryKey: ["projects"] });
            queryClient.invalidateQueries({
              queryKey: ["tasks", message.projectId],
            });
            return;
          }
          if (
            message.type === "TASK_UPDATED" ||
            message.type === "TASK_CREATED" ||
            message.type === "TASK_DELETED" ||
            message.type === "TASK_LABEL_UPDATED" ||
            message.type === "TASK_MOVED" ||
            message.type === "TASK_RELATION_UPDATED" ||
            message.type === "COMMENT_UPDATED"
          ) {
            queryClient.invalidateQueries({
              queryKey: ["tasks", message.projectId],
            });
            // Keep the backlog table live for any task change (create/update/
            // delete/move) across all clients, not just the board.
            queryClient.invalidateQueries({
              queryKey: ["all-project-tasks", message.projectId],
            });

            if (message.type === "TASK_RELATION_UPDATED") {
              if (message.sourceTaskId) {
                queryClient.invalidateQueries({
                  queryKey: ["task", message.sourceTaskId],
                });
                queryClient.invalidateQueries({
                  queryKey: ["task-relations", message.sourceTaskId],
                });
              }
              if (message.targetTaskId) {
                queryClient.invalidateQueries({
                  queryKey: ["task", message.targetTaskId],
                });
                queryClient.invalidateQueries({
                  queryKey: ["task-relations", message.targetTaskId],
                });
              }
              if (!message.sourceTaskId && !message.targetTaskId) {
                queryClient.invalidateQueries({
                  queryKey: ["task-relations"],
                });
              }
            } else {
              queryClient.invalidateQueries({
                queryKey: ["task", message.taskId],
              });
            }

            if (message.type === "TASK_LABEL_UPDATED") {
              queryClient.invalidateQueries({
                queryKey: ["labels", message.taskId],
              });
            }

            if (message.type === "TASK_UPDATED" && message.taskId) {
              queryClient.invalidateQueries({
                queryKey: ["external-links", message.taskId],
              });
            }

            if (message.type === "COMMENT_UPDATED") {
              queryClient.invalidateQueries({
                queryKey: ["activities", message.taskId],
              });
              queryClient.invalidateQueries({
                queryKey: ["comments", message.taskId],
              });
            }
          }
        } catch {
          // Ignore malformed messages
        }
      };

      ws.onclose = () => {
        const isCurrent = wsRef.current === ws;
        if (isCurrent) wsRef.current = null;
        if (!isCurrent || disposed || retriesRef.current >= MAX_RETRIES) return;

        const delay = BASE_DELAY * 2 ** retriesRef.current; // 1s, 2s, 4s, 8s, 16s
        retriesRef.current += 1;
        timeoutRef.current = setTimeout(connect, delay);
      };
    }

    function stop(closeActiveSocket: boolean) {
      disposed = true;
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      const ws = wsRef.current;
      wsRef.current = null;
      if (closeActiveSocket && ws) closeSocket(ws);
    }

    function handlePageHide() {
      // Close before the page is frozen. Otherwise Chrome aborts the socket
      // and logs "WebSocket connection failed" as it enters back-forward cache.
      stop(true);
    }

    function handlePageShow(event: PageTransitionEvent) {
      if (!event.persisted) return;
      disposed = false;
      retriesRef.current = 0;
      connect();
    }

    connect();
    window.addEventListener("pagehide", handlePageHide);
    window.addEventListener("pageshow", handlePageShow);

    return () => {
      window.removeEventListener("pagehide", handlePageHide);
      window.removeEventListener("pageshow", handlePageShow);
      stop(true);
    };
  }, [projectId, session?.user?.id, queryClient]);
}
