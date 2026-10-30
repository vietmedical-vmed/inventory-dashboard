import { COT_CLC, COT_HSD, COT_XAU, fmtNgay } from '../lib/report'
import { fmtHs, fmtPct, fmtTr } from '../lib/format'

// Cột giá trị kỳ này (có drill-down), theo thứ tự trong file Excel
const COT_SO = [
  ...COT_HSD.map((c) => ({ ...c, nhom: 'hsd' })),
  { key: 'dang_sd', label: 'Tổng GT hàng đang sử dụng', tong: true },
  ...COT_XAU,
  { key: 'tong_kd', label: 'Tổng tồn kho - Hàng đang KD', tong: true, chinh: true },
  ...COT_CLC.map((c) => ({ ...c, nhom: 'clc' })),
  { key: 'clc', label: 'Tổng giá trị CLC', tong: true },
]
// Cột sau phần giá trị: GV bán TB, hệ số, kỳ trước, % so kỳ trước
const SO_COT_SAU = 4

const th = 'border border-white/30 px-2 py-1.5 font-semibold text-white text-[11px] leading-tight align-middle'
const tdl = 'border border-line px-2 py-1 whitespace-nowrap text-left'
const td = 'border border-line px-2 py-1 text-right num whitespace-nowrap'

function Delta({ v }) {
  if (v == null || !Number.isFinite(v)) return null
  return <span className={v > 0 ? 'text-bad' : v < 0 ? 'text-good' : ''}>{fmtPct(v, true)}</span>
}

function DongSo({ r, bu, nhom, onDrill }) {
  return (
    <>
      {COT_SO.map((c) => {
        const v = r[c.key]
        const click = onDrill && Math.abs(v) >= 0.5
        return (
          <td
            key={c.key}
            className={`${td} ${c.tong ? 'bg-band font-semibold' : ''} ${click ? 'cursor-pointer hover:underline hover:text-head-2' : ''}`}
            onClick={click ? () => onDrill({ bu, nhom, cot: c.key === 'tong_kd' ? null : c.key, label: c.label }) : undefined}
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

function DongTyTrong({ r, label, className = '' }) {
  return (
    <tr className={`text-ink2 italic ${className}`}>
      <td className={`${tdl} not-italic`} colSpan={2}>{label}</td>
      {COT_SO.map((c) => (
        <td key={c.key} className={td}>{r.tong_kd ? fmtPct(r[c.key] / r.tong_kd) : ''}</td>
      ))}
      <td className={td} colSpan={SO_COT_SAU} />
    </tr>
  )
}

export default function ReportTable({ model, periods, onDrill }) {
  const truoc = periods[periods.length - 1]
  return (
    <div className="overflow-x-auto rounded-lg border border-line bg-surface">
      <table className="min-w-full border-collapse text-xs">
        <thead className="sticky top-0 z-10">
          <tr className="bg-head">
            <th rowSpan={2} className={`${th} min-w-[84px] sticky left-0 bg-head`}>Ngành hàng</th>
            <th rowSpan={2} className={`${th} min-w-[190px] text-left`}>Nhóm SP</th>
            <th colSpan={3} className={th}>Phân loại hàng theo HSD (Triệu VNĐ)</th>
            <th rowSpan={2} className={`${th} w-24`}>Tổng GT hàng đang sử dụng</th>
            <th rowSpan={2} className={`${th} w-20`}>Hàng hết date, hỏng</th>
            <th rowSpan={2} className={`${th} w-20`}>Hàng đã duyệt chờ hủy</th>
            <th rowSpan={2} className={`${th} w-20`}>Hàng lỗi/KT</th>
            <th rowSpan={2} className={`${th} w-24`}>Tổng tồn kho - Hàng đang KD</th>
            <th colSpan={3} className={th}>Phân loại theo mức độ luân chuyển (Triệu VNĐ)</th>
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
          {model.bus.map((g) => (
            <BuBlock key={g.bu} g={g} onDrill={onDrill} />
          ))}
          <tr className="bg-band font-bold">
            <td className={`${tdl} sticky left-0 bg-band`} colSpan={2}>KHỐI {model.khoiTen}</td>
            <DongSo r={model.khoi} bu={null} nhom={null} onDrill={onDrill} />
          </tr>
          <DongTyTrong r={model.khoi} label="TỶ TRỌNG/TỔNG GIÁ TRỊ TỒN KHO" className="font-semibold" />
        </tbody>
      </table>
    </div>
  )
}

function BuBlock({ g, onDrill }) {
  return (
    <>
      {g.nhom.map((r, i) => (
        <tr key={r.nhom_sp} className="hover:bg-band">
          {i === 0 && (
            <td rowSpan={g.nhom.length} className={`${tdl} !text-center font-bold sticky left-0 bg-surface`}>
              BU {g.bu}
            </td>
          )}
          <td className={`${tdl}`}>{r.nhom_sp}</td>
          <DongSo r={r} bu={g.bu} nhom={r.nhom_sp} onDrill={onDrill} />
        </tr>
      ))}
      <tr className="bg-band font-bold">
        <td className={`${td} sticky left-0 bg-band`} />
        <td className={`${tdl}`}>Tổng</td>
        <DongSo r={g.tong} bu={g.bu} nhom={null} onDrill={onDrill} />
      </tr>
      <DongTyTrong r={g.tong} label="Tỷ trọng/tổng giá trị tồn kho" />
      <tr><td colSpan={99} className="h-2 bg-page" /></tr>
    </>
  )
}
