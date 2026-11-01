import { normalizeGitlabBaseUrl } from "../config";

/**
 * GitLab API returns web_url with the instance's public hostname, which may
 * differ from the baseUrl used to connect (LAN IP vs DNS). Rebuild the link
 * so clicks follow the configured host.
 */
export function rewriteGitlabUrl(
  configBaseUrl: string,
  remoteUrl: string,
): string {
  try {
    const configured = new URL(normalizeGitlabBaseUrl(configBaseUrl));
    const remote = new URL(remoteUrl);
    const basePath = configured.pathname.replace(/\/+$/, "");
    return `${configured.origin}${basePath}${remote.pathname}${remote.search}${remote.hash}`;
  } catch {
    return remoteUrl;
  }
}
