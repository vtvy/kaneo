# Bản đồ thay đổi của fork và hướng dẫn cập nhật upstream

Tài liệu dành cho người bảo trì và coding agent khi đồng bộ Kaneo từ upstream.
Mục tiêu là biết một tính năng cũ hiện tương ứng với tính năng nào, tìm code ở đâu,
và giữ hợp đồng dữ liệu/hành vi nào khi nhận thay đổi mới.

Đây là tài liệu sống về **khác biệt sản phẩm và migration**, không thay thế
`CHANGELOG.md`, lịch sử Git hay kiểm thử. Không dùng tên giống nhau để kết luận
hai triển khai đã tương thích.

## 1. Mốc đối chiếu

- Ngày kiểm tra: **02/11/2026**, múi giờ Asia/Bangkok.
- Upstream: `https://github.com/usekaneo/kaneo.git`, remote `upstream`.
- Fork: `https://github.com/vtvy/kaneo`, remote `origin`.
- Baseline fork trước Work Items: `b8d146d3e` trên `feat/batch-22`.
- Base PR trên origin/main: `f463d384b`.
- Work Items: `aae5d648fc7724a396ab45e10dc1f1d189b3fb4a` trên `codex/work-item-hierarchy` (chưa xác nhận release/production).
- Upstream đã fetch: `dd92f6bc9b5f86b3b4dfc396026350d220e129a5`.
- Tổ tiên chung: `f303cec3ce8c8086ba6430d4487338b3033a5890`.
- Tại mốc này: upstream có 2.019 commit riêng, fork có 31 commit riêng,
  tính bằng `git rev-list --left-right --count upstream/main...HEAD`.
- Các số liệu phân kỳ bên trên thuộc baseline ban đầu trước khi tạo PR.
  Work Items/hierarchy đã có commit ở nhánh PR; không coi là đã phát hành.
- Không suy diễn nhánh đang mở là nhánh tích hợp/chạy production của fork.

“Upstream” trong phần tên cũ có thể chỉ baseline chung; upstream hiện tại đã phát
triển thêm admin, custom fields, GitLab, imports, sessions, mobile và CLI. Những
nhóm này cần đối chiếu triển khai, không được coi mặc định là chỉ fork mới có.

## 2. Từ điển sản phẩm đã chốt

### Công việc và loại công việc

- **Work item / Công việc**: khái niệm chung cho tất cả đối tượng công việc.
- **Epic** (`epic`) → **Feature** (`feature`) → **Backlog Item** (`backlog_item`)
  → **Task** (`task`).
- **Bug** (`bug`) được đặt dưới Feature và có thể chứa Task.
- Epic, Feature, Backlog Item, Bug và Task có thể tồn tại độc lập khi chưa có cha.
- Không dùng User Story, PBI hoặc Issue như các tên đồng nghĩa tùy tiện của
  Backlog Item trong UI mặc định.
- **Task chỉ là một loại work item**, không còn là tên bao quát mọi loại.
- Màu nhận diện loại: Epic tím, Feature chàm, Backlog Item xanh lá,
  Task vàng/nâu, Bug đỏ. Màu loại không biểu diễn trạng thái hoàn thành.

### Bốn góc nhìn của cùng dữ liệu

1. **Work items**: bảng tổng hợp mọi loại, lọc và chỉnh type/parent/sprint.
2. **Boards**: Kanban theo trạng thái; lọc loại, xem tiến độ con, thêm con trên card.
3. **Backlogs**: cây cha–con, ưu tiên trong từng nhóm anh em, Planning vào sprint.
4. **Sprints**: chọn sprint, nhóm theo Backlog Item/Bug, Task con đi qua các cột.
   Tab Sprint management giữ chức năng CRUD/complete/report hiện có.

Backlog là góc nhìn/danh sách, **Backlog Item là loại công việc**.
Unplanned nghĩa là chưa được gán sprint; không đồng nghĩa toàn bộ Product Backlog.

## 3. Các thay thế trực tiếp: tên cũ → điểm đến hiện tại

### MAP-01 — Task model → mô hình work item có kiểu

- Tên khái niệm chung: Task → Work item; loại Task vẫn tồn tại.
- **Giữ bảng `task`, ID và số công việc hiện có**; không đổi bảng thành `work_item`.
- `task.type` lưu năm loại đã chốt; `task.parent_id` lưu cha của cây mới.
- `task.backlog_rank` phục vụ backlog; `task.position` vẫn phục vụ Board.
- Code: `apps/api/src/database/schema.ts`, `apps/api/src/work-item/`.
- API cũ `/api/task/*` vẫn tồn tại để giữ tương thích client/integration.
- API bổ sung `/api/work-items/:projectId` (GET/POST) và
  `/api/work-items/:projectId/:id` (PATCH) phục vụ type/parent/rank/sprint.
- Tạo qua API task cũ có thể truyền `workItemType`; API mới dùng `type`.
  Đây là khác biệt hợp đồng API tương thích ngược, không phải hai loại dữ liệu.
- Khi nhận upstream: port các cải tiến task vào model chung. Không mặc định
  mọi row trong `task` là loại Task; không chỉ nâng cấp một trong hai đường API.

### MAP-02 — Màn Tasks/Board → Boards

- URL Board giữ nguyên: `/dashboard/workspace/$workspaceId/project/$projectId/board`.
- Giữ Kanban, list mode, queue thao tác kéo card và sheet chi tiết hiện có.
- Bổ sung type filter, badge, tiến độ con và thêm con trên card cha.
- Code: route `board.tsx`, `components/kanban-board/`,
  `components/work-items/card-children.tsx` trong `apps/web/src/`.
- Khi nhận upstream: cải tiến card, drag/drop, status, assignment và labels
  vẫn cần port vào Boards. Giữ `type`/`parentId` trong fetcher/serializer/cache.
- “All types” là lựa chọn hiển thị, không đổi type của dữ liệu.

### MAP-03 — Bảng Backlog cũ → Work items; Backlogs → cây

- Màn Backlogs mới dùng URL `/.../backlog`, render `WorkItems` với `mode="tree"`.
- Màn Work items mới dùng `/.../work-items`, render với `mode="items"`.
- Code chính: `apps/web/src/components/work-items/index.tsx` và các route
  `work-items.tsx`, `backlog.tsx` trong thư mục project.
- Bảng cũ `components/backlog-table/` và hook saved views vẫn còn trong repo,
  nhưng route Backlogs mới **không render bảng cũ**. Không coi sự tồn tại của
  component/hook là bằng chứng tính năng đó đang có trên màn hình mới.
- Các khả năng saved views/custom-field columns của bảng cũ chưa được tự động
  chuyển hết vào bảng Work items mới. Dữ liệu local storage cũ không bị migration
  xóa, nhưng cũng chưa có migration UI cho chúng. Đây là phần cần đối chiếu tiếp.
- Khi nhận upstream: tìm cải tiến bảng/list/filter ở cả code cũ lẫn code mới;
  chuyển cải tiến phù hợp vào Work items, không ghi đè Backlogs trở lại bảng phẳng.

### MAP-04 — Danh sách sprint → Sprint Taskboard + Sprint management

- Giữ URL `/.../sprints` và bảng `sprint`.
- Taskboard nhóm cha Backlog Item/Bug và các Task con theo cột trạng thái.
- Parent có thể hiện làm ngữ cảnh khi Task con thuộc sprint được chọn, dù cha
  thuộc sprint khác. Không làm mất khả năng quan sát task do carry-over.
- `SprintsPanel` cũ được giữ trong tab Sprint management.
- Đưa cha vào/bỏ khỏi sprint qua luồng mới sẽ cập nhật cả cây con và history
  trong transaction. Hai controller assign/remove cũ cũng dùng
  `apps/api/src/work-item/assign-sprint.ts`.
- Code báo cáo: `apps/api/src/sprint/controllers/get-sprint-report.ts`,
  `completionSnapshot`; history: `task_sprint`, `sync-task-sprint-membership.ts`.
- Khi nhận upstream: không thay cơ chế date-derived current sprint bằng nút Start
  nếu chưa quyết định lại sản phẩm; không bỏ snapshot hay history khi di chuyển.
- Capacity, forecasting và burndown đầy đủ là kế hoạch riêng, chưa đồng nghĩa
  đã triển khai chỉ vì hiện đã có Taskboard và completion report.

### MAP-05 — Subtask relation cũ và parent mới: chưa phải cùng hợp đồng

- `task_relation` với `relationType="subtask"` là cơ chế liên kết cũ.
- Cây mới dùng `task.parent_id` cùng ràng buộc type/project ở DB và API.
- Migration 0053 **không tự chuyển** các subtask relations cũ thành parent mới
  và không tự đổi Task cha cũ thành Backlog Item.
- Các link `blocks`, `related`, `bug`, `cause` không phải parent của cây.
- Khi nhận upstream: đừng dùng task relations để suy ra cây mới hoặc ngược lại.
  Nếu hợp nhất hai cơ chế, phải có migration riêng: phát hiện nhiều cha/cycle,
  khác project, chọn type cha, giải quyết trùng và kiểm chứng quyền cả hai đầu.

## 4. Migration dữ liệu của Work Items

Migration: `apps/api/drizzle/0053_work_item_hierarchy.sql`, journal và snapshot
`0053_snapshot.json`. Trạng thái hiện tại: đã nằm trong commit Work Items ghi ở mục 1; chưa xác nhận áp dụng trên DB production.

1. Thêm `type` mặc định `task`, `parent_id` nullable, `backlog_rank` mặc định 0.
2. Backfill rank theo project từ `position`, `number`, `created_at`; giữ `position`.
3. Giữ nguyên title/description/status/ID/number/sprint/assignee của dữ liệu cũ.
4. FK cha xóa theo `SET NULL`: xóa cha giữ lại công việc con.
5. Check constraints giới hạn type và chặn tự làm cha.
6. Function/trigger `validate_work_item_parent` và `task_hierarchy_guard` kiểm tra
   cùng project, đúng cấp, tương thích các con khi đổi type/project.
7. Cây có cấp nghiêm ngặt nên không cho tạo vòng; API còn kiểm tra ancestor cycle.

**Khi upstream cũng có migration số 0053:** không chọn một file theo số.
Đối chiếu migration theo tag/nội dung/hash và trạng thái DB thật. File đã áp dụng
không được tùy tiện sửa, đổi số hoặc viết lại journal để làm mất lịch sử.
Nếu 0053 local chưa từng chạy trên DB nào, có thể đổi số/tag sau khi xác minh,
đồng thời cập nhật journal/snapshot. Nếu đã chạy, thiết kế migration tiến tới
reconcile schema, giữ trace của cả hai dòng lịch sử. Thử trên DB clone trước.

Không rollback bằng cách drop `type`/`parent_id`: sẽ mất phân loại và cây mới.
Rollback ứng dụng cần xét trigger vẫn hoạt động và client cũ không biết các type.

## 5. Các vùng fork phải kiểm tra khi nhận upstream

Các mục dưới ghi nơi giữ hành vi của fork và quyết định tích hợp. Đây không phải
tuyên bố upstream hiện thiếu mọi tính năng cùng tên.

### MAP-06 — Workspace/Organization, project visibility và RBAC

- Workspace map Better Auth Organization; giữ membership/role workspace riêng
  với project membership/role. Instance admin không đồng nghĩa workspace admin.
- Điểm đối chiếu: `packages/permissions/src/index.ts`,
  `apps/api/src/project-rbac/`, `utils/require-workspace-permission.ts`,
  `utils/validate-workspace-access.ts`, `apps/api/src/auth.ts`.
- Upstream hiện có `project-access`/`workspace-members`; cần map semantics với
  `project-rbac` local, không thay thư mục theo tên rồi coi quyền đã tương đương.
- Kiểm tra cả REST, Better Auth, MCP, search, aggregate, asset và WebSocket.
- Dashboard/search và API key scope là vùng cần kiểm chứng runtime; tài liệu này
  không chứng nhận rằng mọi finding trong phân tích trước đã được xử lý.

### MAP-07 — Admin, sessions, OIDC và audit

- Các mốc local: `09a731ffd`, `3602173bc`, `0ba3a48a5`.
- Điểm đối chiếu: `apps/api/src/admin/`, `database/admin-schema.ts`,
  `backchannel-logout/`, `auth.ts`, `utils/authenticate-api-request.ts`, `ws/`.
- Giữ instant revocation, kiểm tra ban hiện hành, last-admin guards, custom
  instance roles, audit đã redaction, webhook signing/secret encryption.
- Admin audit/webhooks là **instance scope**, chưa phải workspace audit/policy.
- Đọc thêm [hợp đồng administration](apps/api/src/admin/README.md).

### MAP-08 — Integrations và webhook delivery

- Điểm đối chiếu: `apps/api/src/plugins/`, các `*-integration/`,
  `external-link/`, `workflow-rule/`, `admin/webhooks/delivery.ts`.
- GitHub/Gitea/GitLab sync khác manual HTTP resource link trên task (`89ebf623f`).
- Generic project webhooks khác durable instance audit webhooks (`0ba3a48a5`).
  Không port retry/ownership logic của luồng này rồi giả định luồng kia đã có.
- Giữ signature verification, SSRF/public destination validation, timeout,
  ownership/scope, chống vòng lặp outbound và redaction khi nhận bản upstream.

### MAP-09 — Custom fields, recurrence, mentions và notifications

- Mốc: `69e147dd0`, `11a7951bc`, `b88ad3455`, `cc857aad8`.
- Điểm đối chiếu: `custom-field/`, `task/recurrence/`, `comment/mentions.ts`,
  `notification-preferences/`, UI `task/custom-fields/`, `backlog-table/`.
- Schema field cùng tên chưa đủ: so sánh typed validation, choice migration,
  defaults/required, filtering, hidden values, event recipients và permissions.
- Upstream có hướng custom fields/Effect khác; port theo hợp đồng, không copy
  nguyên module nếu dependency/runtime local chưa được đổi tương ứng.
- Giữ việc tạo occurrence tiếp theo và lịch sử người tham gia/mentions;
  notification không được làm lộ nội dung project người nhận không còn quyền.

### MAP-10 — Documents, storage, Drive và imports

- Điểm đối chiếu: `document/`, `storage/`, `import/`, `packages/importers/`.
- Giữ quyền download/upload, trash/purge và ràng buộc document/folder/project;
  Google Drive-linked document khác file upload trong storage của Kaneo.
- Giữ provider auth, import progress/cancel/idempotency và xử lý lỗi từng phần.
- Khi nhận storage cleanup/migration mới từ upstream, kiểm tra cả objects ngoài DB,
  reference counting và secret references; không xóa chỉ dựa một bảng local.

### MAP-11 — Client, UX và cấu hình triển khai

- CLI: `packages/cli/`; MCP: `packages/mcp/`, `apps/api/src/mcp/`.
- Mobile: `apps/mobile/`; cấu hình self-host, auth và URL API phải kiểm tra lại
  khi upstream cũng thay device flow, logout, deployment hoặc public API URL.
- Web: calendar feeds, home/inbox, Gantt, checklist/subtask progress, Markdown/
  Mermaid, saved label filters và mobile layout có trong các commit local
  `09a731ffd`, `b88ad3455`, `1571e2712` đến `2120450f5`.
- Board drag queue: `5c6d55bf2`; background/storage metadata: `b8d146d3e`.
- Starter project workspace: `0703c310c`; localization: `i18n/`.
- Cải tiến web phải đi qua cả desktop/mobile navigation, generated routes,
  detail sheet, query invalidation, optimistic state và realtime sync.

### MAP-12 — Migration nền tảng và tính năng chỉ upstream có

- Fork có migration/task schema riêng; upstream main hiện có nhiều thay đổi
  sau tổ tiên chung. Không dùng số lượng commit để ước lượng khả năng merge.
- Billing, integration-sync và các module chỉ thấy ở upstream không được coi
  là đã được đưa vào fork. Mỗi mục phải được quyết định nhận, hoãn hoặc bỏ.
- Dùng `git diff BASE..FORK` để hiểu chủ đích local; dùng `BASE..UPSTREAM`
  để hiểu chủ đích upstream; diff hai tip chỉ cho trạng thái cuối khác nhau.

### MAP-13 — Manual Test Plans MVP (sau Work Items)

- Nhánh triển khai: `codex/manual-test-plans`; chưa xác nhận release/DB production.
- Đây là module riêng ở cấp project, không đổi task checklist hoặc repository
  unit tests thành Test Case. Menu Test Plans có Define/Execute/Runs/Reports.
- Model chuẩn: `test_plan`, `test_suite`, `test_case`, `test_suite_case`,
  `test_run`, `test_result`; migration `0054_manual_test_plans`.
- Case có revision; mỗi run giữ snapshot bất biến. Retest tạo run mới theo case
  Ready hiện tại. Không ghi đè lần Failed hoặc tự biến Not run thành Passed.
- Backend: `apps/api/src/test-plan/`, `database/test-plan-schema.ts`.
- Frontend: `apps/web/src/components/test-plans/`, route project `test-plans.tsx`.
- Điều hướng project chuyển từ thanh ngang sang sidebar trái trong
  `components/project-navigation.tsx`, được truyền qua ProjectLayout → Layout →
  AppSidebar. Nhóm Boards gồm Work items/Boards/Backlogs/Sprints; Test Plans là
  nhóm riêng; Calendar/Gantt/Documents vẫn truy cập được. Workspace giữ menu
  toàn cục; màn hình nhỏ giữ drawer và bộ chuyển view gọn ở header. Không khôi
  phục thanh view ngang khi nhận thay đổi layout từ upstream.
- Quyền project: `test.read/design/manage/execute`. Migration backfill dựa trên
  quyền item/backlog thực tế, không reset role tùy chỉnh hoặc đoán theo tên role.
- API `/api/test-plans/:projectId/*`; typed client riêng `testPlansClient` dùng
  chung URL/cookie/window-ID nhưng không đưa vào union AppType quá lớn.
- Evidence MVP là HTTP(S) links; tạo Bug draft và Save result là hai hành động.
- Khi nhận upstream Test Plans: đối chiếu lifecycle, snapshot/revision, FK/scope,
  quyền người được phân công, idempotency và công thức báo cáo trước thay module.
  Không map outcome của test result vào status Task hoặc sửa run đã đóng.
- Đọc [hợp đồng MVP và kiểm thử](apps/api/src/test-plan/README.md). Chưa có CI,
  import unit-test results, shared steps hay dynamic suites trong phạm vi này.

## 6. Quy trình cập nhật upstream

### Trước khi tích hợp

1. Lưu SHA fork/upstream/merge-base và trạng thái working tree. Commit hoặc lưu
   riêng thay đổi đang làm theo quy trình nhóm; không chạy reset/clean để dọn hộ.
2. Đọc tài liệu này, lịch sử local sau baseline và các migration đã thực sự chạy.
3. Fetch upstream, pin SHA mới; liệt kê thay đổi theo các MAP ID ở trên.
4. Dùng checkout/worktree tích hợp phù hợp. Không merge trực tiếp vào môi trường
   production hoặc ghi đè file local chỉ để làm hết conflict.

Các lệnh đọc/đối chiếu (PowerShell, thay các SHA bằng mốc đang xử lý):

```powershell
git status --short
git fetch upstream main
git rev-parse HEAD upstream/main
git merge-base HEAD upstream/main
git rev-list --left-right --count upstream/main...HEAD
git log --no-merges --oneline upstream/main..HEAD
git log --no-merges --oneline HEAD..upstream/main
git diff --name-status <BASE> <FORK>
git diff --name-status <BASE> <UPSTREAM>
git diff <BASE> <FORK> -- apps/api/src/task apps/api/src/work-item
git diff <BASE> <UPSTREAM> -- apps/api/src/task apps/api/src/database
git diff -- apps/api/src apps/web/src
git ls-files --others --exclude-standard
```

Hai lệnh cuối cần đi cùng nhau: diff không bao gồm các file mới chưa tracked.
Không đổi merge-base lịch sử thành “last integrated upstream” nếu chưa thật sự
tích hợp SHA đó.

### Quyết định theo tính năng, không theo cả file

- **Giữ local:** hành vi sản phẩm khác upstream và vẫn cần thiết.
- **Nhận upstream:** cải tiến/bug fix tương thích với hợp đồng local.
- **Hợp nhất:** cùng nhu cầu nhưng schema/API/permissions khác.
- **Thay local bằng upstream:** chỉ sau khi chứng minh feature parity và có data
  migration; ghi rõ local feature chuyển thành implementation nào.
- **Hoãn/bỏ:** ghi lý do và phạm vi, không để thành quyết định ngầm.

Ưu tiên reconcile DB/auth/permissions trước API/serializers rồi UI/clients.
Generated routes phải sinh lại bằng tooling web; không resolve toàn bộ generated
file bằng cách chọn một phía. Lockfile phải khớp manifests cuối cùng.

### Cổng kiểm chứng

- Chạy TypeScript API/web, unit tests, build và integration tests trên DB `_test`.
- Migration trên bản sao schema/data cũ: đếm items, giữ ID/number, kiểm tra type,
  parent, rank, relations, sprint history và completion snapshots.
- Work items: filter/type/parent; Backlogs: cây/rank/planning; Boards: type/card/
  drag queue; Sprints: nhóm cha/con, carry-over, history và reports.
- Security: hai workspace, project riêng, viewer/member/admin, key bị giới hạn,
  session/key đã revoke, assets, search, export và WebSocket đang mở.
- CLI/MCP/mobile và integration payload không được giả định mọi row là Task.
- Kiểm tra cả dữ liệu cũ có subtask relation và dữ liệu mới có parent_id.
- Không ghi “đã kiểm chứng” cho test chưa chạy vì thiếu database/credentials.

Lệnh tiêu biểu hiện tại:

```powershell
pnpm --filter @kaneo/web typecheck
pnpm --dir apps/api exec tsc --noEmit
pnpm --dir apps/web exec vite build
pnpm --dir apps/api exec vitest run --config vitest.config.ts
pnpm --dir apps/web exec vitest run --config vitest.config.ts
pnpm --dir apps/api exec vitest run --config vitest.integration.config.ts
```

Xác minh lại tên package/scripts sau mỗi lần nhận upstream. Integration tests
cần PostgreSQL; xem [hướng dẫn kiểm thử](tests/api-integration/README.md).

## 7. Hồ sơ bắt buộc cho mỗi lần đồng bộ tiếp theo

Thêm một mục vào cuối tài liệu này với các trường:

- Ngày, người thực hiện, nhánh/PR và SHA kết quả.
- Last integrated upstream cũ → upstream SHA mới (khác với merge-base nếu cần).
- MAP ID bị ảnh hưởng và quyết định: giữ/nhận/hợp nhất/thay thế/hoãn.
- Tên/chức năng local cũ → tên/chức năng/implementation mới.
- URL/API/schema/payload cũ → mới; client nào cần cập nhật.
- Migration tag/hash đã chạy, backfill, dữ liệu cần xử lý thủ công và rollback.
- File/module mới là nguồn chuẩn; file cũ nào còn là compatibility layer.
- Checks đã chạy, kết quả, checks bị chặn và vấn đề còn mở.

Không xóa lịch sử thay thế khi upstream bắt kịp tính năng local; ghi rằng local
implementation đã được thay bằng implementation upstream tại SHA cụ thể.

## 8. Nhật ký đối chiếu

### 02/11/2026 — lập bản đồ ban đầu

- Fetch upstream đến `dd92f6bc9`; không merge/cherry-pick upstream.
- Ghi nhận HEAD fork `b8d146d3e` và Work Items trong working tree chưa commit.
- MAP-01 đến MAP-05 mô tả tái cấu trúc work management mới.
- MAP-06 đến MAP-12 là các vùng tích hợp cần rà; chưa phải audit toàn bộ 2.019
  commit upstream hoặc chứng nhận tương thích hai tip.
- Work Items đã có kiểm tra TypeScript/build/unit và migration PostgreSQL nhúng
  trong phiên triển khai; API integration test chưa chạy thành công vì PostgreSQL
  cục bộ không hoạt động. Tài liệu này không xác nhận migration trên DB thật.
- Khi commit Work Items: bổ sung SHA/PR tại đây và cập nhật baseline của mục 1.

### 02/11/2026 — chuẩn bị PR Work Items

- Base origin/main: `f463d384b`; feature commit: `aae5d648fc7724a396ab45e10dc1f1d189b3fb4a`.
- Nhánh: `codex/work-item-hierarchy`; MAP-01 đến MAP-05 được đưa vào PR cùng tài liệu này.
- Biome toàn repo và build qua hook pre-commit đã thành công; 39 tests mục tiêu/hồi quy đã qua.
- API integration trên PostgreSQL thật vẫn chưa được xác nhận; không có migration production.
- Không đưa hai thay đổi có sẵn trong `apps/site/next-env.d.ts` và `apps/site/tsconfig.json` vào PR.
