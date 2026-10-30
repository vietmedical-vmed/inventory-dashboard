-- Role authenticator có pgrst.db_schemas đặt trong DB (ghi đè cấu hình Dashboard → Data API).
-- Giữ nguyên các schema đang có, thêm app_inventory, rồi reload PostgREST.
-- Khi app khác thêm schema mới cũng phải cập nhật dòng này (kể cả app_inventory).
alter role authenticator set pgrst.db_schemas =
  'public, graphql_public, app_kpi, app_order, app_sale, shared, app_ccdc, app_contract, app_inventory';
notify pgrst, 'reload config';
