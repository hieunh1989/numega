# Numega

Numega là PWA mobile-first để lập và kiểm tra công thức thức ăn chăn nuôi. Ứng dụng dùng một codebase Next.js cho cả giao diện và API, kết nối trực tiếp tới PostgreSQL.

## Kiến trúc

```text
Trình duyệt/PWA
      │
      ▼
Next.js
├── Giao diện: /, /login, /admin
├── API: /api/auth, /api/users, /api/categories, /api/ingredients
└── PostgreSQL qua DATABASE_URL
```

API và giao diện dùng cùng domain nên không cần cổng API riêng, CORS hoặc `NEXT_PUBLIC_API_URL`. Cấu hình này chạy được trên:

- Local bằng Next.js và PostgreSQL Docker.
- Vercel bằng Next.js Functions và PostgreSQL/Supabase.
- VPS bằng Docker image standalone và PostgreSQL.

## Chạy local

Yêu cầu:

- Node.js `>=22.13.0`
- Docker Desktop

Khởi động:

```bash
npm install
npm run db:up
npm run dev
```

Địa chỉ:

- App: `http://localhost:3000`
- Admin: `http://localhost:3000/admin`
- API health: `http://localhost:3000/api/health`
- PostgreSQL: `localhost:5433`

Trong môi trường development, database trống được tạo tài khoản quản trị local:

- Email: `admin@numega.local`
- Mật khẩu: `Numega@123`

Các giá trị mẫu nằm trong `.env.example`. Không dùng mật khẩu mẫu này trên môi trường public.

## Biến môi trường

```dotenv
DATABASE_URL=postgresql://numega:numega_local@localhost:5433/numega
DATABASE_POOL_MAX=10
SEED_ADMIN_EMAIL=admin@numega.local
SEED_ADMIN_PASSWORD=replace-with-a-strong-password
```

- `DATABASE_URL` là bắt buộc khi deploy.
- `DATABASE_POOL_MAX` mặc định là `10` khi development và `3` khi production. Với Vercel/Supabase nên bắt đầu từ `1–3` và dùng Transaction Pooler.
- Trên production, tài khoản admin chỉ được seed khi có cả `SEED_ADMIN_EMAIL` và `SEED_ADMIN_PASSWORD`.
- Sau khi admin đã tồn tại, có thể bỏ hai biến seed. Ứng dụng không ghi đè mật khẩu đã có.
- Khi dùng Supabase từ Vercel, ưu tiên connection string của Transaction Pooler và bật SSL theo chuỗi kết nối Supabase cung cấp.

## Lệnh chính

```bash
npm run dev       # Chạy Next.js local, gồm cả giao diện và API
npm run build     # Tạo production build
npm run start     # Chạy production build local/VPS
npm run lint      # Kiểm tra mã nguồn
npm test          # Build và chạy bộ kiểm tra kiến trúc/bảo mật
npm run db:up     # Bật PostgreSQL local
npm run db:down   # Tắt PostgreSQL, vẫn giữ volume dữ liệu
npm run db:logs   # Xem log PostgreSQL
```

## Deploy Vercel

Vercel nhận diện dự án là Next.js, vì vậy giữ:

- Framework Preset: `Next.js`
- Root Directory: thư mục chứa `package.json`
- Build Command: mặc định `next build`
- Output Directory: để mặc định

Khai báo `DATABASE_URL`, `SEED_ADMIN_EMAIL` và `SEED_ADMIN_PASSWORD` trong Environment Variables. Không đưa file `.env` lên GitHub.

## Deploy VPS bằng Docker

`next.config.ts` bật `output: "standalone"` và repository có sẵn `Dockerfile`. App container cần nhận `DATABASE_URL` trỏ tới PostgreSQL và được đặt sau reverse proxy HTTPS như Caddy hoặc Nginx.

PostgreSQL phải có volume bền vững và backup nằm ngoài VPS. Không public cổng PostgreSQL ra Internet nếu không có nhu cầu kết nối từ bên ngoài.

## Dữ liệu

Các bảng chính:

- `users`: tài khoản và phân quyền Admin/User.
- `sessions`: phiên đăng nhập dạng cookie HTTP-only.
- `categories`: danh mục nguyên liệu.
- `ingredients`: thông tin và chỉ số dinh dưỡng nguyên liệu.

Lần kết nối đầu tiên, API tự tạo schema và seed sáu danh mục cùng dữ liệu nguyên liệu từ `app/data/ingredients.json`. Dữ liệu PostgreSQL local nằm trong Docker volume `numega_postgres_data`, vì vậy `npm run db:down` không xóa dữ liệu.

## PWA

PWA tiếp tục dùng:

- `public/manifest.webmanifest`
- `public/sw.js`
- HTTPS trên production

Service worker chỉ cache app shell và tài nguyên giao diện; các request `/api/*` luôn đi thẳng tới Next.js để tránh trả dữ liệu quản trị cũ từ cache.
