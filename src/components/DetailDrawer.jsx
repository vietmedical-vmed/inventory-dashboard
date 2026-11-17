import { useEffect, useMemo, useRef, useState } from 'react'
import { LOAI_GIAI_TRINH, layChiTiet, layGiaiTrinh, luuGiaiTrinh } from '../lib/report'
import { fmtSo, fmtTr, fmtVnd } from '../lib/format'
import { taiCsv } from '../lib/exportExcel'

const TRANG_THAI = { USABLE: 'Đang SD', HET_HAN: 'Hết date', HUY: 'Chờ hủy', LOI_KT: 'Lỗi/KT' }
const COT = ['Mã hàng', 'Tên mặt hàng', 'Nhóm SP', 'Kho', 'Số lô', 'Serial', 'HSD', 'SL', 'Đơn giá', 'Giá trị (Tr)', 'PL HSD', 'Luân chuyển', 'Trạng thái']

const fmtLuc = (s) => (s ? new Date(s).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' }) : '')

function CheckBox({ checked, indeterminate = false, onChange, label }) {
  const ref = useRef(null)
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate
  }, [indeterminate])
  return (
    <input
      ref={ref}
      type="checkbox"
      checked={checked}
      onChange={onChange}
      aria-label={label}
      className="h-3.5 w-3.5 cursor-pointer accent-blue-600 align-middle"
    />
  )
}

/** Hộp nhập giải trình cho các mã đã chọn. */
function GiaiTrinhModal({ ma, giaTriCu, nhom, onClose, onLuu }) {
  const [text, setText] = useState(giaTriCu)
  const [dangLuu, setDangLuu] = useState(false)
  const [loi, setLoi] = useState(null)

  useEffect(() => {
    const k = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
      }
    }
    window.addEventListener('keydown', k, true)
    return () => window.removeEventListener('keydown', k, true)
  }, [onClose])

  const luu = async () => {
    setDangLuu(true)
    setLoi(null)
    try {
      await onLuu(text)
    } catch (e) {
      setLoi(e.message)
      setDangLuu(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/30 p-4"
      onClick={(e) => {
        // không để click nền lan ra đóng luôn drawer chi tiết
        e.stopPropagation()
        onClose()
      }}
    >
      <div className="w-full max-w-lg rounded-xl bg-white p-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="text-xs text-slate-500">Giải trình · {nhom}</div>
        <div className="mb-2 font-semibold text-slate-800">{fmtSo(ma.length)} mã vật tư đã chọn</div>
        <div className="mb-3 max-h-20 overflow-auto font-mono text-[11px] leading-relaxed text-slate-500">{ma.join(', ')}</div>
        <textarea
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && !dangLuu) luu()
          }}
          rows={5}
          placeholder="Nhập nội dung giải trình (nguyên nhân, kế hoạch xử lý, thời hạn…)"
          className="w-full rounded-md border border-slate-300 px-2.5 py-2 text-sm focus:border-blue-500 focus:outline-none"
        />
        <div className="mt-1 text-[11px] text-slate-400">
          {ma.length > 1 ? 'Cùng một nội dung cho tất cả mã đã chọn. ' : ''}Để trống rồi lưu = xoá giải trình. Ctrl+Enter để lưu.
        </div>
        {loi && <div className="mt-2 text-[12px] text-red-600">{loi}</div>}
        <div className="mt-3 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-slate-200 px-3 py-1.5 text-[13px] font-semibold text-slate-700 hover:bg-slate-50"
          >
            Huỷ
          </button>
          <button
            type="button"
            disabled={dangLuu}
            onClick={luu}
            className="rounded-md bg-blue-600 px-4 py-1.5 text-[13px] font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {dangLuu ? 'Đang lưu…' : 'Lưu giải trình'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function DetailDrawer({ drill, cycledate, khoi, tenNhom = (bu, n) => n, onClose }) {
  const [rows, setRows] = useState(null)
  const [err, setErr] = useState(null)
  const [q, setQ] = useState('')
  // Giải trình theo mã Bravo, chỉ cho 5 nhóm cận date / hết date / CLC
  const coGt = LOAI_GIAI_TRINH.has(drill.cot)
  const [gt, setGt] = useState(() => new Map())
  const [gtErr, setGtErr] = useState(null)
  const [chon, setChon] = useState(() => new Set())
  const [moGt, setMoGt] = useState(false)

  useEffect(() => {
    setRows(null)
    setErr(null)
    setChon(new Set())
    layChiTiet({ p_cycledate: cycledate, p_khoi: khoi, p_bu: drill.bu, p_nhom_sp: drill.nhom, p_cot: drill.cot })
      // mã hàng A → Z; các lô cùng mã xếp liền nhau, giá trị lớn trước
      .then((r) =>
        setRows(
          [...r].sort(
            (a, b) =>
              (a.ma_bravo || '').localeCompare(b.ma_bravo || '', 'vi', { numeric: true }) ||
              Number(b.gia_tri || 0) - Number(a.gia_tri || 0),
          ),
        ),
      )
      .catch((e) => setErr(e.message))
  }, [drill, cycledate, khoi])

  useEffect(() => {
    setGt(new Map())
    setGtErr(null)
    if (!coGt) return
    layGiaiTrinh(cycledate, drill.cot)
      .then(setGt)
      .catch((e) => setGtErr(e.message))
  }, [coGt, drill.cot, cycledate])

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
      [r.ma_bravo, r.ten_mat_hang, r.warehousecode, r.so_lo, r.serialcode, coGt && gt.get(r.ma_bravo)?.noi_dung].some(
        (v) => v && v.toLowerCase().includes(s),
      ),
    )
  }, [rows, q, coGt, gt])
  const tong = loc.reduce((s, r) => s + Number(r.gia_tri || 0), 0)
  const tieuDe = [drill.bu ? drill.buTen || drill.bu : `Khối ${khoi}`, drill.nhom && (drill.nhomTen || drill.nhom), drill.label].filter(Boolean).join(' · ')

  // Mã Bravo (không trùng) trong danh sách đang lọc / toàn bộ
  const maLoc = useMemo(() => [...new Set(loc.map((r) => r.ma_bravo))], [loc])
  const maTatCa = useMemo(() => (rows ? [...new Set(rows.map((r) => r.ma_bravo))] : []), [rows])
  const soDaGt = maTatCa.filter((m) => gt.has(m)).length
  const soChonLoc = maLoc.filter((m) => chon.has(m)).length
  const chonHet = maLoc.length > 0 && soChonLoc === maLoc.length

  const doiChon = (ma) =>
    setChon((cur) => {
      const s = new Set(cur)
      s.has(ma) ? s.delete(ma) : s.add(ma)
      return s
    })
  const chonTatCa = () =>
    setChon((cur) => {
      const s = new Set(cur)
      for (const m of maLoc) chonHet ? s.delete(m) : s.add(m)
      return s
    })

  const maChon = [...chon]
  // Các mã đã chọn cùng một nội dung thì điền sẵn để sửa
  const noiDungChung = (() => {
    const set = new Set(maChon.map((m) => gt.get(m)?.noi_dung || ''))
    return set.size === 1 ? [...set][0] : ''
  })()

  const luu = async (text) => {
    await luuGiaiTrinh(cycledate, drill.cot, maChon, text)
    setGt(await layGiaiTrinh(cycledate, drill.cot))
    setChon(new Set())
    setMoGt(false)
  }

  const xuatCsv = () => {
    const out = coGt
      ? loc.map((r) => {
          const g = gt.get(r.ma_bravo)
          return { ...r, giai_trinh: g?.noi_dung || '', nguoi_giai_trinh: g?.nguoi_cap_nhat || '', luc_giai_trinh: g?.cap_nhat_luc || '' }
        })
      : loc
    taiCsv(out, `chi_tiet_${cycledate}.csv`)
  }

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/30" onClick={onClose}>
      <div className="flex h-full w-full max-w-[min(1800px,96vw)] flex-col bg-surface shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 border-b border-line px-4 py-3">
          <div>
            <div className="text-xs text-muted">Chi tiết lô tồn kho</div>
            <div className="font-semibold">{tieuDe}</div>
            {rows && (
              <div className="text-xs text-ink2">
                {fmtSo(loc.length)} dòng · <span className="num font-semibold">{fmtTr(tong)}</span> Triệu VNĐ
                {rows.length >= 5000 && ' · hiển thị tối đa 5.000 dòng giá trị lớn nhất'}
                {coGt && (
                  <>
                    {' · '}
                    <span className={soDaGt < maTatCa.length ? 'font-semibold text-amber-700' : 'font-semibold text-emerald-700'}>
                      Đã giải trình {fmtSo(soDaGt)}/{fmtSo(maTatCa.length)} mã
                    </span>
                  </>
                )}
              </div>
            )}
            {gtErr && <div className="text-xs text-bad">Không tải được giải trình: {gtErr}</div>}
          </div>
          <div className="flex items-center gap-2">
            {coGt && chon.size > 0 && (
              <button
                type="button"
                onClick={() => setMoGt(true)}
                className="rounded-md bg-blue-600 px-3 py-1 text-sm font-semibold text-white hover:bg-blue-700"
              >
                Giải trình ({fmtSo(chon.size)} mã)
              </button>
            )}
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={coGt ? 'Tìm mã, tên, kho, lô, giải trình…' : 'Tìm mã, tên, kho, lô…'}
              className="w-56 rounded border border-line bg-page px-2 py-1 text-sm"
            />
            <button
              className="rounded border border-line px-2 py-1 text-sm hover:bg-band disabled:opacity-40"
              disabled={!loc.length}
              onClick={xuatCsv}
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
              <thead className="sticky top-0 z-10 bg-band text-left">
                <tr>
                  {coGt && (
                    <th className="w-8 border-b border-line px-2 py-1.5 text-center">
                      <CheckBox
                        checked={chonHet}
                        indeterminate={soChonLoc > 0 && !chonHet}
                        onChange={chonTatCa}
                        label="Chọn tất cả mã"
                      />
                    </th>
                  )}
                  {COT.map((h) => (
                    <th key={h} className="whitespace-nowrap border-b border-line px-2 py-1.5 font-semibold">{h}</th>
                  ))}
                  {coGt && <th className="min-w-[260px] border-b border-line px-2 py-1.5 font-semibold">Giải trình</th>}
                </tr>
              </thead>
              <tbody>
                {loc.map((r, i) => {
                  const daChon = coGt && chon.has(r.ma_bravo)
                  const g = coGt ? gt.get(r.ma_bravo) : null
                  return (
                    <tr key={i} className={`border-b border-line ${daChon ? 'bg-blue-50' : 'hover:bg-band'}`}>
                      {coGt && (
                        <td className="px-2 py-1 text-center">
                          <CheckBox checked={daChon} onChange={() => doiChon(r.ma_bravo)} label={`Chọn mã ${r.ma_bravo}`} />
                        </td>
                      )}
                      <td className="px-2 py-1 font-mono">{r.ma_bravo}</td>
                      <td className="min-w-[220px] px-2 py-1">{r.ten_mat_hang}</td>
                      <td className="whitespace-nowrap px-2 py-1">{tenNhom(r.bu, r.nhom_sp)}</td>
                      <td className="whitespace-nowrap px-2 py-1">{r.warehousecode}</td>
                      <td className="px-2 py-1">{r.so_lo}</td>
                      <td className="max-w-[160px] break-all px-2 py-1">{r.serialcode}</td>
                      <td className="whitespace-nowrap px-2 py-1">{r.expirydate}</td>
                      <td className="num px-2 py-1 text-right">{fmtSo(r.so_luong)}</td>
                      <td className="num px-2 py-1 text-right">{fmtVnd(r.don_gia)}</td>
                      <td className="num px-2 py-1 text-right font-semibold">{fmtTr(r.gia_tri)}</td>
                      <td className="whitespace-nowrap px-2 py-1">{r.pl_hsd}</td>
                      <td className="whitespace-nowrap px-2 py-1">{r.pl_ton}</td>
                      <td className="whitespace-nowrap px-2 py-1">{TRANG_THAI[r.nhom_trang_thai] || r.nhom_trang_thai}</td>
                      {coGt && (
                        <td className="px-2 py-1">
                          {g ? (
                            <>
                              <div className="whitespace-pre-wrap text-slate-700">{g.noi_dung}</div>
                              <div className="text-[10px] text-slate-400">
                                {g.nguoi_cap_nhat} · {fmtLuc(g.cap_nhat_luc)}
                              </div>
                            </>
                          ) : (
                            <span className="text-slate-300">Chưa giải trình</span>
                          )}
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
      {moGt && (
        <GiaiTrinhModal
          ma={maChon}
          giaTriCu={noiDungChung}
          nhom={drill.label}
          onClose={() => setMoGt(false)}
          onLuu={luu}
        />
      )}
    </div>
  )
}
