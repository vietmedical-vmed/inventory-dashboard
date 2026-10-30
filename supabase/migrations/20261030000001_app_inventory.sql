-- =====================================================================
--  app_inventory — Dashboard báo cáo tồn kho theo khối/BU/nhóm SP
--
--  Nguồn tồn kho: app_order.stock (raw mức lô, snapshot theo cycledate).
--  Bảng riêng của app:
--    dm_hang_ton_kho  master mặt hàng có phiên bản (đơn giá + phân loại).
--                     Mỗi lần nạp chỉ thêm dòng mới khi thuộc tính đổi;
--                     phiên bản hiệu lực = updated_at mới nhất <= ngày báo cáo.
--    dm_nhom_bao_cao  thứ tự dòng nhóm SP trong báo cáo.
--    gv_ban_tb        GV bán trung bình tháng gần nhất (Triệu VNĐ) theo nhóm SP.
--    ton_kho_ky       số liệu đã chốt theo kỳ (cuối tháng) để so sánh xu hướng.
--
--  Frontend đọc bằng publishable/anon key, CHỈ qua các RPC security definer.
--  Bảng bật RLS và không có policy => không đọc trực tiếp được.
--
--  Sau khi chạy: Dashboard → Settings → API → Exposed schemas → thêm app_inventory.
-- =====================================================================

create schema if not exists app_inventory;
grant usage on schema app_inventory to anon, authenticated, service_role;

-- ---------- MASTER MẶT HÀNG (có phiên bản) ----------
create table if not exists app_inventory.dm_hang_ton_kho (
  id            bigint generated always as identity primary key,
  ma_bravo      text not null,
  ten_mat_hang  text,
  khoi          text,                 -- NGOẠI KHOA | ...
  bu            text,                 -- CTCH | NSCT | CTTM | ...
  nhom_sp       text,                 -- tên nhóm SP theo báo cáo
  hang          text,
  pl_hang_hoa   text,                 -- Hàng đang kinh doanh | TSCD/CCDC | Hàng ngừng kinh doanh
  don_gia       numeric not null default 0,   -- VNĐ / đơn vị tồn kho
  row_hash      text not null,        -- md5 các thuộc tính trên, để so phiên bản
  nguon         text,                 -- file nguồn
  updated_at    timestamptz not null default now(),
  unique (ma_bravo, updated_at)
);
create index if not exists idx_dm_htk_ma_updated
  on app_inventory.dm_hang_ton_kho (ma_bravo, updated_at desc);

-- ---------- THỨ TỰ DÒNG BÁO CÁO ----------
create table if not exists app_inventory.dm_nhom_bao_cao (
  khoi     text not null,
  bu       text not null,
  nhom_sp  text not null,
  thu_tu   int  not null default 999,
  primary key (khoi, bu, nhom_sp)
);

-- ---------- GV BÁN TRUNG BÌNH THÁNG ----------
create table if not exists app_inventory.gv_ban_tb (
  ky        date not null,            -- ngày chốt (cuối tháng)
  bu        text not null,
  nhom_sp   text not null,
  gia_tri   numeric not null,         -- Triệu VNĐ
  primary key (ky, bu, nhom_sp)
);

-- ---------- SỐ LIỆU ĐÃ CHỐT THEO KỲ ----------
-- Mức nhóm SP: bu + nhom_sp. Mức BU: nhom_sp = ''. Mức khối: bu = '' và nhom_sp = ''.
-- chi_tieu: tong_kd | dang_sd | het_han | cho_huy | loi_kt | clc | xau (= het_han + cho_huy + loi_kt)
create table if not exists app_inventory.ton_kho_ky (
  ky        date not null,
  khoi      text not null,
  bu        text not null default '',
  nhom_sp   text not null default '',
  chi_tieu  text not null,
  gia_tri   numeric not null,         -- Triệu VNĐ
  nguon     text,                     -- excel | snapshot yyyy-mm-dd
  updated_at timestamptz not null default now(),
  primary key (ky, khoi, bu, nhom_sp, chi_tieu)
);

alter table app_inventory.dm_hang_ton_kho enable row level security;
alter table app_inventory.dm_nhom_bao_cao enable row level security;
alter table app_inventory.gv_ban_tb       enable row level security;
alter table app_inventory.ton_kho_ky      enable row level security;
grant select, insert, update, delete on all tables in schema app_inventory to service_role;

-- =====================================================================
--  Dòng tồn kho đã phân loại cho 1 snapshot (dùng nội bộ cho các RPC)
-- =====================================================================
create or replace function app_inventory._dong_ton_kho(p_cycledate date, p_khoi text)
returns table (
  ma_bravo text, ten_mat_hang text, bu text, nhom_sp text, hang text,
  warehousecode text, mien text, so_lo text, serialcode text,
  expirydate date, so_luong numeric, don_gia numeric, gia_tri numeric,
  pl_kho text, pl_hsd text, pl_ton text, nhom_trang_thai text,
  warninghsd text, warnington text
)
language sql stable
set search_path = ''
as $$
  with m as (
    -- phiên bản master hiệu lực tại ngày báo cáo; chưa có thì lấy bản sớm nhất
    select distinct on (d.ma_bravo) d.*
    from app_inventory.dm_hang_ton_kho d
    order by d.ma_bravo,
             (d.updated_at::date <= p_cycledate) desc,
             case when d.updated_at::date <= p_cycledate then d.updated_at end desc nulls last,
             d.updated_at
  ),
  s as (
    select st.*,
           regexp_replace(coalesce(st.warehousecode, ''), '^.*\.', '') as sfx,
           coalesce(st.closeinventory, st.quantity, 0) as sl
    from app_order.stock st
    where st.cycledate = p_cycledate
  ),
  c as (
    select s.*, m.ten_mat_hang, m.bu, m.nhom_sp, m.hang, m.don_gia,
      case
        when s.sfx = 'GU' then 'Gửi'
        when s.sfx = 'HH' then 'Hết hạn'
        when s.sfx like 'HU%' then 'Hủy'
        when s.sfx like 'KT%' then 'Kiểm tra'
        else 'Đạt'
      end as pl_kho,
      case
        when s.warninghsd = 'Hết Hạn' then 'Hết hạn'
        when s.warninghsd = '< 6 Tháng' then 'Dưới 06T'
        when s.warninghsd = '< 12 Tháng' then 'Trên 06T'
        when s.warninghsd is null and s.expirydate is not null then
          case
            when s.expirydate <= p_cycledate then 'Hết hạn'
            when s.expirydate < p_cycledate + interval '6 months' then 'Dưới 06T'
            when s.expirydate < p_cycledate + interval '12 months' then 'Trên 06T'
            else 'Trên 12T/Ko HSD'
          end
        else 'Trên 12T/Ko HSD'
      end as pl_hsd,
      case
        when s.warnington in ('< 1 Năm') then 'Trên 06T'
        when s.warnington in ('< 2 Năm') then 'Trên 12T'
        when s.warnington in ('< 3 Năm', '> 3 Năm') then 'Trên 24T'
        when s.warnington is null and s.docdate_n ~ '^\d{4}-\d{2}-\d{2}' then
          case
            when p_cycledate - left(s.docdate_n, 10)::date >= 730 then 'Trên 24T'
            when p_cycledate - left(s.docdate_n, 10)::date >= 365 then 'Trên 12T'
            when p_cycledate - left(s.docdate_n, 10)::date >= 180 then 'Trên 06T'
            else 'Dưới 06T'
          end
        else 'Dưới 06T'
      end as pl_ton
    from s
    join m on m.ma_bravo = s.ma_bravo
    where m.pl_hang_hoa = 'Hàng đang kinh doanh'
      and m.khoi = p_khoi
  )
  select c.ma_bravo, c.ten_mat_hang, c.bu, c.nhom_sp, c.hang,
         c.warehousecode, c.mien, c.so_lo, c.serialcode,
         c.expirydate, c.sl, c.don_gia, c.sl * c.don_gia / 1e6,
         c.pl_kho, c.pl_hsd, c.pl_ton,
         case
           when c.pl_hsd = 'Hết hạn' or c.pl_kho = 'Hết hạn' then 'HET_HAN'
           when c.pl_kho = 'Hủy' then 'HUY'
           when c.pl_kho = 'Kiểm tra' then 'LOI_KT'
           else 'USABLE'
         end,
         c.warninghsd, c.warnington
  from c;
$$;
revoke all on function app_inventory._dong_ton_kho(date, text) from public, anon, authenticated;

-- =====================================================================
--  RPC: danh sách snapshot + khối
-- =====================================================================
create or replace function app_inventory.ds_snapshot()
returns table (cycledate date)
language sql stable security definer
set search_path = ''
as $$
  with recursive d as (
    (select st.cycledate from app_order.stock st
      where st.cycledate is not null order by st.cycledate desc limit 1)
    union all
    select (select st.cycledate from app_order.stock st
             where st.cycledate < d.cycledate order by st.cycledate desc limit 1)
    from d where d.cycledate is not null
  )
  select d.cycledate from d where d.cycledate is not null;
$$;

create or replace function app_inventory.ds_khoi()
returns table (khoi text)
language sql stable security definer
set search_path = ''
as $$
  select distinct d.khoi from app_inventory.dm_hang_ton_kho d
  where d.khoi is not null order by 1;
$$;

-- =====================================================================
--  RPC: báo cáo tổng hợp theo BU / nhóm SP cho 1 snapshot (Triệu VNĐ)
-- =====================================================================
create or replace function app_inventory.bao_cao(p_cycledate date, p_khoi text)
returns table (
  bu text, nhom_sp text, thu_tu int,
  hsd_tren_12t numeric, hsd_6_12t numeric, hsd_duoi_6t numeric,
  het_han numeric, cho_huy numeric, loi_kt numeric,
  clc_tren_24t numeric, clc_tren_12t numeric, clc_tren_06t numeric,
  gv_ban_tb numeric, so_dong bigint
)
language sql stable security definer
set search_path = ''
as $$
  with r as (select * from app_inventory._dong_ton_kho(p_cycledate, p_khoi)),
  g as (
    select r.bu, r.nhom_sp,
      sum(r.gia_tri) filter (where r.nhom_trang_thai = 'USABLE' and r.pl_hsd = 'Trên 12T/Ko HSD') as hsd_tren_12t,
      sum(r.gia_tri) filter (where r.nhom_trang_thai = 'USABLE' and r.pl_hsd = 'Trên 06T')        as hsd_6_12t,
      sum(r.gia_tri) filter (where r.nhom_trang_thai = 'USABLE' and r.pl_hsd = 'Dưới 06T')        as hsd_duoi_6t,
      sum(r.gia_tri) filter (where r.nhom_trang_thai = 'HET_HAN') as het_han,
      sum(r.gia_tri) filter (where r.nhom_trang_thai = 'HUY')     as cho_huy,
      sum(r.gia_tri) filter (where r.nhom_trang_thai = 'LOI_KT')  as loi_kt,
      sum(r.gia_tri) filter (where r.nhom_trang_thai = 'USABLE' and r.pl_ton = 'Trên 24T') as clc_tren_24t,
      sum(r.gia_tri) filter (where r.nhom_trang_thai = 'USABLE' and r.pl_ton = 'Trên 12T') as clc_tren_12t,
      sum(r.gia_tri) filter (where r.nhom_trang_thai = 'USABLE' and r.pl_ton = 'Trên 06T') as clc_tren_06t,
      count(*) as so_dong
    from r group by r.bu, r.nhom_sp
  ),
  gv as (
    select distinct on (v.bu, v.nhom_sp) v.bu, v.nhom_sp, v.gia_tri
    from app_inventory.gv_ban_tb v
    where v.ky <= p_cycledate
    order by v.bu, v.nhom_sp, v.ky desc
  )
  select g.bu, g.nhom_sp, coalesce(n.thu_tu, 999),
         coalesce(g.hsd_tren_12t, 0), coalesce(g.hsd_6_12t, 0), coalesce(g.hsd_duoi_6t, 0),
         coalesce(g.het_han, 0), coalesce(g.cho_huy, 0), coalesce(g.loi_kt, 0),
         coalesce(g.clc_tren_24t, 0), coalesce(g.clc_tren_12t, 0), coalesce(g.clc_tren_06t, 0),
         gv.gia_tri, g.so_dong
  from g
  left join app_inventory.dm_nhom_bao_cao n
    on n.khoi = p_khoi and n.bu = g.bu and n.nhom_sp = g.nhom_sp
  left join gv on gv.bu = g.bu and gv.nhom_sp = g.nhom_sp
  order by g.bu, coalesce(n.thu_tu, 999), g.nhom_sp;
$$;

-- =====================================================================
--  RPC: chi tiết lô (drill-down). p_cot = cột báo cáo, null = tất cả.
-- =====================================================================
create or replace function app_inventory.chi_tiet(
  p_cycledate date, p_khoi text,
  p_bu text default null, p_nhom_sp text default null, p_cot text default null
)
returns table (
  ma_bravo text, ten_mat_hang text, bu text, nhom_sp text, hang text,
  warehousecode text, mien text, so_lo text, serialcode text, expirydate date,
  so_luong numeric, don_gia numeric, gia_tri numeric,
  pl_kho text, pl_hsd text, pl_ton text, nhom_trang_thai text
)
language sql stable security definer
set search_path = ''
as $$
  select r.ma_bravo, r.ten_mat_hang, r.bu, r.nhom_sp, r.hang,
         r.warehousecode, r.mien, r.so_lo, r.serialcode, r.expirydate,
         r.so_luong, r.don_gia, r.gia_tri,
         r.pl_kho, r.pl_hsd, r.pl_ton, r.nhom_trang_thai
  from app_inventory._dong_ton_kho(p_cycledate, p_khoi) r
  where (p_bu is null or r.bu = p_bu)
    and (p_nhom_sp is null or r.nhom_sp = p_nhom_sp)
    and r.so_luong <> 0
    and case p_cot
      when 'hsd_tren_12t' then r.nhom_trang_thai = 'USABLE' and r.pl_hsd = 'Trên 12T/Ko HSD'
      when 'hsd_6_12t'    then r.nhom_trang_thai = 'USABLE' and r.pl_hsd = 'Trên 06T'
      when 'hsd_duoi_6t'  then r.nhom_trang_thai = 'USABLE' and r.pl_hsd = 'Dưới 06T'
      when 'dang_sd'      then r.nhom_trang_thai = 'USABLE'
      when 'xau'          then r.nhom_trang_thai <> 'USABLE'
      when 'het_han'      then r.nhom_trang_thai = 'HET_HAN'
      when 'cho_huy'      then r.nhom_trang_thai = 'HUY'
      when 'loi_kt'       then r.nhom_trang_thai = 'LOI_KT'
      when 'clc_tren_24t' then r.nhom_trang_thai = 'USABLE' and r.pl_ton = 'Trên 24T'
      when 'clc_tren_12t' then r.nhom_trang_thai = 'USABLE' and r.pl_ton = 'Trên 12T'
      when 'clc_tren_06t' then r.nhom_trang_thai = 'USABLE' and r.pl_ton = 'Trên 06T'
      when 'clc'          then r.nhom_trang_thai = 'USABLE' and r.pl_ton in ('Trên 24T', 'Trên 12T', 'Trên 06T')
      else true
    end
  order by r.gia_tri desc nulls last
  limit 5000;
$$;

-- =====================================================================
--  RPC: số liệu đã chốt các kỳ trước
-- =====================================================================
create or replace function app_inventory.ds_ton_kho_ky(p_khoi text, p_tu date, p_den date)
returns table (ky date, bu text, nhom_sp text, chi_tieu text, gia_tri numeric, nguon text)
language sql stable security definer
set search_path = ''
as $$
  select t.ky, t.bu, t.nhom_sp, t.chi_tieu, t.gia_tri, t.nguon
  from app_inventory.ton_kho_ky t
  where t.khoi = p_khoi and t.ky between p_tu and p_den
  order by t.ky, t.bu, t.nhom_sp, t.chi_tieu;
$$;

-- =====================================================================
--  Chốt kỳ: tính từ snapshot rồi ghi vào ton_kho_ky (chỉ service_role).
--  vd: select app_inventory.chot_ky('2026-10-31', '2026-10-31', 'NGOẠI KHOA');
-- =====================================================================
create or replace function app_inventory.chot_ky(p_ky date, p_cycledate date, p_khoi text)
returns int
language plpgsql security definer
set search_path = ''
as $$
declare n int;
begin
  with b as (select * from app_inventory.bao_cao(p_cycledate, p_khoi)),
  v as (
    select b.bu, b.nhom_sp,
           b.hsd_tren_12t + b.hsd_6_12t + b.hsd_duoi_6t as dang_sd,
           b.het_han, b.cho_huy, b.loi_kt,
           b.clc_tren_24t + b.clc_tren_12t + b.clc_tren_06t as clc
    from b
  ),
  lv as (  -- nhóm SP, BU, khối
    select bu, nhom_sp, dang_sd, het_han, cho_huy, loi_kt, clc from v
    union all
    select bu, '', sum(dang_sd), sum(het_han), sum(cho_huy), sum(loi_kt), sum(clc) from v group by bu
    union all
    select '', '', sum(dang_sd), sum(het_han), sum(cho_huy), sum(loi_kt), sum(clc) from v
  ),
  u as (
    select lv.bu, lv.nhom_sp, x.chi_tieu, x.gia_tri
    from lv cross join lateral (values
      ('tong_kd', lv.dang_sd + lv.het_han + lv.cho_huy + lv.loi_kt),
      ('dang_sd', lv.dang_sd), ('het_han', lv.het_han), ('cho_huy', lv.cho_huy),
      ('loi_kt', lv.loi_kt), ('clc', lv.clc),
      ('xau', lv.het_han + lv.cho_huy + lv.loi_kt)
    ) as x(chi_tieu, gia_tri)
  )
  insert into app_inventory.ton_kho_ky (ky, khoi, bu, nhom_sp, chi_tieu, gia_tri, nguon, updated_at)
  select p_ky, p_khoi, u.bu, u.nhom_sp, u.chi_tieu, coalesce(u.gia_tri, 0),
         'snapshot ' || p_cycledate::text, now()
  from u
  on conflict (ky, khoi, bu, nhom_sp, chi_tieu) do update
    set gia_tri = excluded.gia_tri, nguon = excluded.nguon, updated_at = now();
  get diagnostics n = row_count;
  return n;
end $$;

revoke all on function app_inventory.chot_ky(date, date, text) from public, anon, authenticated;
grant execute on function app_inventory.chot_ky(date, date, text) to service_role;

revoke all on function app_inventory.ds_snapshot() from public;
revoke all on function app_inventory.ds_khoi() from public;
revoke all on function app_inventory.bao_cao(date, text) from public;
revoke all on function app_inventory.chi_tiet(date, text, text, text, text) from public;
revoke all on function app_inventory.ds_ton_kho_ky(text, date, date) from public;
grant execute on function app_inventory.ds_snapshot() to anon, authenticated, service_role;
grant execute on function app_inventory.ds_khoi() to anon, authenticated, service_role;
grant execute on function app_inventory.bao_cao(date, text) to anon, authenticated, service_role;
grant execute on function app_inventory.chi_tiet(date, text, text, text, text) to anon, authenticated, service_role;
grant execute on function app_inventory.ds_ton_kho_ky(text, date, date) to anon, authenticated, service_role;

-- =====================================================================
--  RPC: độ đầy đủ dữ liệu của 1 snapshot (để dashboard cảnh báo)
-- =====================================================================
create or replace function app_inventory.thong_tin_snapshot(p_cycledate date, p_khoi text)
returns table (so_dong bigint, so_dong_khong_master bigint, co_warnington bigint, co_warninghsd bigint)
language sql stable security definer
set search_path = ''
as $$
  select count(*),
         count(*) filter (where not exists (
           select 1 from app_inventory.dm_hang_ton_kho d where d.ma_bravo = st.ma_bravo)),
         count(st.warnington),
         count(st.warninghsd)
  from app_order.stock st
  where st.cycledate = p_cycledate;
$$;
revoke all on function app_inventory.thong_tin_snapshot(date, text) from public;
grant execute on function app_inventory.thong_tin_snapshot(date, text) to anon, authenticated, service_role;
