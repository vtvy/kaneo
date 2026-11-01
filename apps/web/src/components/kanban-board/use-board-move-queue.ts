import { useCallback, useRef, useState } from "react";

export type BoardMove = {
  activeId: string;
  overId: string;
  projectId: string;
};

export function useBoardMoveQueue({
  projectId,
  disabled,
  onMove,
  onDrained,
  onFailed,
}: {
  projectId: string;
  disabled: boolean;
  onMove: (move: BoardMove, onSettled: (failed?: boolean) => void) => void;
  onDrained: () => void;
  onFailed: () => void;
}) {
  const queueRef = useRef<BoardMove[]>([]);
  const [pendingMoves, setPendingMoves] = useState<BoardMove[]>([]);
  const processing = useRef(false);
  const disabledRef = useRef(disabled);
  const onMoveRef = useRef(onMove);
  const onDrainedRef = useRef(onDrained);
  const onFailedRef = useRef(onFailed);
  disabledRef.current = disabled;
  onMoveRef.current = onMove;
  onDrainedRef.current = onDrained;
  onFailedRef.current = onFailed;

  const settle = useCallback(
    (failed?: boolean) => {
      processing.current = false;
      if (failed || disabledRef.current) {
        queueRef.current = [];
        setPendingMoves([]);
        if (failed) onFailedRef.current();
        else onDrainedRef.current();
        return;
      }
      const next = queueRef.current[0];
      if (!next || next.projectId !== projectId) {
        queueRef.current = [];
        setPendingMoves([]);
        onDrainedRef.current();
        return;
      }
      queueRef.current = queueRef.current.slice(1);
      setPendingMoves([...queueRef.current]);
      processing.current = true;
      onMoveRef.current(next, settle);
    },
    [projectId],
  );

  const queueMove = (move: Omit<BoardMove, "projectId">) => {
    if (disabledRef.current) return;
    const queued = { ...move, projectId };
    if (!processing.current && queueRef.current.length === 0) {
      processing.current = true;
      onMoveRef.current(queued, settle);
      return;
    }
    queueRef.current = [...queueRef.current, queued];
    setPendingMoves([...queueRef.current]);
  };

  return { queueMove, pendingMoves };
}
