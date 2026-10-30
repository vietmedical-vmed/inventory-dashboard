-- Bắt buộc đăng nhập: anon / authenticated không gọi RPC đọc trực tiếp nữa.
-- Frontend đọc qua Edge Function inventory-api (verify token dùng chung với portal, gọi RPC bằng
-- service_role). Chỉ áp SAU KHI đã deploy inventory-api và bản frontend mới, nếu không
-- dashboard đang chạy sẽ mất dữ liệu.

revoke execute on function app_inventory.ds_snapshot() from anon, authenticated;
revoke execute on function app_inventory.ds_khoi() from anon, authenticated;
revoke execute on function app_inventory.ds_thang() from anon, authenticated;
revoke execute on function app_inventory.ds_ten_hien_thi() from anon, authenticated;
revoke execute on function app_inventory.ds_ton_kho_ky(text, date, date) from anon, authenticated;
revoke execute on function app_inventory.bao_cao(date, text) from anon, authenticated;
revoke execute on function app_inventory.thong_tin_snapshot(date, text) from anon, authenticated;
revoke execute on function app_inventory.chi_tiet(date, text, text, text, text) from anon, authenticated;
revoke execute on function app_inventory.kiem_tra(date, text) from anon, authenticated;
