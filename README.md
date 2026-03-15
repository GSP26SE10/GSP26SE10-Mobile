## GSP26SE10-Mobile – Hướng dẫn chạy dự án (Expo)

### 1. Yêu cầu môi trường

- **Node.js**: khuyến nghị phiên bản LTS mới (>= 18).
- **npm** hoặc **yarn** (ví dụ dưới dùng `npm`).

- Thiết bị chạy app:
  - **Điện thoại** có cài ứng dụng **Expo Go** (iOS/Android), **hoặc**
  - **Android emulator** / **iOS Simulator** đã cấu hình sẵn.

### 2. Cài đặt dependencies

Từ thư mục gốc dự án:

```bash
npm install
```

### 3. Chạy dự án

- Chạy server Expo (mặc định):
  ```bash
  npm start
  ```

- Chạy trực tiếp trên **Android** (nếu có emulator/thiết bị cắm sẵn):
  ```bash
  npm run android
  ```

- Chạy trực tiếp trên **iOS** (chỉ trên macOS có Xcode):
  ```bash
  npm run ios
  ```

- Chạy trên **web**:
  ```bash
  npm run web
  ```

Sau khi chạy `npm start`, Expo dev tools sẽ mở trên terminal (hoặc trình duyệt).  
Bạn có thể:

- Quét QR code bằng **Expo Go** (cùng mạng LAN) để mở app trên điện thoại.
- Nhấn phím tương ứng trong terminal/dev tools:
  - `a` để mở Android emulator.
  - `w` để mở Web.

