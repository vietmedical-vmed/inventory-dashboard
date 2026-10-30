import { Fragment, useMemo, useState } from 'react'
import { fmtNgay } from '../lib/report'
import { fmtHs, fmtPct, fmtTr } from '../lib/format'
import { ChevronRight, TH } from './ui'

// Ngưỡng tô cảnh báo
export const NGUONG = { he_so: 6, pct_clc: 0.2, pct_xau: 0.03 }

const chia = (a, b) => (a == null || !b ? null : a / b)

/**
 * Cấu hình cột cho từng tab. Mỗi cột:
 *   val(r)  giá trị;  fmt  tr | pct | hs | delta | deltaTr | spark
 *   drill   mã cột drill-down (null = toàn bộ), bỏ trống = không drill
 *   bar     vẽ thanh dữ liệu trong ô;  share  ghi tỷ trọng/tổng tồn dưới số (dòng BU, khối)
 *   warn(r) tô nền cảnh báo
 */
export function cotTheoTab(tab, periods) {
  const p3 = periods[periods.length - 1]
  const p2 = periods[periods.length - 2]
  switch (tab) {
    case 'hsd':
      return [
        { key: 'hsd_tren_12t', label: 'Trên 12T / Ko HSD', val: (r) => r.hsd_tren_12t, fmt: 'tr', drill: 'hsd_tren_12t', bar: true, share: true },
        { key: 'hsd_6_12t', label: '6-12 tháng', val: (r) => r.hsd_6_12t, fmt: 'tr', drill: 'hsd_6_12t', bar: true, share: true },
        { key: 'hsd_duoi_6t', label: 'Dưới 6 tháng', val: (r) => r.hsd_duoi_6t, fmt: 'tr', drill: 'hsd_duoi_6t', bar: true, share: true },
        { key: 'dang_sd', label: 'Tổng đang SD', val: (r) => r.dang_sd, fmt: 'tr', drill: 'dang_sd', strong: true },
        { key: 'het_han', label: 'Hết date, hỏng', val: (r) => r.het_han, fmt: 'tr', drill: 'het_han', bar: true, share: true },
        { key: 'cho_huy', label: 'Đã duyệt chờ hủy', val: (r) => r.cho_huy, fmt: 'tr', drill: 'cho_huy', bar: true, share: true },
        { key: 'loi_kt', label: 'Lỗi / KT', val: (r) => r.loi_kt, fmt: 'tr', drill: 'loi_kt', bar: true, share: true },
        { key: 'tong_kd', label: 'Tổng tồn kho KD', val: (r) => r.tong_kd, fmt: 'tr', drill: null, strong: true },
        { key: 'pct_xau', label: '% hàng xấu', val: (r) => chia(r.xau, r.tong_kd), fmt: 'pct', warn: (r) => chia(r.xau, r.tong_kd) > NGUONG.pct_xau },
      ]
    case 'clc':
      return [
        { key: 'clc_tren_24t', label: 'Tồn trên 24T', val: (r) => r.clc_tren_24t, fmt: 'tr', drill: 'clc_tren_24t', bar: true, share: true },
        { key: 'clc_tren_12t', label: 'Tồn trên 12T', val: (r) => r.clc_tren_12t, fmt: 'tr', drill: 'clc_tren_12t', bar: true, share: true },
        { key: 'clc_tren_06t', label: 'Tồn trên 06T', val: (r) => r.clc_tren_06t, fmt: 'tr', drill: 'clc_tren_06t', bar: true, share: true },
        { key: 'clc', label: 'Tổng CLC', val: (r) => r.clc, fmt: 'tr', drill: 'clc', strong: true },
        { key: 'pct_clc', label: '% CLC / tổng tồn', val: (r) => chia(r.clc, r.tong_kd), fmt: 'pct', warn: (r) => chia(r.clc, r.tong_kd) > NGUONG.pct_clc },
        { key: 'gv', label: 'GV bán TB tháng', val: (r) => r.gv_ban_tb, fmt: 'tr' },
        { key: 'he_so', label: 'Hệ số tồn kho (tháng)', val: (r) => r.he_so, fmt: 'hs', warn: (r) => r.he_so > NGUONG.he_so },
      ]
    case 'so_sanh':
      return [
        ...periods.map((p, i) => ({ key: 'ls' + i, label: fmtNgay(p.ky), sub: p.nguon === 'Đã chốt' ? null : p.nguon === 'Chưa có số liệu' ? 'chưa có' : 'ước tính', val: (r) => r.lich_su[i], fmt: 'tr', muted: true })),
        { key: 'tong_kd', label: 'Kỳ này', val: (r) => r.tong_kd, fmt: 'tr', strong: true, drill: null },
        { key: 'xu_huong', label: 'Xu hướng 4 kỳ', val: (r) => [...r.lich_su, r.tong_kd], fmt: 'spark' },
        { key: 'd_tr', label: `Δ so ${p3 ? fmtNgay(p3.ky) : 'kỳ trước'}`, val: (r) => (r.ky_truoc == null ? null : r.tong_kd - r.ky_truoc), fmt: 'deltaTr' },
        { key: 'd_pct', label: '% so kỳ trước', val: (r) => r.pct_ky_truoc, fmt: 'delta' },
        { key: 'd_sd', label: `% Δ đang SD so ${p2 ? fmtNgay(p2.ky) : '2 kỳ trước'}`, val: (r) => r.pct_dang_sd_2t, fmt: 'delta' },
        { key: 'd_xau', label: `% Δ hàng xấu so ${p2 ? fmtNgay(p2.ky) : '2 kỳ trước'}`, val: (r) => r.pct_xau_2t, fmt: 'delta' },
      ]
    default:
      return []
  }
}

function Spark({ values }) {
  const pts = values.map((v, i) => [i, v]).filter(([, v]) => v != null)
  if (pts.length < 2) return null
  const W = 72, H = 20, pad = 3
  const ys = pts.map(([, v]) => v)
  const lo = Math.min(...ys), hi = Math.max(...ys)
  const x = (i) => pad + (i / (values.length - 1)) * (W - 2 * pad)
  const y = (v) => (hi === lo ? H / 2 : H - pad - ((v - lo) / (hi - lo)) * (H - 2 * pad))
  const d = pts.map(([i, v], j) => `${j ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')
  const [li, lv] = pts[pts.length - 1]
  return (
    <svg width={W} height={H} className="inline-block align-middle" aria-hidden="true">
      <path d={d} fill="none" stroke="var(--s1)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={x(li)} cy={y(lv)} r="2.5" fill="var(--s1)" />
    </svg>
  )
}

function Delta({ v, tr }) {
  if (v == null || !Number.isFinite(v) || Math.abs(v) < (tr ? 0.5 : 0.0005)) return <span className="text-slate-300">·</span>
  const up = v > 0
  return (
    <span className={`font-medium ${up ? 'text-red-600' : 'text-emerald-700'}`}>
      {up ? '▲' : '▼'} {tr ? fmtTr(Math.abs(v)) : fmtPct(Math.abs(v))}
    </span>
  )
}

function GiaTri({ c, v }) {
  if (c.fmt === 'spark') return <Spark values={v} />
  if (c.fmt === 'delta') return <Delta v={v} />
  if (c.fmt === 'deltaTr') return <Delta v={v} tr />
  if (v == null || !Number.isFinite(v)) return <span className="text-slate-300">·</span>
  if (c.fmt === 'pct') return fmtPct(v)
  if (c.fmt === 'hs') return fmtHs(v)
  return Math.abs(v) < 0.5 ? <span className="text-slate-300">·</span> : fmtTr(v)
}

export default function CompactTable({ model, periods, tab, onDrill }) {
  // ẩn cột không có giá trị nào (vd kỳ cũ chỉ có tổng tồn, chưa có tách đang SD/hàng xấu)
  const cols = useMemo(() => {
    const rows = [model.khoi, ...model.bus.flatMap((g) => [g.tong, ...g.nhom])]
    return cotTheoTab(tab, periods).filter((c) => c.fmt === 'spark' || rows.some((r) => c.val(r) != null))
  }, [tab, periods, model])
  const [mo, setMo] = useState(() => new Set())
  const tatCaMo = mo.size === model.bus.length

  // max theo cột, tách mức nhóm và mức BU để thanh dữ liệu so cùng cấp
  const maxes = useMemo(() => {
    const m = { nhom: {}, bu: {} }
    for (const c of cols) {
      if (!c.bar) continue
      m.nhom[c.key] = Math.max(0, ...model.bus.flatMap((g) => g.nhom.map((r) => c.val(r) || 0)))
      m.bu[c.key] = Math.max(0, ...model.bus.map((g) => c.val(g.tong) || 0))
    }
    return m
  }, [cols, model])

  const toggle = (bu) =>
    setMo((s) => {
      const n = new Set(s)
      n.has(bu) ? n.delete(bu) : n.add(bu)
      return n
    })

  const o = (r, c, level, bu, nhom) => {
    const v = c.val(r)
    const click = onDrill && c.drill !== undefined && typeof v === 'number' && Math.abs(v) >= 0.5
    const mx = level === 'khoi' ? 0 : maxes[level]?.[c.key]
    const w = c.bar && mx > 0 && v > 0 ? Math.min(100, (v / mx) * 100) : 0
    const warn = c.warn?.(r)
    // vạch mảnh 3px ở đáy ô, dài theo tỷ lệ với giá trị lớn nhất cùng cấp
    const style = w
      ? {
          backgroundImage: 'linear-gradient(#7aa7fb, #7aa7fb)',
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'right 12px bottom 4px',
          backgroundSize: `calc((100% - 24px) * ${(w / 100).toFixed(3)}) 3px`,
        }
      : undefined
    return (
      <td
        key={c.key}
        style={style}
        className={`num whitespace-nowrap px-3 py-2 text-right ${c.strong ? 'font-semibold text-slate-900' : ''} ${c.muted ? 'text-slate-500' : ''} ${warn ? 'bg-red-50 font-semibold text-red-700' : ''} ${click ? 'cursor-pointer hover:text-blue-600 hover:underline' : ''}`}
        onClick={click ? () => onDrill({ bu, nhom, cot: c.drill, label: c.label }) : undefined}
        title={warn ? 'Vượt ngưỡng cảnh báo' : click ? 'Xem chi tiết lô' : undefined}
      >
        <GiaTri c={c} v={v} />
        {c.share && level !== 'nhom' && r.tong_kd > 0 && typeof v === 'number' && Math.abs(v) >= 0.5 && (
          <div className="text-[11px] font-normal text-slate-400">{fmtPct(v / r.tong_kd)}</div>
        )}
      </td>
    )
  }

  return (
    <div className="scroll-shadow overflow-x-auto">
      <table className="min-w-full text-[13px]">
        <thead className="sticky top-0 z-10">
          <tr className="bg-slate-50 text-left">
            <th className={`${TH} sticky left-0 z-20 min-w-[260px] bg-slate-50 normal-case tracking-normal`}>
              <button className="text-[12px] font-semibold text-blue-600 hover:underline" onClick={() => setMo(tatCaMo ? new Set() : new Set(model.bus.map((g) => g.bu)))}>
                {tatCaMo ? '− Thu gọn tất cả' : '+ Mở tất cả nhóm SP'}
              </button>
            </th>
            {cols.map((c) => (
              <th key={c.key} className={`${TH} text-right align-bottom`}>
                {c.label}
                {c.sub && <div className="font-normal normal-case text-slate-400">{c.sub}</div>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr className="border-b border-blue-100 bg-blue-50 font-bold text-slate-900">
            <td className="sticky left-0 z-[1] bg-blue-50 px-3 py-2.5">Khối {model.khoiTen}</td>
            {cols.map((c) => o(model.khoi, c, 'khoi', null, null))}
          </tr>
          {model.bus.map((g) => {
            const open = mo.has(g.bu)
            return (
              <Fragment key={g.bu}>
                <tr className="border-t border-slate-100 bg-white font-semibold text-slate-800 hover:bg-blue-50/40">
                  <td className="sticky left-0 z-[1] bg-white px-3 py-2">
                    <button className="flex items-center gap-2 hover:text-blue-600" onClick={() => toggle(g.bu)} aria-expanded={open}>
                      <ChevronRight size={14} className={`text-slate-400 transition-transform ${open ? 'rotate-90' : ''}`} />
                      BU {g.bu}
                      <span className="text-[11px] font-normal text-slate-400">{g.nhom.length} nhóm</span>
                    </button>
                  </td>
                  {cols.map((c) => o(g.tong, c, 'bu', g.bu, null))}
                </tr>
                {open &&
                  g.nhom.map((r, i) => (
                    <tr key={r.nhom_sp} className={`text-slate-700 hover:bg-blue-50/40 ${i % 2 ? 'bg-slate-50/50' : 'bg-white'}`}>
                      <td className={`sticky left-0 z-[1] py-1.5 pl-10 pr-3 text-slate-600 ${i % 2 ? 'bg-[#f8f9fa]' : 'bg-white'}`}>{r.nhom_sp}</td>
                      {cols.map((c) => o(r, c, 'nhom', g.bu, r.nhom_sp))}
                    </tr>
                  ))}
              </Fragment>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
