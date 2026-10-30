-- =====================================================================
--  Tên hiển thị BU / nhóm SP theo danh mục dùng chung (shared.dm_bu,
--  shared.dm_nhom_san_pham). Dữ liệu vẫn lưu theo tên trong file Excel;
--  dashboard chỉ đổi tên lúc hiển thị. Nhóm không có trong danh mục giữ tên Excel.
-- =====================================================================
create table if not exists app_inventory.map_bu (
  bu       text primary key,               -- BU trong file Excel (CTCH, NSCT, CTTM)
  bu_code  text not null                   -- shared.dm_bu.bu_code
);

create table if not exists app_inventory.map_nhom (
  bu             text not null,
  nhom_sp        text not null,            -- tên nhóm trong file Excel
  nhom_san_pham  text not null,            -- shared.dm_nhom_san_pham.nhom_san_pham
  primary key (bu, nhom_sp)
);

alter table app_inventory.map_bu   enable row level security;
alter table app_inventory.map_nhom enable row level security;
grant select, insert, update, delete on app_inventory.map_bu, app_inventory.map_nhom to service_role;

-- Ánh xạ khởi tạo: nhóm Excel -> nhóm danh mục chiếm đa số mã (theo shared.dm_vat_tu).
-- Others-NSCT, Part, Máy chính không có nhóm riêng tương ứng nên không ánh xạ.
insert into app_inventory.map_bu (bu, bu_code) values
  ('CTCH', 'chcs'), ('NSCT', 'thnk'), ('CTTM', 'cttm')
on conflict (bu) do update set bu_code = excluded.bu_code;

insert into app_inventory.map_nhom (bu, nhom_sp, nhom_san_pham) values
  ('CTCH', 'Cột Sống Ulrich',                 'Cột sống Ulrich'),
  ('CTCH', 'Nội soi khớp - Arthrex',          'NSK Arthrex'),
  ('CTCH', 'Khớp nhân tạo - UOC',             'Khớp UOC'),
  ('CTCH', 'Khớp Zimmer',                     'Khớp Zimmer'),
  ('NSCT', 'Tiêu hao DHM - Medtronic',        'TH DHM - Medtronic'),
  ('NSCT', 'Tiêu hao S&N',                    'CSVT - S&N'),
  ('NSCT', 'Tiêu hao DSA - Medtronic',        'TH DSA - Medtronic'),
  ('NSCT', 'Tiêu hao DMĐ - Medtronic',        'TH DMĐ - Medtronic'),
  ('NSCT', 'Tiêu hao NS Tổng quát - Applied', 'NSTQ - Applied'),
  ('CTTM', 'CTTM',                            'BSC - IC'),
  ('CTTM', 'CTUT',                            'BSC - IO')
on conflict (bu, nhom_sp) do update set nhom_san_pham = excluded.nhom_san_pham;

-- Tên hiển thị: mức BU (nhom_sp = '') và mức nhóm SP.
-- Chỉ dùng tên danh mục khi tên đó còn tồn tại trong shared.dm_bu / shared.dm_nhom_san_pham.
create or replace function app_inventory.ds_ten_hien_thi()
returns table (bu text, nhom_sp text, ten text)
language sql stable security definer
set search_path = ''
as $$
  select m.bu, '' as nhom_sp, b.ten_bu
  from app_inventory.map_bu m
  join shared.dm_bu b on b.bu_code = m.bu_code
  union all
  select n.bu, n.nhom_sp, n.nhom_san_pham
  from app_inventory.map_nhom n
  where exists (select 1 from shared.dm_nhom_san_pham d where d.nhom_san_pham = n.nhom_san_pham);
$$;
revoke all on function app_inventory.ds_ten_hien_thi() from public;
grant execute on function app_inventory.ds_ten_hien_thi() to anon, authenticated, service_role;
notify pgrst, 'reload schema';
