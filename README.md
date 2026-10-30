# Dashboard báo cáo tồn kho

Web app hiển thị báo cáo tồn kho theo khối / BU / nhóm SP, cùng format với file Excel
`BaoCao_TonKho_<Khoi>_dd_mm_yyyy.xlsx`:

- Bảng chính: phân loại theo HSD, hàng đang sử dụng, hết date / chờ hủy / lỗi KT, phân loại luân chuyển (CLC),
  GV bán TB, hệ số tồn kho, so sánh kỳ trước và 3 kỳ trước. Bấm vào ô số để xem chi tiết lô.
- Cảnh báo tồn đọng (xu hướng 4 kỳ) và xu hướng tồn kho theo BU, kèm biểu đồ.
- Xuất Excel theo bố cục báo cáo gốc.

**Stack:** React + Vite + Tailwind, Supabase (project DA). Không cần đăng nhập: frontend dùng
publishable key và chỉ gọi RPC `security definer` trong schema `app_inventory`; bảng không đọc trực tiếp được.

## Nguồn dữ liệu

| Dữ liệu | Nguồn |
|---|---|
| Tồn kho theo lô | `app_order.stock` (snapshot theo `cycledate`, nạp bởi `order/scripts/refresh_stock.py`) |
| Đơn giá, BU, nhóm SP, PL hàng hóa | `app_inventory.dm_hang_ton_kho` — nạp từ sheet `DuLieu_goc`, **có phiên bản** |
| Thứ tự nhóm, GV bán TB, số liệu các kỳ đã chốt | `dm_nhom_bao_cao`, `gv_ban_tb`, `ton_kho_ky` |

Quy tắc phân loại (giống công thức Excel):

- **Trạng thái** theo đuôi mã kho: `GU` gửi, `HH` hết hạn, `HU*` chờ hủy, `KT*` lỗi/kiểm tra, còn lại đạt.
  Lô có HSD hết hạn luôn tính vào "hết date".
- **HSD** theo `warninghsd` (`Hết Hạn`, `< 6 Tháng`, `< 12 Tháng`, còn lại = trên 12T / không HSD);
  nếu trống mà có `expirydate` thì tính theo ngày snapshot.
- **Luân chuyển** theo `warnington` (`< 1 Năm` → trên 06T, `< 2 Năm` → trên 12T, `< 3 Năm`/`> 3 Năm` → trên 24T);
  nếu trống mà có `docdate_n` thì tính số ngày tồn; còn lại = dưới 06T.
  `warnington` là chuẩn chính thức cho CLC (chốt 30/10/2026). CLC tính theo cột này thấp hơn file Excel cũ,
  vì file Excel cũ tính theo "Ngày nhập thực tế". Từ 29/10/2026 không so CLC trực tiếp với các kỳ Excel cũ.
- Chỉ tính mặt hàng có `pl_hang_hoa = 'Hàng đang kinh doanh'`. Giá trị = `closeinventory × don_gia / 10^6`.
- **Tên hiển thị** BU / nhóm SP lấy theo danh mục dùng chung (`shared.dm_bu`, `shared.dm_nhom_san_pham`) qua
  `app_inventory.map_bu` và `map_nhom`; nhóm không có trong danh mục (Máy chính, Others-NSCT, Part) giữ tên và
  cách gom như file Excel để so sánh được với các kỳ đã chốt.
- Phiên bản master dùng cho một snapshot = bản có `updated_at` mới nhất ≤ ngày snapshot (chưa có thì lấy bản sớm nhất).

Các kỳ so sánh = 3 ngày cuối tháng trước tháng của snapshot. Kỳ nào đã chốt (`ton_kho_ky`) thì dùng số chốt;
chưa chốt thì ước tính từ snapshot gần nhất trong vòng 15 ngày trước ngày cuối tháng.

## Chạy local

```bash
cp .env.example .env    # điền VITE_SUPABASE_URL + VITE_SUPABASE_KEY (publishable key)
npm install
npm run dev             # http://localhost:5180
```

## Cập nhật dữ liệu

Cần Supabase CLI đã đăng nhập và `supabase link --project-ref nrfxymnfmjhbsgpipvkb`.

**Nạp file báo cáo Excel mới** (master có phiên bản, GV bán TB, số liệu kỳ):

```bash
python scripts/nap_excel.py --file "BaoCao_TonKho_NgoaiKhoa_31_10_2026.xlsx"
```

Mã không đổi thuộc tính giữ phiên bản cũ; mã mới hoặc đổi giá/phân loại sinh thêm 1 dòng với
`updated_at` = ngày báo cáo (lấy từ tên file, hoặc `--ky YYYY-MM-DD`). Chạy lại cùng file không sinh dòng trùng.

**Chốt số liệu cuối tháng từ snapshot** (để làm kỳ so sánh cho các tháng sau):

```bash
supabase db query --linked "select app_inventory.chot_ky('2026-10-31', '2026-10-25', 'NGOẠI KHOA')"
```

## Schema

- `supabase/migrations/20261030000001_app_inventory.sql` — bảng, RPC, phân quyền.
- `supabase/migrations/20261030000002_expose_app_inventory.sql` — role `authenticator` có `pgrst.db_schemas`
  đặt trong DB, ghi đè cấu hình Dashboard. App nào thêm schema mới phải sửa dòng này và giữ `app_inventory`.

Áp bằng `supabase db query --linked -f <file>` (không dùng `db push`: lịch sử migration trên remote
thuộc các repo khác).

## Build / deploy

```bash
npm run build           # ra dist/, base './' nên deploy tĩnh được ở GitHub Pages
```
