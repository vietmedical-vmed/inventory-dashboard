-- =====================================================================
--  RPC ds_thang: snapshot mới nhất của mỗi tháng + độ đầy đủ dữ liệu.
--  Dashboard chỉ cho chọn tháng có warnington (cần để phân loại luân chuyển/CLC);
--  các snapshot cũ chưa có cột này bị ẩn khỏi bộ lọc.
-- =====================================================================
create or replace function app_inventory.ds_thang()
returns table (thang text, cycledate date, so_dong bigint, co_warnington bigint)
language sql stable security definer
set search_path = ''
as $$
  with m as (
    select distinct on (to_char(d.cycledate, 'YYYY-MM'))
           to_char(d.cycledate, 'YYYY-MM') as thang, d.cycledate
    from app_inventory.ds_snapshot() d
    order by to_char(d.cycledate, 'YYYY-MM'), d.cycledate desc
  )
  select m.thang, m.cycledate,
         (select count(*) from app_order.stock st where st.cycledate = m.cycledate),
         (select count(st.warnington) from app_order.stock st where st.cycledate = m.cycledate)
  from m
  order by m.thang desc;
$$;
revoke all on function app_inventory.ds_thang() from public;
grant execute on function app_inventory.ds_thang() to anon, authenticated, service_role;
notify pgrst, 'reload schema';
