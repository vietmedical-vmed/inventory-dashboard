import { useEffect, useMemo, useState } from 'react'
import { fmtNgay, kyTruoc, layKiemTra } from '../lib/report'
import { fmtSo } from '../lib/format'
import { taiCsv } from '../lib/exportExcel'

function TrangThai({ ok, title, children }) {
  return (
    <div className={`rounded-lg border bg-surface px-4 py-3 ${ok ? 'border-line' : 'border-bad'}`}>
      <div className="flex items-center gap-2 text-sm font-semibold">
        <span
          className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-xs text-white ${ok ? 'bg-good' : 'bg-bad'}`}
          aria-label={ok ? 'Ổn' : 'Cần xử lý'}
        >
          {ok ? '✓' : '!'}
        </span>
        {title}
      </div>
      <div className="mt-1.5 space-y-0.5 text-xs text-ink2">{children}</div>
    </div>
  )
}

function Muc({ title, count, ok, children, actions }) {
  const [open, setOpen] = useState(!ok)
  return (
    <section className="rounded-lg border border-line bg-surface">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
        <button className="flex items-center gap-2 text-sm font-semibold" onClick={() => setOpen(!open)} aria-expanded={open}>
          <span className={`inline-block w-3 text-muted transition-transform ${open ? 'rotate-90' : ''}`}>▶</span>
          {title}
          <span className={`rounded-full px-2 py-0.5 text-xs ${ok ? 'bg-band text-ink2' : 'bg-warn text-bad'}`}>{fmtSo(count)}</span>
        </button>
        {open && actions}
      </div>
      {open && <div className="border-t border-line">{children}</div>}
    </section>
  )
}

function Bang({ cols, rows, empty = 'Không có' }) {
  if (!rows.length) return <div className="px-4 py-3 text-sm text-good">✓ {empty}</div>
  return (
    <div className="max-h-[420px] overflow-auto">
      <table className="min-w-full text-[13px]">
        <thead className="sticky top-0 bg-band text-left text-xs text-ink2">
          <tr>
            {cols.map((c) => (
              <th key={c.key} className={`whitespace-nowrap px-3 py-2 font-semibold ${c.num ? 'text-right' : ''}`}>{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className={`border-t border-line ${r._hl ? 'bg-warn' : ''}`}>
              {cols.map((c) => (
                <td key={c.key} className={`px-3 py-1.5 ${c.num ? 'num text-right' : ''} ${c.wrap ? 'max-w-[360px]' : 'whitespace-nowrap'}`}>
                  {c.render ? c.render(r) : c.num ? fmtSo(r[c.key]) : r[c.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const PL_KHO = ['Tất cả', 'Đạt', 'Gửi', 'Hết hạn', 'Hủy', 'Kiểm tra']

export default function DataCheck({ cycledate, khoi }) {
  const [d, setD] = useState(null)
  const [err, setErr] = useState(null)
  const [chiCoBu, setChiCoBu] = useState(true)
  const [q, setQ] = useState('')
  const [plKho, setPlKho] = useState('Tất cả')

  useEffect(() => {
    setD(null)
    setErr(null)
    layKiemTra(cycledate, khoi).then(setD).catch((e) => setErr(e.message))
  }, [cycledate, khoi])

  const thieu = useMemo(() => {
    if (!d) return []
    const s = q.trim().toLowerCase()
    return d.thieu_master.filter(
      (r) => (!chiCoBu || r.bu) && (!s || [r.ma_bravo, r.ten, r.kho, r.nhom_san_pham].some((v) => v && v.toLowerCase().includes(s))),
    )
  }, [d, chiCoBu, q])

  const kho = useMemo(
    () => (d ? d.kho.filter((k) => plKho === 'Tất cả' || k.pl_kho === plKho).map((k) => ({ ...k, _hl: k.kho_moi })) : []),
    [d, plKho],
  )

  if (err) return <div className="rounded border border-bad bg-surface px-3 py-2 text-sm text-bad">{err}</div>
  if (!d) return <div className="py-10 text-center text-muted">Đang kiểm tra dữ liệu…</div>

  const kyCanChot = kyTruoc(cycledate, 1)[0]
  const daChot = d.chot_ky.find((c) => c.ky === kyCanChot)
  const sn = d.snapshot
  const thieuCoBu = d.thieu_master.filter((r) => r.bu).length
  const gvOk = d.gv_ban.ky && d.gv_ban.ky >= kyCanChot
  const tonOk = sn.so_dong > 0 && sn.co_warnington === sn.so_dong

  return (
    <div className="space-y-3">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <TrangThai ok={tonOk} title={`Snapshot ${fmtNgay(cycledate)}`}>
          <div>{fmtSo(sn.so_dong)} dòng · snapshot trước {sn.snapshot_truoc ? fmtNgay(sn.snapshot_truoc) : '—'}</div>
          <div>
            Có <code>warnington</code>: {fmtSo(sn.co_warnington)}/{fmtSo(sn.so_dong)}
            {!tonOk && <span className="text-bad"> — thiếu thì CLC tính là "dưới 6T"</span>}
          </div>
          <div>Có HSD: {fmtSo(sn.co_expirydate)} dòng</div>
        </TrangThai>
        <TrangThai ok={thieuCoBu === 0} title="Master đơn giá / phân loại">
          <div>
            {fmtSo(d.master.so_ma)} mã ({fmtSo(d.master.so_ma_kd)} đang KD) · {fmtSo(d.master.so_phien_ban)} phiên bản
          </div>
          <div>Cập nhật cuối: {d.master.cap_nhat_cuoi ? fmtNgay(d.master.cap_nhat_cuoi.slice(0, 10)) : '—'}</div>
          <div className="truncate" title={d.master.nguon}>Nguồn: {d.master.nguon || '—'}</div>
          {thieuCoBu > 0 && <div className="text-bad">{thieuCoBu} mã có BU trong dm_vat_tu đang có tồn nhưng chưa có master</div>}
        </TrangThai>
        <TrangThai ok={gvOk} title="GV bán TB tháng">
          <div>Kỳ đang dùng: {d.gv_ban.ky ? fmtNgay(d.gv_ban.ky) : 'chưa có'} · {d.gv_ban.so_nhom} nhóm</div>
          {!gvOk && <div className="text-bad">Cần số kỳ {fmtNgay(kyCanChot)} — nạp file Excel mới bằng nap_excel.py</div>}
        </TrangThai>
        <TrangThai ok={!!daChot} title="Chốt kỳ">
          <div>
            Kỳ {fmtNgay(kyCanChot)}: {daChot ? `đã chốt (${daChot.nguon})` : <span className="text-bad">chưa chốt</span>}
          </div>
          {!daChot && (
            <div className="break-all font-mono text-[11px]">
              select app_inventory.chot_ky('{kyCanChot}', '&lt;snapshot&gt;', '{khoi}')
            </div>
          )}
          <div>Gần nhất: {d.chot_ky.slice(0, 3).map((c) => fmtNgay(c.ky)).join(', ') || '—'}</div>
        </TrangThai>
      </div>

      <Muc
        title="Mã có tồn nhưng chưa có master (bị loại khỏi báo cáo)"
        count={chiCoBu ? thieuCoBu : d.thieu_master.length}
        ok={thieuCoBu === 0}
        actions={
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <label className="flex items-center gap-1.5 text-xs text-ink2">
              <input type="checkbox" checked={chiCoBu} onChange={(e) => setChiCoBu(e.target.checked)} />
              Chỉ mã có BU trong dm_vat_tu
            </label>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Tìm mã, tên, kho…"
              className="w-48 rounded border border-line bg-page px-2 py-1 text-sm"
            />
            <button className="rounded border border-line px-2 py-1 text-sm hover:bg-band" onClick={() => taiCsv(thieu, `thieu_master_${cycledate}.csv`)}>
              Tải CSV
            </button>
          </div>
        }
      >
        <Bang
          rows={thieu}
          cols={[
            { key: 'ma_bravo', label: 'Mã hàng', render: (r) => <span className="font-mono">{r.ma_bravo}</span> },
            { key: 'ten', label: 'Tên', wrap: true },
            { key: 'bu', label: 'BU (dm_vat_tu)' },
            { key: 'nhom_san_pham', label: 'Nhóm SP (dm_vat_tu)' },
            { key: 'sl', label: 'SL tồn', num: true },
            { key: 'so_dong', label: 'Số lô', num: true },
            { key: 'kho', label: 'Kho', wrap: true },
          ]}
        />
        <p className="px-4 py-2 text-xs text-muted">
          Bổ sung các mã này (đơn giá, BU, nhóm SP, PL hàng hóa) vào sheet DuLieu_goc rồi chạy lại nap_excel.py. Mã không có BU phần lớn
          thuộc khối khác.
        </p>
      </Muc>

      <Muc
        title="Danh sách kho trong snapshot"
        count={d.kho.length}
        ok
        actions={
          <div className="flex flex-wrap gap-1">
            {PL_KHO.map((p) => (
              <button
                key={p}
                onClick={() => setPlKho(p)}
                className={`rounded px-2 py-0.5 text-xs ${plKho === p ? 'bg-head-2 text-white' : 'border border-line text-ink2 hover:bg-band'}`}
              >
                {p}
              </button>
            ))}
          </div>
        }
      >
        <Bang
          rows={kho}
          cols={[
            { key: 'warehousecode', label: 'Mã kho', render: (r) => <span className="font-mono">{r.warehousecode}</span> },
            { key: 'pl_kho', label: 'Phân loại' },
            { key: 'so_dong', label: 'Số dòng', num: true },
            { key: 'so_dong_co_ton', label: 'Dòng có tồn', num: true },
            { key: 'so_dong_khoi', label: `Dòng thuộc ${khoi}`, num: true },
            { key: 'sl', label: 'SL tồn', num: true },
            { key: 'kho_moi', label: '', render: (r) => (r.kho_moi ? <span className="text-xs text-bad">mới so snapshot trước</span> : '') },
          ]}
        />
        <p className="px-4 py-2 text-xs text-muted">
          Phân loại theo đuôi mã kho: GU = gửi, HH = hết hạn, HU = hủy, KT = kiểm tra, còn lại = đạt.
        </p>
      </Muc>

      <Muc title={`Kho có tồn ở snapshot ${sn.snapshot_truoc ? fmtNgay(sn.snapshot_truoc) : 'trước'} nhưng không còn trong snapshot này`} count={d.kho_mat.length} ok={!d.kho_mat.length}>
        <Bang
          rows={d.kho_mat}
          cols={[
            { key: 'warehousecode', label: 'Mã kho', render: (r) => <span className="font-mono">{r.warehousecode}</span> },
            { key: 'so_dong', label: 'Số dòng (kỳ trước)', num: true },
            { key: 'sl', label: 'SL tồn (kỳ trước)', num: true },
          ]}
        />
      </Muc>

      <Muc title="Mã đang KD có tồn nhưng đơn giá = 0" count={d.gia_0.length} ok={!d.gia_0.length}>
        <Bang
          rows={d.gia_0}
          cols={[
            { key: 'ma_bravo', label: 'Mã hàng', render: (r) => <span className="font-mono">{r.ma_bravo}</span> },
            { key: 'ten', label: 'Tên', wrap: true },
            { key: 'bu', label: 'BU' },
            { key: 'nhom_sp', label: 'Nhóm SP' },
            { key: 'sl', label: 'SL tồn', num: true },
          ]}
        />
      </Muc>

      <Muc title={`Lô số lượng âm (${khoi})`} count={d.lo_am.length} ok={!d.lo_am.length}>
        <Bang
          rows={d.lo_am}
          cols={[
            { key: 'ma_bravo', label: 'Mã hàng', render: (r) => <span className="font-mono">{r.ma_bravo}</span> },
            { key: 'ten', label: 'Tên', wrap: true },
            { key: 'nhom_sp', label: 'Nhóm SP' },
            { key: 'warehousecode', label: 'Kho' },
            { key: 'so_lo', label: 'Số lô' },
            { key: 'sl', label: 'SL', num: true },
          ]}
        />
      </Muc>
    </div>
  )
}
