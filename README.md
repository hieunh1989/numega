# AgriCalc Feed Formula Calculator

AgriCalc là PWA mobile-first để chuyên gia dinh dưỡng lập và kiểm tra công thức thức ăn chăn nuôi. App được triển khai theo Phương án 2 trong `BaoGia_WebApp.pdf`.

## Quy trình nghiệp vụ đã chốt

1. Người dùng làm việc với 6 nhóm nguyên liệu: Cereals, Protein Sources, Oils & Fats, Minerals, Amino Acids và Others.
2. Trong mỗi nhóm, người dùng tìm/chọn nguyên liệu từ database, thêm hoặc xóa dòng và nhập tỷ lệ Inclusion (%).
3. App tra cứu các chỉ số dinh dưỡng gốc của từng nguyên liệu trong database.
4. Mọi thay đổi tỷ lệ hoặc danh sách nguyên liệu đều kích hoạt tính lại ngay, không tải lại trang.
5. Mỗi chỉ số được tính theo công thức tổng có trọng số: `Total_Nutrient = Σ(Nutrient_Value[i] × Inclusion_Rate[i] / 100)`.
6. Tổng Inclusion bắt buộc bằng đúng 100%. Nút tính bị khóa và hiển thị cảnh báo nếu thiếu hoặc vượt.
7. Khi hợp lệ, app hiển thị tổng quan ABC3/ABC4, macro, khoáng chất, năng lượng; biểu đồ Bar/Line; đóng góp theo nhóm và xếp hạng nguyên liệu.
8. Kết quả có thể lưu trên thiết bị, chia sẻ, tiếp tục dùng khi mất mạng và cài như một ứng dụng PWA.

Lưu ý nghiệp vụ: báo giá gọi là “6 bảng nhập liệu/6 công thức”, còn file Excel thể hiện 6 bảng tương ứng 6 nhóm nguyên liệu. Các chỉ số đầu ra cùng dùng một quy tắc tổng có trọng số; hiện app tính đồng thời 11 chỉ số được dùng trong bảng Feed Formula.

## Nguồn dữ liệu

- 28 nguyên liệu từ `Ingredient Database.xlsx`.
- 31 trường dữ liệu gốc cho mỗi nguyên liệu.
- Các màn hình và design token trong `stitch_desgin/stitch_feed_formula_calculator_app` là chuẩn giao diện.

## Chạy cục bộ

Yêu cầu Node.js `>=22.13.0`.

```bash
npm install
npm run dev
npm run build
```

## Cấu trúc chính

- `app/page.tsx`: toàn bộ luồng builder, picker, chi tiết và kết quả.
- `app/data/ingredients.json`: dữ liệu nguyên liệu được trích từ workbook gốc.
- `app/globals.css`: design system responsive theo AgriCalc Stitch.
- `public/manifest.webmanifest` và `public/sw.js`: cài đặt PWA và cache offline.
