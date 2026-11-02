# Manual Test Plans MVP

Project-scoped test management, distinct from task checklists and repository unit
tests. The project navigation exposes Define, Execute, Runs and Reports.

## Model and lifecycle

- `test_plan`: title/scope, optional sprint/release, Active or Archived.
- `test_suite`: static grouping within a plan. A case may be reused in many suites.
- `test_case`: project library, preconditions, ordered action/expected steps,
  optional work-item requirement, Draft/Ready/Retired and optimistic revision.
- `test_suite_case`: unique suite membership. Removing membership does not delete
  the case or previous test results.
- `test_run`: plan/suite scope, assigned tester, environment/build, creator and
  idempotent client key. In progress → Paused → In progress; Completed/Aborted
  are terminal states.
- `test_result`: one case per run, immutable definition snapshot, step outcomes,
  actual result, evidence URLs, optional Bug link and optimistic result version.

Start snapshots current Ready cases, deduplicating cases shared between suites.
Later case edits increment revision but cannot rewrite previous snapshots.
Retest creates a new run using current Ready revisions and memberships; it does
not reset or replace the previous Failed result. Closed runs cannot be edited.
Cases are retired and plans archived rather than hard deleted through this API.

Only the assigned tester or a test manager can write or transition a run. Only
managers can assign a run to another tester. The target must have current project
execution access and workspace membership. A run is never writable without the
actor's current execution permission, even if they were previously assigned.

## Permissions and migration

`test.read`, `test.design`, `test.manage`, `test.execute` are separate project
permissions. Owner has full access; default Member gets all four; default Viewer
gets read. Migration `0054_manual_test_plans` grants existing roles based on their
actual item/backlog capabilities, not role names. It does not replace customized
roles. Each REST endpoint also requires workspace access and project scope.

All requirement, sprint, suite, case and Bug references must belong to the URL's
project. Result IDs must belong to the URL's run. Changing the URL cannot access
objects from another project. There is no instance-global Test Plans endpoint.
Work items referenced by live case requirements or result Bug links cannot be
moved to another project; keep them in scope or create a copy in the destination.

Migration introduces six tables and their FKs/indexes. Project deletion follows
the existing authorized project lifecycle and cascades test data. Case/Bug/user
deletion clears live references, while the stored case snapshot remains readable.
The snapshot is execution history, not a full authoring revision archive.

## REST surface

Prefix: `/api/test-plans/:projectId`.

- `GET /`: plans, suites, case library, memberships and latest 100 project runs.
- `POST /plans`, `PUT /plans/:planId`: create/edit/archive/reopen a plan.
- `POST /plans/:planId/suites`, `PUT /plans/:planId/suites/:suiteId`: create/rename.
- `POST /cases`, `PUT /cases/:caseId`: create/revise/retire a manual case.
- `POST|DELETE /suites/:suiteId/cases/:caseId`: attach/detach reusable cases.
- `POST /plans/:planId/runs`: snapshot a selected suite or plan. Optional `caseIds`
  restricts the selection. Require 1–500 Ready cases and a client-generated key.
- `GET /runs/:runId`: run, snapshot results and selected-run summary.
- `PUT /runs/:runId/results/:resultId`: save all step outcomes and actual/evidence/
  Bug fields, supplying the last result `version`.
- `PATCH /runs/:runId`: pause/resume/complete/abort with last run `version`.

Stale writes return 409. Completed runs cannot contain Not run cases; abort is
available for a partially executed run. Passed requires every step Passed;
Failed requires at least one failed step. Blocked and Not applicable require a
reason. Explicit Save persists results; changing cases/run state is blocked by
the UI while there are unsaved edits. Discard explicitly reloads server results.

## Evidence, Bugs and reporting

Evidence is up to 20 HTTP(S) URLs without embedded credentials, not a new file
upload/recording service. The server never fetches those URLs. Existing evidence
access permissions remain the responsibility of the linked storage provider.

The UI can link an existing project Bug or explicitly create a Bug draft through
the existing Work Item creation API. Its description includes run/result IDs,
snapshot steps, expected/actual, environment/build and evidence. The tester then
saves the result to persist the Bug link. Creation and result Save are separate
actions; discarding a draft link does not delete the created Bug.

Reports describe one selected run. Executed = Passed + Failed + Blocked.
Applicable = Total − Not applicable. Pass rate = Passed / (Passed + Failed), null
when there is no verdict. Not run/Blocked/N/A are shown separately. This is not
code coverage or release approval. Old runs are not aggregated into a misleading
latest-release pass rate.

## Client and validation

`TestPlansApiType` / `testPlansClient` is a separate typed Hono client using the
same base URL, cookies and window ID as the existing client. Keep it separate
from the large `AppType` union to avoid TypeScript instantiation-depth failures.

`tests/api/test-plan/service.test.ts` executes the real migration, service and
Hono routes against embedded PostgreSQL (PGlite, development-only dependency).
It exercises scopes, permissions, snapshots, optimistic concurrency, idempotency,
pause/resume, immutable closed runs and retest history without external Postgres.
It is not a substitute for an external-PostgreSQL deployment smoke test.

```powershell
pnpm --dir apps/api exec vitest run --config vitest.config.ts ../../tests/api/test-plan/service.test.ts
pnpm --dir apps/web exec vitest run --config vitest.config.ts src/components/test-plans
```

Automated execution, unit-test imports, CI triggers, dynamic suites, shared steps,
configuration matrices and native screenshot/video capture are outside this MVP.
