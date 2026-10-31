const STORAGE_KEY = "kaneo:create-task-push-gitlab";

export function getCreateTaskPushGitlabPref(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

export function setCreateTaskPushGitlabPref(value: boolean): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, value ? "true" : "false");
  } catch {
    // ignore quota / private mode
  }
}
