import { normalizeGitlabBaseUrl } from "../config";

export function baseUrlFromRepositoryHtmlUrl(htmlUrl: string): string {
  try {
    const u = new URL(htmlUrl);
    const segments = u.pathname.split("/").filter(Boolean);
    if (segments.length < 2) {
      return "";
    }

    const basePathSegments = segments.slice(0, -2);
    const basePath =
      basePathSegments.length > 0 ? `/${basePathSegments.join("/")}` : "";

    return normalizeGitlabBaseUrl(`${u.origin}${basePath}`);
  } catch {
    return "";
  }
}
