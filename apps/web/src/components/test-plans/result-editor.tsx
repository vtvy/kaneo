import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/lib/toast";
import type { ResultInput, TestResult } from "./api";

const outcomes = [
  { value: "not_run", label: "Not run" },
  { value: "passed", label: "Passed" },
  { value: "failed", label: "Failed" },
  { value: "blocked", label: "Blocked" },
  { value: "not_applicable", label: "Not applicable" },
] as const;
export function outcomeLabel(value: string) {
  return outcomes.find((item) => item.value === value)?.label ?? value;
}
export default function ResultEditor({
  result,
  editable,
  pending,
  bugs,
  save,
  onDirty,
  createBug,
}: {
  result: TestResult;
  editable: boolean;
  pending: boolean;
  bugs: { id: string; number: number | null; title: string }[];
  save: (input: ResultInput) => void;
  onDirty: () => void;
  createBug?: (input: ResultInput) => Promise<string>;
}) {
  const formId = useId();
  const snapshotSteps = result.snapshot.steps.map((step, ordinal) => ({
    ...step,
    key: `${result.id}:${ordinal}`,
  }));
  const [outcome, setOutcome] = useState<ResultInput["outcome"]>(
    result.outcome,
  );
  const [actual, setActual] = useState(result.actual);
  const [evidence, setEvidence] = useState(result.evidence.join("\n"));
  const [bugId, setBugId] = useState(result.bugId ?? "");
  const [steps, setSteps] = useState(result.steps);
  const [dirty, setDirty] = useState(false);
  const [creatingBug, setCreatingBug] = useState(false);
  const locked = !editable || pending || creatingBug;
  return (
    <form
      className="space-y-4"
      onChange={() => {
        setDirty(true);
        onDirty();
      }}
      onSubmit={(event) => {
        event.preventDefault();
        save({
          version: result.version,
          outcome,
          actual,
          evidence: evidence
            .split("\n")
            .map((url) => url.trim())
            .filter(Boolean),
          bugId: bugId || null,
          steps,
        });
      }}
    >
      <div>
        <h3 className="font-medium">{result.snapshot.title}</h3>
        <p className="text-xs text-muted-foreground">
          Snapshot revision {result.snapshot.revision} · Result version{" "}
          {result.version}
        </p>
      </div>
      {result.snapshot.preconditions && (
        <div className="rounded bg-muted/40 p-3 text-sm whitespace-pre-wrap">
          <strong>Preconditions</strong>
          <p>{result.snapshot.preconditions}</p>
        </div>
      )}
      {snapshotSteps.map((step, index) => (
        <fieldset
          key={step.key}
          disabled={locked}
          className="space-y-2 border-t pt-3"
        >
          <legend className="text-xs">Step {index + 1}</legend>
          <p className="text-sm whitespace-pre-wrap">{step.action}</p>
          <p className="text-sm whitespace-pre-wrap text-muted-foreground">
            Expected: {step.expected}
          </p>
          <label className="text-sm">
            Step outcome{" "}
            <select
              aria-label={`Step ${index + 1} outcome`}
              className="rounded border bg-background p-2"
              value={steps[index]?.outcome ?? "not_run"}
              onChange={(e) =>
                setSteps((old) =>
                  old.map((entry, i) =>
                    i === index
                      ? {
                          ...entry,
                          outcome: e.target.value as ResultInput["outcome"],
                        }
                      : entry,
                  ),
                )
              }
            >
              {outcomes.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <Textarea
            aria-label={`Step ${index + 1} actual result`}
            placeholder="Actual result"
            maxLength={20000}
            value={steps[index]?.actual ?? ""}
            onChange={(e) =>
              setSteps((old) =>
                old.map((entry, i) =>
                  i === index ? { ...entry, actual: e.target.value } : entry,
                ),
              )
            }
          />
        </fieldset>
      ))}
      <fieldset disabled={locked} className="space-y-3 border-t pt-3">
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-sm">
            Case outcome{" "}
            <select
              aria-label="Case outcome"
              className="rounded border bg-background p-2"
              value={outcome}
              onChange={(e) => setOutcome(e.target.value as typeof outcome)}
            >
              {outcomes.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setSteps((old) =>
                old.map((entry) => ({ ...entry, outcome: "passed" })),
              );
              setOutcome("passed");
              setDirty(true);
              onDirty();
            }}
          >
            Mark all steps Passed
          </Button>
        </div>
        <label htmlFor={`${formId}-actual`} className="block text-sm">
          Actual result / reason
          <Textarea
            id={`${formId}-actual`}
            aria-label="Overall actual result"
            maxLength={20000}
            value={actual}
            onChange={(e) => setActual(e.target.value)}
          />
        </label>
        <label htmlFor={`${formId}-evidence`} className="block text-sm">
          Evidence links · one HTTP(S) URL per line
          <Textarea
            id={`${formId}-evidence`}
            aria-label="Evidence links"
            value={evidence}
            onChange={(e) => setEvidence(e.target.value)}
          />
        </label>
        <label className="block text-sm">
          Linked Bug{" "}
          <select
            aria-label="Linked Bug"
            className="max-w-full rounded border bg-background p-2"
            value={bugId}
            onChange={(e) => setBugId(e.target.value)}
          >
            <option value="">No Bug linked</option>
            {bugId && !bugs.some((bug) => bug.id === bugId) && (
              <option value={bugId}>Linked Bug</option>
            )}
            {bugs.map((bug) => (
              <option key={bug.id} value={bug.id}>
                #{bug.number} {bug.title}
              </option>
            ))}
          </select>
        </label>
        {createBug && outcome === "failed" && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={Boolean(bugId) || creatingBug}
            onClick={async () => {
              setDirty(true);
              onDirty();
              setCreatingBug(true);
              try {
                const id = await createBug({
                  version: result.version,
                  outcome,
                  actual,
                  evidence: evidence
                    .split("\n")
                    .map((url) => url.trim())
                    .filter(Boolean),
                  bugId: null,
                  steps,
                });
                setBugId(id);
                setDirty(true);
                onDirty();
                toast.success("Bug created. Save the result to keep its link.");
              } catch (error) {
                toast.error(
                  error instanceof Error
                    ? error.message
                    : "Unable to create Bug",
                );
              } finally {
                setCreatingBug(false);
              }
            }}
          >
            Create Bug from failure
          </Button>
        )}
        {editable && (
          <Button type="submit" disabled={pending}>
            Save result
          </Button>
        )}
      </fieldset>
      <p className="text-xs text-muted-foreground">
        {dirty && editable
          ? "Unsaved changes — save before switching cases or changing run state."
          : "Saved results remain available when you reopen this run."}
      </p>
      {result.evidence.length > 0 && (
        <ul className="space-y-1 text-xs">
          {result.evidence.map((url) => (
            <li key={url}>
              <a
                className="text-primary underline break-all"
                href={url}
                target="_blank"
                rel="noreferrer"
              >
                {url}
              </a>
            </li>
          ))}
        </ul>
      )}
    </form>
  );
}
