-- =====================================================================
--  Giải trình theo mã vật tư Bravo cho 5 nhóm hàng cần giải trình:
--    hsd_6_12t, hsd_duoi_6t  (cận date: HSD 6-12 tháng, dưới 6 tháng)
--    het_han                 (hàng hết date, hỏng)
--    clc_tren_24t, clc_tren_12t (chậm luân chuyển: tồn kho trên 24T, trên 12T)
--
--  Khoá theo tháng của snapshot (không theo cycledate): tháng có snapshot mới hơn
--  thì giải trình vẫn giữ nguyên. Một mã có thể giải trình khác nhau ở từng nhóm.
--  Ghi / đọc chỉ qua Edge Function inventory-api (service_role); người cập nhật
--  do inventory-api điền từ token, client không tự khai được.
-- =====================================================================
create table if not exists app_inventory.giai_trinh (
  thang           date not null,  -- ngày đầu tháng của snapshot
  loai            text not null
                  check (loai in ('hsd_6_12t', 'hsd_duoi_6t', 'het_han', 'clc_tren_24t', 'clc_tren_12t')),
  ma_bravo        text not null,
  noi_dung        text not null,
  nguoi_cap_nhat  text,
  cap_nhat_luc    timestamptz not null default now(),
  primary key (thang, loai, ma_bravo)
);
alter table app_inventory.giai_trinh enable row level security;
revoke all on table app_inventory.giai_trinh from public, anon, authenticated;
grant select, insert, update, delete on table app_inventory.giai_trinh to service_role;

-- Đọc giải trình của 1 tháng; p_loai null = cả 5 nhóm.
create or replace function app_inventory.ds_giai_trinh(p_cycledate date, p_loai text default null)
returns table (loai text, ma_bravo text, noi_dung text, nguoi_cap_nhat text, cap_nhat_luc timestamptz)
language sql stable security definer
set search_path = ''
as $$
  select g.loai, g.ma_bravo, g.noi_dung, g.nguoi_cap_nhat, g.cap_nhat_luc
  from app_inventory.giai_trinh g
  where g.thang = date_trunc('month', p_cycledate)::date
    and (p_loai is null or g.loai = p_loai)
  order by g.loai, g.ma_bravo;
$$;

-- Ghi cùng 1 nội dung cho nhiều mã. Nội dung rỗng = xoá giải trình của các mã đó.
-- Trả về số mã đã ghi / xoá.
create or replace function app_inventory.luu_giai_trinh(
  p_cycledate date, p_loai text, p_ma_bravo text[], p_noi_dung text, p_nguoi text
)
returns int
language plpgsql volatile security definer
set search_path = ''
as $$
declare
  v_thang date := date_trunc('month', p_cycledate)::date;
  v_noi_dung text := nullif(btrim(coalesce(p_noi_dung, '')), '');
  v_n int;
begin
  if p_loai not in ('hsd_6_12t', 'hsd_duoi_6t', 'het_han', 'clc_tren_24t', 'clc_tren_12t') then
    raise exception 'Nhóm % không cần giải trình', p_loai;
  end if;
  if coalesce(cardinality(p_ma_bravo), 0) = 0 then
    return 0;
  end if;

  if v_noi_dung is null then
    delete from app_inventory.giai_trinh g
    where g.thang = v_thang and g.loai = p_loai and g.ma_bravo = any (p_ma_bravo);
    get diagnostics v_n = row_count;
    return v_n;
  end if;

  insert into app_inventory.giai_trinh as g (thang, loai, ma_bravo, noi_dung, nguoi_cap_nhat, cap_nhat_luc)
  select distinct v_thang, p_loai, m, v_noi_dung, p_nguoi, now()
  from unnest(p_ma_bravo) as m
  where nullif(btrim(m), '') is not null
  on conflict (thang, loai, ma_bravo) do update
    set noi_dung = excluded.noi_dung,
        nguoi_cap_nhat = excluded.nguoi_cap_nhat,
        cap_nhat_luc = excluded.cap_nhat_luc;
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

revoke all on function app_inventory.ds_giai_trinh(date, text) from public, anon, authenticated;
revoke all on function app_inventory.luu_giai_trinh(date, text, text[], text, text) from public, anon, authenticated;
grant execute on function app_inventory.ds_giai_trinh(date, text) to service_role;
grant execute on function app_inventory.luu_giai_trinh(date, text, text[], text, text) to service_role;

notify pgrst, 'reload schema';
