import { COT_CLC, COT_HSD, COT_XAU, fmtNgay } from '../lib/report'
import { fmtHs, fmtPct, fmtTr } from '../lib/format'

// Cột giá trị kỳ này (có drill-down), theo thứ tự trong file Excel
const COT_SO = [
  ...COT_HSD,
  { key: 'dang_sd', label: 'Tổng GT hàng đang sử dụng', tong: true },
  ...COT_XAU,
  { key: 'tong_kd', label: 'Tổng tồn kho - Hàng đang KD', tong: true },
  ...COT_CLC,
  { key: 'clc', label: 'Tổng giá trị CLC', tong: true },
]
// Cột sau phần giá trị: GV bán TB, hệ số, kỳ trước, % so kỳ trước
const SO_COT_SAU = 4

const th = 'border border-white/30 px-2 py-1.5 font-semibold text-white text-[11px] leading-tight align-middle'
const tdl = 'border border-slate-200 px-3 py-1.5 whitespace-nowrap text-left'
const td = 'border border-slate-200 px-2 py-1.5 text-right num whitespace-nowrap'

function Delta({ v }) {
  if (v == null || !Number.isFinite(v)) return null
  return <span className={v > 0 ? 'text-red-600' : v < 0 ? 'text-emerald-700' : ''}>{fmtPct(v, true)}</span>
}

function DongSo({ r, drill, onDrill }) {
  return (
    <>
      {COT_SO.map((c) => {
        const v = r[c.key]
        const click = onDrill && Math.abs(v) >= 0.5
        return (
          <td
            key={c.key}
            className={`${td} ${c.tong ? 'bg-slate-50 font-semibold' : ''} ${click ? 'cursor-pointer hover:text-blue-600 hover:underline' : ''}`}
            onClick={click ? () => onDrill({ ...drill, cot: c.key === 'tong_kd' ? null : c.key, label: c.label }) : undefined}
            title={click ? 'Xem chi tiết lô' : undefined}
          >
            {fmtTr(v)}
          </td>
        )
      })}
      <td className={td}>{fmtTr(r.gv_ban_tb)}</td>
      <td className={td}>{fmtHs(r.he_so)}</td>
      <td className={td}>{fmtTr(r.ky_truoc)}</td>
      <td className={td}><Delta v={r.pct_ky_truoc} /></td>
    </>
  )
}

/** Bảng bố cục Excel cho 1 BU: các nhóm SP + Tổng + Tỷ trọng. */
export default function ReportTable({ g, periods, onDrill }) {
  const truoc = periods[periods.length - 1]
  const t = g.tong
  return (
    <div className="scroll-shadow overflow-x-auto">
      <table className="min-w-full border-collapse text-[12px]">
        <thead>
          <tr className="bg-head">
            <th rowSpan={2} className={`${th} sticky left-0 min-w-[200px] bg-head text-left`}>Nhóm SP</th>
            <th colSpan={3} className={th}>Phân loại hàng theo HSD</th>
            <th rowSpan={2} className={`${th} w-24`}>Tổng GT hàng đang sử dụng</th>
            <th rowSpan={2} className={`${th} w-20`}>Hàng hết date, hỏng</th>
            <th rowSpan={2} className={`${th} w-20`}>Hàng đã duyệt chờ hủy</th>
            <th rowSpan={2} className={`${th} w-20`}>Hàng lỗi/KT</th>
            <th rowSpan={2} className={`${th} w-24`}>Tổng tồn kho - Hàng đang KD</th>
            <th colSpan={3} className={th}>Phân loại theo mức độ luân chuyển</th>
            <th rowSpan={2} className={`${th} w-20`}>Tổng giá trị CLC</th>
            <th rowSpan={2} className={`${th} w-24`}>GV bán TB tháng gần nhất</th>
            <th rowSpan={2} className={`${th} w-16`}>Hệ số tồn kho TB</th>
            <th rowSpan={2} className={`${th} w-24`}>Giá trị kỳ trước ({truoc && fmtNgay(truoc.ky)})</th>
            <th rowSpan={2} className={`${th} w-20`}>% tăng/giảm so kỳ trước</th>
          </tr>
          <tr className="bg-head-2">
            {COT_HSD.map((c) => <th key={c.key} className={th}>{c.label}</th>)}
            {COT_CLC.map((c) => <th key={c.key} className={th}>{c.label}</th>)}
          </tr>
        </thead>
        <tbody>
          {g.nhom.map((r, i) => (
            <tr key={r.nhom_sp} className={`text-slate-700 hover:bg-blue-50/40 ${i % 2 ? 'bg-slate-50/50' : 'bg-white'}`}>
              <td className={`${tdl} sticky left-0 ${i % 2 ? 'bg-[#f8f9fa]' : 'bg-white'}`}>
                {r.ten}
              </td>
              <DongSo r={r} drill={{ bu: g.bu, nhom: r.nhom_sp, buTen: g.ten, nhomTen: r.ten }} onDrill={onDrill} />
            </tr>
          ))}
          <tr className="bg-blue-50 font-bold text-slate-900">
            <td className={`${tdl} sticky left-0 bg-blue-50`}>Tổng</td>
            <DongSo r={t} drill={{ bu: g.bu, nhom: null, buTen: g.ten }} onDrill={onDrill} />
          </tr>
          <tr className="bg-white italic text-slate-500">
            <td className={`${tdl} sticky left-0 bg-white not-italic`}>Tỷ trọng/tổng giá trị tồn kho</td>
            {COT_SO.map((c) => (
              <td key={c.key} className={td}>{t.tong_kd ? fmtPct(t[c.key] / t.tong_kd) : ''}</td>
            ))}
            <td className={td} colSpan={SO_COT_SAU} />
          </tr>
        </tbody>
      </table>
    </div>
  )
}
