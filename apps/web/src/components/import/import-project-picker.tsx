import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export const MAX_IMPORT_PROJECTS = 50;

type SourceProject = { id: string; name: string; detail?: string };

type ImportProjectPickerProps = {
  projects: SourceProject[];
  selected: string[];
  includeComments: boolean;
  isStarting: boolean;
  onSelectedChange: (selected: string[]) => void;
  onIncludeCommentsChange: (value: boolean) => void;
  onBack: () => void;
  onStart: () => void;
};

export function ImportProjectPicker({
  projects,
  selected,
  includeComments,
  isStarting,
  onSelectedChange,
  onIncludeCommentsChange,
  onBack,
  onStart,
}: ImportProjectPickerProps) {
  const { t } = useTranslation();
  const chosen = new Set(selected);

  function toggle(id: string, checked: boolean) {
    // Keep the source's order so projects import in the order listed.
    const next = new Set(chosen);
    if (checked) next.add(id);
    else next.delete(id);
    onSelectedChange(
      projects.map((project) => project.id).filter((key) => next.has(key)),
    );
  }

  const tooMany = selected.length > MAX_IMPORT_PROJECTS;

  return (
    <div className="space-y-4 border border-border rounded-md p-4 bg-sidebar">
      {projects.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {t("settings:workspaceImport.projects.empty")}
        </p>
      ) : (
        <div className="space-y-2 max-h-80 overflow-y-auto">
          {projects.map((project) => (
            <label
              key={project.id}
              htmlFor={`import-project-${project.id}`}
              className="flex items-center gap-3"
            >
              <Checkbox
                id={`import-project-${project.id}`}
                checked={chosen.has(project.id)}
                onCheckedChange={(value) => toggle(project.id, Boolean(value))}
              />
              <span className="text-sm font-medium">{project.name}</span>
              {project.detail ? (
                <span className="text-xs text-muted-foreground">
                  {project.detail}
                </span>
              ) : null}
            </label>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between gap-4 border-t border-border pt-4">
        <div className="space-y-0.5">
          <Label className="text-sm font-medium">
            {t("settings:workspaceImport.projects.includeComments")}
          </Label>
          <p className="text-xs text-muted-foreground">
            {t("settings:workspaceImport.projects.includeCommentsHint")}
          </p>
        </div>
        <Switch
          checked={includeComments}
          onCheckedChange={onIncludeCommentsChange}
        />
      </div>

      {tooMany ? (
        <p className="text-xs text-destructive">
          {t("settings:workspaceImport.projects.tooMany", {
            max: MAX_IMPORT_PROJECTS,
          })}
        </p>
      ) : null}

      <div className="flex justify-between">
        <Button variant="ghost" size="sm" onClick={onBack}>
          {t("settings:workspaceImport.actions.back")}
        </Button>
        <Button
          size="sm"
          disabled={selected.length === 0 || tooMany || isStarting}
          onClick={onStart}
        >
          {t("settings:workspaceImport.actions.start", {
            count: selected.length,
          })}
        </Button>
      </div>
    </div>
  );
}
