import type { ProjectWithTasks } from "@/types/project";
import { applyBoardMove } from "./apply-board-move";
import type { BoardMove } from "./use-board-move-queue";

export function previewBoardMoves(
  project: ProjectWithTasks,
  moves: BoardMove[],
) {
  return moves.reduce(
    (board, move) =>
      applyBoardMove(board, move.activeId, move.overId)?.project ?? board,
    project,
  );
}
