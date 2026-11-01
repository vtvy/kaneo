import * as DocumentPicker from "expo-document-picker";
import { useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ScrollView } from "react-native";
import { Button, Loading, Notice, Row, Screen } from "@/components/ui";
import {
  downloadDocument,
  listDocuments,
  listFolders,
  uploadDocument,
} from "@/lib/api";
import {
  errorMessage,
  formatBytes,
  formatWhen,
  routeParam,
} from "@/lib/format";
import type { DocumentItem, FolderItem } from "@/lib/types";
import { useProjectAccess } from "@/lib/use-project-access";

export default function DocumentsScreen() {
  const params = useLocalSearchParams<{
    projectId: string;
    projectName?: string;
  }>();
  const projectId = routeParam(params.projectId);
  const projectName = routeParam(params.projectName);
  const access = useProjectAccess(projectId);
  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [folderId, setFolderId] = useState<string | null>(null);
  const [trail, setTrail] = useState<{ id: string | null; name: string }[]>([
    { id: null, name: "Gốc" },
  ]);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const canView = access.allowed("doc", "view");
  const canUpload = access.allowed("doc", "upload");

  const load = useCallback(() => {
    if (!canView) return;
    setLoading(true);
    setNote(null);
    Promise.all([listFolders(projectId), listDocuments(projectId, folderId)])
      .then(([nextFolders, nextDocuments]) => {
        setFolders(nextFolders);
        setDocuments(nextDocuments);
        setError(null);
      })
      .catch((reason: unknown) => setError(errorMessage(reason)))
      .finally(() => setLoading(false));
  }, [canView, folderId, projectId]);

  useEffect(() => {
    if (access.loading) return;
    load();
  }, [access.loading, load]);

  const visibleFolders = folders.filter((folder) =>
    folderId ? folder.parentId === folderId : folder.parentId === null,
  );

  async function openDownload(item: DocumentItem) {
    setBusyId(item.id);
    setError(null);
    setNote(null);
    try {
      const filename = await downloadDocument(item.id, item.name);
      setNote(
        item.source === "google_drive"
          ? `Đã tải ${filename}. Tệp trên Google Drive không bị xóa.`
          : `Đã tải ${filename}.`,
      );
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setBusyId(null);
    }
  }

  async function pickAndUpload() {
    const picked = await DocumentPicker.getDocumentAsync({
      copyToCacheDirectory: true,
      multiple: false,
    });
    if (picked.canceled) return;
    const asset = picked.assets[0];
    if (!asset) return;
    setBusyId("upload");
    setError(null);
    try {
      await uploadDocument(
        projectId,
        {
          uri: asset.uri,
          name: asset.name,
          mimeType: asset.mimeType ?? null,
        },
        folderId,
      );
      load();
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Screen back title={projectName ? `Tài liệu · ${projectName}` : "Tài liệu"}>
      <ScrollView>
        {access.error ? <Notice tone="error">{access.error}</Notice> : null}
        {error ? <Notice tone="error">{error}</Notice> : null}
        {note ? <Notice>{note}</Notice> : null}
        {!access.loading && !canView ? (
          <Notice>Bạn không có quyền xem tài liệu.</Notice>
        ) : null}
        <Notice>{trail.map((item) => item.name).join(" / ")}</Notice>
        {trail.length > 1 ? (
          <Button
            label="Thư mục cha"
            onPress={() => {
              const next = trail.slice(0, -1);
              setTrail(next);
              setFolderId(next[next.length - 1]?.id ?? null);
            }}
          />
        ) : null}
        {canUpload ? (
          <Button
            disabled={busyId === "upload"}
            label="Tải tệp lên máy chủ"
            onPress={() => {
              void pickAndUpload();
            }}
          />
        ) : null}
        {loading || access.loading ? <Loading /> : null}
        {visibleFolders.map((folder) => (
          <Row
            key={folder.id}
            onPress={() => {
              setFolderId(folder.id);
              setTrail((current) => [
                ...current,
                { id: folder.id, name: folder.name },
              ]);
            }}
            subtitle="Thư mục"
            title={folder.name}
          />
        ))}
        {documents.map((item) => {
          const drive = item.source === "google_drive";
          return (
            <Row
              key={item.id}
              onPress={() => {
                if (busyId) return;
                void openDownload(item);
              }}
              subtitle={[
                drive ? "Google Drive — chỉ hiển thị" : "Máy chủ",
                item.contentType,
                formatBytes(item.size),
                item.createdByName,
                formatWhen(item.createdAt),
                drive && item.externalUrl ? item.externalUrl : null,
              ]
                .filter(Boolean)
                .join(" · ")}
              title={item.name}
            />
          );
        })}
        {!loading &&
        canView &&
        documents.length === 0 &&
        visibleFolders.length === 0 ? (
          <Notice>Thư mục này trống.</Notice>
        ) : null}
      </ScrollView>
    </Screen>
  );
}
