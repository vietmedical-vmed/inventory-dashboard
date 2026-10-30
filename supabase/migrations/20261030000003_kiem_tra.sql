-- =====================================================================
--  RPC kiem_tra: kiểm tra độ đầy đủ dữ liệu cho 1 snapshot + khối
--  (tab "Kiểm tra dữ liệu" trên dashboard). Trả về 1 jsonb.
-- =====================================================================
create or replace function app_inventory.kiem_tra(p_cycledate date, p_khoi text)
returns jsonb
language sql stable security definer
set search_path = ''
as $$
  with s as (
    select st.*, coalesce(st.closeinventory, st.quantity, 0) as sl
    from app_order.stock st
    where st.cycledate = p_cycledate
  ),
  prev as (
    select max(st.cycledate) as d from app_order.stock st where st.cycledate < p_cycledate
  ),
  sp as (
    select st.warehousecode, coalesce(st.closeinventory, st.quantity, 0) as sl
    from app_order.stock st, prev
    where st.cycledate = prev.d
  ),
  -- mọi mã đã từng có master (bất kỳ khối)
  mall as (select distinct d.ma_bravo from app_inventory.dm_hang_ton_kho d),
  -- phiên bản master mới nhất của khối đang xem
  mk as (
    select distinct on (d.ma_bravo) d.*
    from app_inventory.dm_hang_ton_kho d
    order by d.ma_bravo, d.updated_at desc
  ),
  mkk as (select * from mk where mk.khoi = p_khoi),
  kho as (
    select s.warehousecode,
           count(*) as so_dong,
           count(*) filter (where s.sl <> 0) as so_dong_co_ton,
           count(*) filter (where s.sl <> 0 and exists (select 1 from mkk where mkk.ma_bravo = s.ma_bravo)) as so_dong_khoi,
           sum(s.sl) as sl
    from s group by s.warehousecode
  )
  select jsonb_build_object(
    'snapshot', (
      select jsonb_build_object(
        'so_dong', count(*),
        'co_warnington', count(s.warnington),
        'co_warninghsd', count(s.warninghsd),
        'co_expirydate', count(s.expirydate),
        'snapshot_truoc', (select d from prev))
      from s),
    'master', (
      select jsonb_build_object(
        'so_ma', (select count(*) from mkk),
        'so_ma_kd', (select count(*) from mkk where mkk.pl_hang_hoa = 'Hàng đang kinh doanh'),
        'so_phien_ban', count(*),
        'cap_nhat_cuoi', max(d.updated_at),
        'nguon', (select d2.nguon from app_inventory.dm_hang_ton_kho d2
                  where d2.khoi = p_khoi order by d2.updated_at desc limit 1))
      from app_inventory.dm_hang_ton_kho d where d.khoi = p_khoi),
    'gv_ban', (
      select jsonb_build_object(
        'ky', max(g.ky),
        'so_nhom', count(*) filter (where g.ky = (select max(g2.ky) from app_inventory.gv_ban_tb g2 where g2.ky <= p_cycledate)))
      from app_inventory.gv_ban_tb g where g.ky <= p_cycledate),
    'chot_ky', coalesce((
      select jsonb_agg(x order by x.ky desc) from (
        select t.ky, max(t.nguon) as nguon, max(t.updated_at) as updated_at, count(*) as so_dong
        from app_inventory.ton_kho_ky t
        where t.khoi = p_khoi and t.ky <= p_cycledate
        group by t.ky order by t.ky desc limit 6) x), '[]'::jsonb),
    -- mã có tồn trong snapshot nhưng chưa có master
    'thieu_master', coalesce((
      select jsonb_agg(x) from (
        select s.ma_bravo, max(s.itemname) as ten, v.bu, v.nhom_san_pham,
               sum(s.sl) as sl, count(*) as so_dong,
               string_agg(distinct s.warehousecode, ', ') as kho
        from s
        left join shared.dm_vat_tu v on v.ma_bravo = s.ma_bravo
        where s.sl <> 0 and not exists (select 1 from mall where mall.ma_bravo = s.ma_bravo)
        group by s.ma_bravo, v.bu, v.nhom_san_pham
        order by (v.bu is null), v.bu, v.nhom_san_pham, s.ma_bravo
        limit 3000) x), '[]'::jsonb),
    -- mã hàng đang KD của khối, có tồn nhưng đơn giá = 0
    'gia_0', coalesce((
      select jsonb_agg(x) from (
        select mkk.ma_bravo, mkk.ten_mat_hang as ten, mkk.bu, mkk.nhom_sp, sum(s.sl) as sl, count(*) as so_dong
        from s join mkk on mkk.ma_bravo = s.ma_bravo
        where mkk.pl_hang_hoa = 'Hàng đang kinh doanh' and coalesce(mkk.don_gia, 0) = 0 and s.sl <> 0
        group by mkk.ma_bravo, mkk.ten_mat_hang, mkk.bu, mkk.nhom_sp
        order by mkk.bu, mkk.nhom_sp, mkk.ma_bravo) x), '[]'::jsonb),
    -- lô số lượng âm thuộc khối
    'lo_am', coalesce((
      select jsonb_agg(x) from (
        select s.ma_bravo, mkk.ten_mat_hang as ten, mkk.bu, mkk.nhom_sp, s.warehousecode, s.so_lo, s.sl,
               s.sl * mkk.don_gia / 1e6 as gia_tri
        from s join mkk on mkk.ma_bravo = s.ma_bravo
        where s.sl < 0
        order by s.sl * mkk.don_gia) x), '[]'::jsonb),
    -- kho có hàng (có tồn) ở snapshot trước nhưng không còn dòng nào ở snapshot này
    'kho_mat', coalesce((
      select jsonb_agg(x) from (
        select sp.warehousecode, count(*) as so_dong, sum(sp.sl) as sl
        from sp
        where sp.sl <> 0 and not exists (select 1 from s where s.warehousecode = sp.warehousecode)
        group by sp.warehousecode order by sp.warehousecode) x), '[]'::jsonb),
    'kho', coalesce((
      select jsonb_agg(x) from (
        select kho.*,
               case
                 when regexp_replace(coalesce(kho.warehousecode, ''), '^.*\.', '') = 'GU' then 'Gửi'
                 when regexp_replace(coalesce(kho.warehousecode, ''), '^.*\.', '') = 'HH' then 'Hết hạn'
                 when regexp_replace(coalesce(kho.warehousecode, ''), '^.*\.', '') like 'HU%' then 'Hủy'
                 when regexp_replace(coalesce(kho.warehousecode, ''), '^.*\.', '') like 'KT%' then 'Kiểm tra'
                 else 'Đạt'
               end as pl_kho,
               not exists (select 1 from sp where sp.warehousecode = kho.warehousecode) as kho_moi
        from kho order by kho.warehousecode) x), '[]'::jsonb)
  );
$$;
revoke all on function app_inventory.kiem_tra(date, text) from public;
grant execute on function app_inventory.kiem_tra(date, text) to anon, authenticated, service_role;
notify pgrst, 'reload schema';
