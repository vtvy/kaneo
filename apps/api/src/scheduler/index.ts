import { Cron } from "croner";
import { checkSprintLifecycle } from "../sprint/sprint-notifications";
import { checkDueDateReminders } from "./due-date-reminders";

const jobs: Cron[] = [];

export function initializeScheduler(): void {
  jobs.push(new Cron("*/5 * * * *", checkDueDateReminders));
  jobs.push(
    new Cron("*/5 * * * *", { protect: true }, () => checkSprintLifecycle()),
  );
  console.log(
    "⏰ Scheduler started (due date reminders + sprint start/end every 5 minutes)",
  );
}

export function shutdownScheduler(): void {
  for (const job of jobs) {
    job.stop();
  }
  jobs.length = 0;
}
