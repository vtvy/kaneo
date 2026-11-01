# Kaneo trên điện thoại

Ứng dụng Expo tự host cho fork Kaneo này. Máy chủ do bạn chạy; ứng dụng chỉ lưu địa chỉ máy chủ và phiên đăng nhập trên thiết bị.

Bản dựng chạy trên máy của bạn. Ứng dụng này không có workflow GitHub Actions.

## Cài đặt

Từ thư mục gốc của repo:

```bash
pnpm install
pnpm --filter @kaneo/mobile start
```

Gói này không có script `build`. `pnpm build` ở gốc dùng Turbo và không biên dịch mã native.

Kiểm tra không cần máy hoặc giả lập:

```bash
pnpm --filter @kaneo/mobile typecheck
pnpm --filter @kaneo/mobile test
```

## Dùng ứng dụng

1. Mở ứng dụng và nhập URL API tự host, ví dụ `http://192.168.1.10:1337`. Có thể dán kèm `/api` ở cuối; ứng dụng sẽ bỏ phần đó. Máy chủ HTTP trên mạng nội bộ được phép (Android cleartext và iOS ATS).
2. Đăng nhập bằng email và mật khẩu, hoặc bằng khóa API. Khóa API được gửi dạng `Authorization: Bearer`. Email/mật khẩu dùng `POST /api/auth/sign-in/email` của Better Auth: nếu máy chủ trả `set-auth-token` hoặc trường `token`, các request sau gửi Bearer; nếu chỉ có cookie phiên, cookie đó được lưu và gửi lại.
3. Chọn không gian làm việc, rồi dự án.
4. **Bảng** liệt kê cột và việc. **Việc** hiện tiêu đề, trạng thái, mô tả và bình luận.
5. **Sprint** liệt kê sprint của dự án và việc trong từng sprint.
6. **Tài liệu** liệt kê thư mục, metadata tệp, rồi tải xuống. Tên tệp lấy từ header `Content-Disposition` mà API đã gửi. Tệp Google Drive chỉ được hiển thị và tải bản sao; ứng dụng không liên kết, không xóa và không cấu hình OAuth Drive.
7. **Thông báo** liệt kê thông báo của bạn và đánh dấu đã đọc.

Người chỉ có quyền xem vẫn mở được dự án, bảng, sprint, tài liệu và thông báo. Nút tạo, sửa, xóa, chuyển trạng thái và gán người chỉ hiện khi `GET /api/project-rbac/:projectId/me` cho phép (`item:create`, `item:update`, `item:delete`, `item:transition`, `item:assign`, và `doc:view` so với `doc:upload`). Chủ dự án (`isOwner`) được coi là có đủ quyền. Người tạo việc vẫn gán được việc đó, đúng như API.

## Android

Cần JDK 17 và Android SDK (biến `ANDROID_HOME` trỏ tới SDK).

Thư mục `android/` không có trong git. Sinh project native rồi chạy máy ảo hoặc máy thật:

```bash
pnpm --filter @kaneo/mobile exec expo prebuild
pnpm --filter @kaneo/mobile android
```

Bản release:

```bash
pnpm --filter @kaneo/mobile exec expo run:android --variant release
```

Ký bản release bằng các biến môi trường sau, đặt trước `expo prebuild` (plugin `plugins/with-release-signing.js` ghi chúng vào Gradle):

- `KANEO_ANDROID_KEYSTORE` — đường dẫn file keystore
- `KANEO_ANDROID_KEYSTORE_PASSWORD`
- `KANEO_ANDROID_KEY_ALIAS`
- `KANEO_ANDROID_KEY_PASSWORD`

Không đặt các biến này thì bản release dùng khóa debug để cài thử trên máy.

## iOS

Cần macOS và Xcode.

```bash
pnpm --filter @kaneo/mobile exec expo prebuild
pnpm --filter @kaneo/mobile ios
```

Thư mục `ios/` do prebuild sinh ra và không được commit. Mở workspace trong Xcode và chọn development team để ký. Bản Release:

```bash
pnpm --filter @kaneo/mobile exec expo run:ios --configuration Release
```
