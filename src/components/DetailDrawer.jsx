import { useEffect, useMemo, useState } from 'react'
import { layChiTiet } from '../lib/report'
import { fmtSo, fmtTr, fmtVnd } from '../lib/format'
import { taiCsv } from '../lib/exportExcel'

const TRANG_THAI = { USABLE: 'Đang SD', HET_HAN: 'Hết date', HUY: 'Chờ hủy', LOI_KT: 'Lỗi/KT' }

export default function DetailDrawer({ drill, cycledate, khoi, onClose }) {
  const [rows, setRows] = useState(null)
  const [err, setErr] = useState(null)
  const [q, setQ] = useState('')

  useEffect(() => {
    setRows(null)
    setErr(null)
    layChiTiet({ p_cycledate: cycledate, p_khoi: khoi, p_bu: drill.bu, p_nhom_sp: drill.nhom, p_cot: drill.cot })
      .then(setRows)
      .catch((e) => setErr(e.message))
  }, [drill, cycledate, khoi])

  useEffect(() => {
    const k = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [onClose])

  const loc = useMemo(() => {
    if (!rows) return []
    const s = q.trim().toLowerCase()
    if (!s) return rows
    return rows.filter((r) =>
      [r.ma_bravo, r.ten_mat_hang, r.warehousecode, r.so_lo, r.serialcode].some((v) => v && v.toLowerCase().includes(s)),
    )
  }, [rows, q])
  const tong = loc.reduce((s, r) => s + Number(r.gia_tri || 0), 0)
  const tieuDe = [drill.bu ? `BU ${drill.bu}` : `Khối ${khoi}`, drill.nhom, drill.label].filter(Boolean).join(' · ')

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/30" onClick={onClose}>
      <div className="flex h-full w-full max-w-5xl flex-col bg-surface shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 border-b border-line px-4 py-3">
          <div>
            <div className="text-xs text-muted">Chi tiết lô tồn kho</div>
            <div className="font-semibold">{tieuDe}</div>
            {rows && (
              <div className="text-xs text-ink2">
                {fmtSo(loc.length)} dòng · <span className="num font-semibold">{fmtTr(tong)}</span> Triệu VNĐ
                {rows.length >= 5000 && ' · hiển thị tối đa 5.000 dòng giá trị lớn nhất'}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Tìm mã, tên, kho, lô…"
              className="w-56 rounded border border-line bg-page px-2 py-1 text-sm"
            />
            <button
              className="rounded border border-line px-2 py-1 text-sm hover:bg-band disabled:opacity-40"
              disabled={!loc.length}
              onClick={() => taiCsv(loc, `chi_tiet_${cycledate}.csv`)}
            >
              Tải CSV
            </button>
            <button className="rounded px-2 py-1 text-lg leading-none hover:bg-band" onClick={onClose} aria-label="Đóng">
              ×
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-auto">
          {err && <div className="p-4 text-bad">{err}</div>}
          {!rows && !err && <div className="p-4 text-muted">Đang tải…</div>}
          {rows && (
            <table className="min-w-full text-xs">
              <thead className="sticky top-0 bg-band text-left">
                <tr>
                  {['Mã hàng', 'Tên mặt hàng', 'Nhóm SP', 'Kho', 'Số lô', 'Serial', 'HSD', 'SL', 'Đơn giá', 'Giá trị (Tr)', 'PL HSD', 'Luân chuyển', 'Trạng thái'].map((h) => (
                    <th key={h} className="whitespace-nowrap border-b border-line px-2 py-1.5 font-semibold">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loc.map((r, i) => (
                  <tr key={i} className="border-b border-line hover:bg-band">
                    <td className="px-2 py-1 font-mono">{r.ma_bravo}</td>
                    <td className="max-w-[260px] truncate px-2 py-1" title={r.ten_mat_hang}>{r.ten_mat_hang}</td>
                    <td className="whitespace-nowrap px-2 py-1">{r.nhom_sp}</td>
                    <td className="whitespace-nowrap px-2 py-1">{r.warehousecode}</td>
                    <td className="px-2 py-1">{r.so_lo}</td>
                    <td className="max-w-[120px] truncate px-2 py-1" title={r.serialcode}>{r.serialcode}</td>
                    <td className="whitespace-nowrap px-2 py-1">{r.expirydate}</td>
                    <td className="num px-2 py-1 text-right">{fmtSo(r.so_luong)}</td>
                    <td className="num px-2 py-1 text-right">{fmtVnd(r.don_gia)}</td>
                    <td className="num px-2 py-1 text-right font-semibold">{fmtTr(r.gia_tri)}</td>
                    <td className="whitespace-nowrap px-2 py-1">{r.pl_hsd}</td>
                    <td className="whitespace-nowrap px-2 py-1">{r.pl_ton}</td>
                    <td className="whitespace-nowrap px-2 py-1">{TRANG_THAI[r.nhom_trang_thai] || r.nhom_trang_thai}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
