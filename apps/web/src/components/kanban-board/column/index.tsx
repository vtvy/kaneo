import { useState } from "react";
import { cn } from "@/lib/cn";
import { useBackgroundStore } from "@/store/background";
import type { ProjectWithTasks } from "@/types/project";
import { ColumnDropzone } from "./column-dropzone";
import { ColumnHeader } from "./column-header";

type ColumnProps = {
  column: ProjectWithTasks["columns"][number];
};

function Column({ column }: ColumnProps) {
  const [isDropzoneOver, setIsDropzoneOver] = useState(false);
  const background = useBackgroundStore((state) => state.background);

  return (
    <div
      className={cn(
        "group relative flex h-full min-h-0 w-full flex-col rounded-xl border transition-all duration-300 ease-out",
        background
          ? isDropzoneOver
            ? "border-transparent bg-background shadow-md ring-2 ring-ring/30 before:pointer-events-none before:absolute before:inset-0 before:rounded-[inherit] before:bg-accent/60"
            : "border-transparent bg-background shadow-md before:pointer-events-none before:absolute before:inset-0 before:rounded-[inherit] before:bg-muted before:dark:bg-card"
          : isDropzoneOver
            ? "border-ring/40 bg-accent/60 shadow-md ring-2 ring-ring/30"
            : "border-border/70 bg-muted/40 shadow-xs/5 hover:border-border/90 dark:bg-card/90",
      )}
    >
      <div className="relative z-10 shrink-0 border-b border-border/60 px-3 py-2">
        <ColumnHeader column={column} />
      </div>
      <div className="relative z-10 min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-2 py-1 [-webkit-overflow-scrolling:touch]">
        <ColumnDropzone column={column} onIsOverChange={setIsDropzoneOver} />
      </div>
    </div>
  );
}

export default Column;
