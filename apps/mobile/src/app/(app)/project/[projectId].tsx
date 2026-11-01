import { router, useLocalSearchParams } from "expo-router";
import { Loading, Notice, Row, Screen } from "@/components/ui";
import { routeParam } from "@/lib/format";
import { useProjectAccess } from "@/lib/use-project-access";

export default function ProjectScreen() {
  const params = useLocalSearchParams<{
    projectId: string;
    workspaceId?: string;
    projectName?: string;
  }>();
  const projectId = routeParam(params.projectId);
  const workspaceId = routeParam(params.workspaceId);
  const projectName = routeParam(params.projectName);
  const { loading, error, allowed } = useProjectAccess(projectId);
  const canRead = allowed("item", "read");
  const canViewDocs = allowed("doc", "view");

  return (
    <Screen back title={projectName || "Dự án"}>
      {error ? <Notice tone="error">{error}</Notice> : null}
      {loading ? <Loading /> : null}
      {!loading && !canRead && !canViewDocs ? (
        <Notice>Bạn không có quyền xem nội dung dự án này.</Notice>
      ) : null}
      {canRead ? (
        <Row
          onPress={() =>
            router.push({
              pathname: "/board/[projectId]",
              params: { projectId, workspaceId, projectName },
            })
          }
          subtitle="Cột và việc"
          title="Bảng"
        />
      ) : null}
      {canRead ? (
        <Row
          onPress={() =>
            router.push({
              pathname: "/sprints/[projectId]",
              params: { projectId, projectName },
            })
          }
          subtitle="Danh sách sprint"
          title="Sprint"
        />
      ) : null}
      {canViewDocs ? (
        <Row
          onPress={() =>
            router.push({
              pathname: "/documents/[projectId]",
              params: { projectId, projectName },
            })
          }
          subtitle="Tệp đính kèm"
          title="Tài liệu"
        />
      ) : null}
    </Screen>
  );
}
