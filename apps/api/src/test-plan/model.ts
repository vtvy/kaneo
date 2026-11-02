export const OUTCOMES = [
  "not_run",
  "passed",
  "failed",
  "blocked",
  "not_applicable",
] as const;
export type Outcome = (typeof OUTCOMES)[number];
export type TestStep = { action: string; expected: string };
export type CaseSnapshot = {
  caseId: string;
  revision: number;
  title: string;
  preconditions: string;
  steps: TestStep[];
  requirementId: string | null;
};
export type StepResult = { outcome: Outcome; actual: string };

export function summarizeResults(results: { outcome: string }[]) {
  const counts = {
    total: results.length,
    not_run: 0,
    passed: 0,
    failed: 0,
    blocked: 0,
    not_applicable: 0,
  };
  for (const result of results)
    if (OUTCOMES.includes(result.outcome as Outcome))
      counts[result.outcome as Outcome]++;
  const verdicts = counts.passed + counts.failed;
  return {
    ...counts,
    executed: verdicts + counts.blocked,
    passRate: verdicts ? counts.passed / verdicts : null,
  };
}

export function validateResult(
  outcome: Outcome,
  steps: StepResult[],
  expectedSteps: number,
) {
  if (steps.length !== expectedSteps)
    return "Provide a result for every snapshot step";
  if (outcome === "passed" && steps.some((step) => step.outcome !== "passed"))
    return "All steps must pass before marking the case Passed";
  if (outcome === "failed" && !steps.some((step) => step.outcome === "failed"))
    return "Mark at least one failed step";
  return null;
}
