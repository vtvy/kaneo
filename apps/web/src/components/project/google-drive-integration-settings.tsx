import {
  Check,
  Copy,
  FolderOpen,
  HardDrive,
  Loader2,
  Pencil,
  Unlink,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import getDriveConnectUrl from "@/fetchers/google-drive-integration/get-drive-connect-url";
import useDisconnectDrive from "@/hooks/mutations/google-drive-integration/use-disconnect-drive";
import useSaveDriveCredentials from "@/hooks/mutations/google-drive-integration/use-save-drive-credentials";
import useSetDriveFolder from "@/hooks/mutations/google-drive-integration/use-set-drive-folder";
import useDriveStatus from "@/hooks/queries/google-drive-integration/use-drive-status";
import { copyText } from "@/lib/copy-text";
import { toast } from "@/lib/toast";
import DriveFolderPickerDialog from "./drive-folder-picker-dialog";

type DriveStatus = {
  configured?: boolean;
  connected: boolean;
  clientId?: string | null;
  redirectUri?: string;
  accountEmail?: string | null;
  rootFolderId?: string | null;
  rootFolderName?: string | null;
};

export function GoogleDriveIntegrationSettings({
  projectId,
  disabled = false,
}: {
  projectId: string;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  const { data, isLoading } = useDriveStatus(projectId);
  const status = data as DriveStatus | undefined;
  const saveCreds = useSaveDriveCredentials(projectId);
  const setFolder = useSetDriveFolder(projectId);
  const disconnect = useDisconnectDrive(projectId);
  const [connecting, setConnecting] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [editingCreds, setEditingCreds] = useState(false);
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");

  // Surface the OAuth callback result (?drive=connected|error|norefresh).
  useEffect(() => {
    const result = new URLSearchParams(window.location.search).get("drive");
    if (!result) return;
    if (result === "connected") {
      toast.success(t("settings:googleDrive.connectedToast"));
    } else if (result === "norefresh") {
      toast.error(t("settings:googleDrive.norefreshToast"));
    } else {
      toast.error(t("settings:googleDrive.errorToast"));
    }
    const url = new URL(window.location.href);
    url.searchParams.delete("drive");
    window.history.replaceState({}, "", url.toString());
  }, [t]);

  const configured = Boolean(status?.configured);
  const connected = Boolean(status?.connected);
  const redirectUri = status?.redirectUri ?? "";
  const showForm = !configured || editingCreds;

  const handleSaveCreds = async () => {
    if (!clientId.trim() || !clientSecret.trim()) {
      toast.error(t("settings:googleDrive.credsRequired"));
      return;
    }
    try {
      await saveCreds.mutateAsync({
        clientId: clientId.trim(),
        clientSecret: clientSecret.trim(),
      });
      toast.success(t("settings:googleDrive.credsSavedToast"));
      setEditingCreds(false);
      setClientId("");
      setClientSecret("");
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : t("settings:googleDrive.errorToast"),
      );
    }
  };

  const handleConnect = async () => {
    setConnecting(true);
    try {
      const { url } = await getDriveConnectUrl(projectId);
      window.location.href = url;
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : t("settings:googleDrive.errorToast"),
      );
      setConnecting(false);
    }
  };

  const handleCopyRedirect = async () => {
    try {
      await copyText(redirectUri);
      toast.success(t("settings:googleDrive.copiedToast"));
    } catch {
      // ignore clipboard errors
    }
  };

  const handleSelectFolder = async (folderId: string, folderName: string) => {
    try {
      await setFolder.mutateAsync({
        rootFolderId: folderId,
        rootFolderName: folderName,
      });
      toast.success(
        t("settings:googleDrive.folderSetToast", { name: folderName }),
      );
      setPickerOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    }
  };

  const handleDisconnect = async () => {
    try {
      await disconnect.mutateAsync();
      toast.success(
        connected
          ? t("settings:googleDrive.disconnectedToast")
          : t("settings:googleDrive.credsRemovedToast"),
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground text-sm">
        <Loader2 className="size-4 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Credentials — configured per project, no .env required. */}
      <div className="space-y-3 rounded-lg border border-border bg-sidebar p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="space-y-0.5">
            <p className="font-medium text-sm">
              {t("settings:googleDrive.credsTitle")}
            </p>
            <p className="text-muted-foreground text-xs">
              {t("settings:googleDrive.credsHint")}
            </p>
          </div>
          {configured && !editingCreds && (
            <Badge variant="secondary" className="gap-1">
              <Check className="size-3" />
              {t("settings:googleDrive.credsConfigured")}
            </Badge>
          )}
        </div>

        {redirectUri && (
          <div className="space-y-1">
            <p className="text-muted-foreground text-xs">
              {t("settings:googleDrive.redirectUriLabel")}
            </p>
            <div className="flex items-center gap-2">
              <code className="block flex-1 break-all rounded bg-muted px-2 py-1 text-[11px]">
                {redirectUri}
              </code>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleCopyRedirect}
              >
                <Copy className="size-3.5" />
                {t("settings:googleDrive.copy")}
              </Button>
            </div>
            <p className="text-muted-foreground text-xs">
              {t("settings:googleDrive.redirectUriHint")}
            </p>
          </div>
        )}

        {showForm ? (
          <div className="space-y-3">
            <div className="space-y-1">
              <label
                className="text-muted-foreground text-xs"
                htmlFor="gd-client-id"
              >
                {t("settings:googleDrive.clientIdLabel")}
              </label>
              <Input
                id="gd-client-id"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                placeholder="xxxx.apps.googleusercontent.com"
                autoComplete="off"
                disabled={disabled || saveCreds.isPending}
              />
            </div>
            <div className="space-y-1">
              <label
                className="text-muted-foreground text-xs"
                htmlFor="gd-client-secret"
              >
                {t("settings:googleDrive.clientSecretLabel")}
              </label>
              <Input
                id="gd-client-secret"
                type="password"
                value={clientSecret}
                onChange={(e) => setClientSecret(e.target.value)}
                placeholder={
                  configured
                    ? t("settings:googleDrive.clientSecretPlaceholderUpdate")
                    : "GOCSPX-..."
                }
                autoComplete="off"
                disabled={saveCreds.isPending}
              />
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={handleSaveCreds}
                disabled={saveCreds.isPending}
              >
                {saveCreds.isPending && (
                  <Loader2 className="size-3.5 animate-spin" />
                )}
                {t("settings:googleDrive.saveCreds")}
              </Button>
              {configured && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setEditingCreds(false);
                    setClientId("");
                    setClientSecret("");
                  }}
                  disabled={saveCreds.isPending}
                >
                  {t("settings:googleDrive.cancel")}
                </Button>
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-muted-foreground text-xs">
                {t("settings:googleDrive.clientIdLabel")}
              </p>
              <p className="truncate font-medium text-sm">{status?.clientId}</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEditingCreds(true)}
              disabled={disabled}
            >
              <Pencil className="size-3.5" />
              {t("settings:googleDrive.editCreds")}
            </Button>
          </div>
        )}
      </div>

      {/* Connection — only once credentials are saved. */}
      {configured &&
        (connected ? (
          <div className="space-y-4 rounded-lg border border-border bg-sidebar p-4">
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="gap-1">
                <Check className="size-3" />
                {t("settings:googleDrive.connected")}
              </Badge>
              {status?.accountEmail && (
                <span className="text-muted-foreground text-sm">
                  {status.accountEmail}
                </span>
              )}
            </div>

            <div className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
              <div className="min-w-0">
                <p className="text-muted-foreground text-xs">
                  {t("settings:googleDrive.rootFolder")}
                </p>
                <p className="truncate font-medium text-sm">
                  {status?.rootFolderName || t("settings:googleDrive.noFolder")}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPickerOpen(true)}
                disabled={disabled}
              >
                <FolderOpen className="size-3.5" />
                {status?.rootFolderId
                  ? t("settings:googleDrive.changeFolder")
                  : t("settings:googleDrive.chooseFolder")}
              </Button>
            </div>

            <Button
              variant="outline"
              size="sm"
              className="text-destructive hover:text-destructive"
              onClick={handleDisconnect}
              disabled={disconnect.isPending}
            >
              <Unlink className="size-3.5" />
              {t("settings:googleDrive.disconnect")}
            </Button>

            <DriveFolderPickerDialog
              open={pickerOpen}
              projectId={projectId}
              pending={setFolder.isPending}
              onSelect={handleSelectFolder}
              onClose={() => setPickerOpen(false)}
            />
          </div>
        ) : (
          <div className="space-y-3 rounded-lg border border-border bg-sidebar p-4">
            <p className="text-muted-foreground text-sm">
              {t("settings:googleDrive.notConnected")}
            </p>
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={handleConnect}
                disabled={disabled || connecting}
              >
                {connecting ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <HardDrive className="size-3.5" />
                )}
                {t("settings:googleDrive.connect")}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-destructive hover:text-destructive"
                onClick={handleDisconnect}
                disabled={disconnect.isPending}
              >
                <Unlink className="size-3.5" />
                {t("settings:googleDrive.removeCreds")}
              </Button>
            </div>
          </div>
        ))}
    </div>
  );
}
