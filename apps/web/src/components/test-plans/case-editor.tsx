import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { CaseInput, TestCase } from "./api";
import { newTestRequestKey } from "./new-request-key";

export default function CaseEditor({
  existing,
  items,
  pending,
  save,
  cancel,
}: {
  existing?: TestCase;
  items: { id: string; number: number | null; title: string }[];
  pending: boolean;
  save: (input: CaseInput) => void;
  cancel: () => void;
}) {
  const formId = useId();
  const [title, setTitle] = useState(existing?.title ?? "");
  const [preconditions, setPreconditions] = useState(
    existing?.preconditions ?? "",
  );
  const [requirementId, setRequirementId] = useState(
    existing?.requirementId ?? "",
  );
  const [state, setState] = useState<CaseInput["state"]>(
    (existing?.state as CaseInput["state"]) ?? "ready",
  );
  const [steps, setSteps] = useState(() =>
    (existing?.steps ?? [{ action: "", expected: "" }]).map((step) => ({
      ...step,
      editorKey: newTestRequestKey(),
    })),
  );
  return (
    <form
      className="space-y-4 rounded-lg border p-4"
      onSubmit={(event) => {
        event.preventDefault();
        save({
          title,
          preconditions,
          requirementId: requirementId || null,
          state,
          steps: steps.map(({ action, expected }) => ({ action, expected })),
        });
      }}
    >
      <h3 className="font-medium">
        {existing
          ? `Edit case · revision ${existing.revision}`
          : "New manual test case"}
      </h3>
      <label htmlFor={`${formId}-title`} className="block space-y-1 text-sm">
        Title
        <Input
          type="text"
          id={`${formId}-title`}
          aria-label="Case title"
          required
          maxLength={500}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </label>
      <label
        htmlFor={`${formId}-preconditions`}
        className="block space-y-1 text-sm"
      >
        Preconditions
        <Textarea
          id={`${formId}-preconditions`}
          aria-label="Case preconditions"
          maxLength={20000}
          value={preconditions}
          onChange={(e) => setPreconditions(e.target.value)}
        />
      </label>
      <div className="flex flex-wrap gap-3">
        <label className="text-sm">
          State{" "}
          <select
            className="rounded border bg-background p-2"
            aria-label="Case state"
            value={state}
            onChange={(e) => setState(e.target.value as typeof state)}
          >
            <option value="draft">Draft</option>
            <option value="ready">Ready</option>
            <option value="retired">Retired</option>
          </select>
        </label>
        <label className="min-w-0 text-sm">
          Requirement{" "}
          <select
            className="max-w-full rounded border bg-background p-2"
            aria-label="Case requirement"
            value={requirementId}
            onChange={(e) => setRequirementId(e.target.value)}
          >
            <option value="">No requirement</option>
            {requirementId &&
              !items.some((item) => item.id === requirementId) && (
                <option value={requirementId}>Linked requirement</option>
              )}
            {items.map((item) => (
              <option key={item.id} value={item.id}>
                #{item.number} {item.title}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="space-y-3">
        {steps.map((step, index) => (
          <fieldset
            key={step.editorKey}
            className="grid gap-2 border-t pt-3 sm:grid-cols-2"
          >
            <legend className="text-xs text-muted-foreground">
              Step {index + 1}
            </legend>
            <label
              htmlFor={`${formId}-${step.editorKey}-action`}
              className="text-sm"
            >
              Action
              <Textarea
                id={`${formId}-${step.editorKey}-action`}
                aria-label={`Step ${index + 1} action`}
                required
                maxLength={500}
                value={step.action}
                onChange={(e) =>
                  setSteps((old) =>
                    old.map((entry, i) =>
                      i === index
                        ? { ...entry, action: e.target.value }
                        : entry,
                    ),
                  )
                }
              />
            </label>
            <label
              htmlFor={`${formId}-${step.editorKey}-expected`}
              className="text-sm"
            >
              Expected result
              <Textarea
                id={`${formId}-${step.editorKey}-expected`}
                aria-label={`Step ${index + 1} expected`}
                required
                maxLength={5000}
                value={step.expected}
                onChange={(e) =>
                  setSteps((old) =>
                    old.map((entry, i) =>
                      i === index
                        ? { ...entry, expected: e.target.value }
                        : entry,
                    ),
                  )
                }
              />
            </label>
            <Button
              type="button"
              size="xs"
              variant="ghost"
              disabled={steps.length <= 1}
              onClick={() =>
                setSteps((old) => old.filter((_, i) => i !== index))
              }
            >
              Remove step {index + 1}
            </Button>
          </fieldset>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={steps.length >= 100}
          onClick={() =>
            setSteps((old) => [
              ...old,
              { action: "", expected: "", editorKey: newTestRequestKey() },
            ])
          }
        >
          Add step
        </Button>
        <Button type="submit" disabled={pending || !title.trim()}>
          Save case
        </Button>
        <Button type="button" variant="ghost" onClick={cancel}>
          Cancel
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Saving creates a new revision. Existing runs keep the snapshot they
        started with.
      </p>
    </form>
  );
}
