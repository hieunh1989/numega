# Numega

Numega là PWA mobile-first để lập và kiểm tra công thức thức ăn chăn nuôi. Phiên bản hiện tại chạy local theo Phương án 2: giao diện tính toán, PostgreSQL trong Docker và khu vực quản trị dữ liệu.

## Chức năng hiện có

- Tạo công thức từ 6 nhóm nguyên liệu, nhập tỷ lệ Inclusion và tính lại kết quả ngay trên trình duyệt.
- Kiểm tra tổng tỷ lệ phải bằng 100%, hiển thị macro, khoáng chất, năng lượng, biểu đồ và mức đóng góp của từng nguyên liệu.
- Đọc nguyên liệu từ PostgreSQL; tự dùng dữ liệu đã cache hoặc bộ dữ liệu nhúng khi API tạm thời không truy cập được.
- Lưu công thức trên thiết bị, hỗ trợ chia sẻ và cài lên màn hình chính như PWA.
- Trang `/admin` quản lý người dùng, danh mục và đầy đủ thông số nguyên liệu từ file Excel.
- Giao diện chính ưu tiên điện thoại; trang admin dùng được trên cả điện thoại và máy tính.

## Chạy local

Yêu cầu:

- Node.js `>=22.13.0`
- Docker Desktop đang chạy

Khởi động lần đầu:

```bash
npm install
npm run db:up
npm run dev
```

Các địa chỉ:

- App: `http://localhost:3000`
- Admin: `http://localhost:3000/admin`
- API: `http://localhost:4000/api/health`
- PostgreSQL: `localhost:5433`

`npm run dev` chạy đồng thời frontend và API. API tự tạo schema và seed 6 danh mục, 28 nguyên liệu cùng một bản ghi quản trị mẫu ở lần chạy đầu tiên.

## Mở bằng điện thoại

Kết nối điện thoại và máy tính vào cùng một mạng Wi-Fi, sau đó mở:

```text
http://<IP-LAN-của-máy-tính>:3000
```

Frontend tự gọi API tại cùng IP đó qua cổng `4000`. Nếu Windows hỏi quyền mạng, cho phép Node.js/Docker trên mạng riêng (Private network) và bảo đảm hai cổng `3000`, `4000` không bị firewall chặn.

## Lệnh hữu ích

```bash
npm run dev          # frontend + API
npm run dev:web      # chỉ frontend
npm run dev:api      # chỉ API, tự reload khi sửa mã
npm run build        # kiểm tra production build
npm run start:api    # chạy API không watch
npm run db:up        # bật PostgreSQL
npm run db:down      # tắt container, vẫn giữ volume dữ liệu
npm run db:logs      # xem log PostgreSQL
```

Biến môi trường mẫu nằm trong `.env.example`. Mặc định local đã khớp với `docker-compose.yml`, nên không cần tạo `.env` nếu dùng đúng cấu hình này.

## Dữ liệu và cấu trúc

- `app/page.tsx`: giao diện lập công thức và tính toán.
- `app/admin/page.tsx`: giao diện quản trị responsive.
- `app/data/ingredients.json`: dữ liệu fallback và nguồn seed ban đầu từ Excel.
- `server/db.mjs`: schema PostgreSQL, kết nối và seed.
- `server/index.mjs`: REST API cho người dùng, danh mục và nguyên liệu.
- `docker-compose.yml`: PostgreSQL 16 và volume lưu dữ liệu.
- `public/manifest.webmanifest`, `public/sw.js`: cấu hình PWA và cache offline.

Ba bảng chính là `users`, `categories` và `ingredients`. `ingredients.category_id` liên kết tới `categories.id`. Dữ liệu trong PostgreSQL được lưu ở Docker volume `numega_postgres_data`, vì vậy `npm run db:down` không xóa dữ liệu.

## Phạm vi giai đoạn local

Mục “người dùng” hiện là CRUD hồ sơ người dùng trong admin; chưa bật đăng nhập, phân quyền phiên làm việc hoặc khôi phục mật khẩu. Những phần đó cùng cấu hình production, domain, SSL, backup và deploy sẽ được thực hiện ở giai đoạn triển khai sau.
