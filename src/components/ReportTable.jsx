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

const th = 'border border-white/30 px-2 py-1.5 font-semibold text-white text-[11px] leading-tight align-middle'
const tdl = 'border border-line px-2 py-1 whitespace-nowrap text-left'
const td = 'border border-line px-2 py-1 text-right num whitespace-nowrap'

function Delta({ v }) {
  if (v == null || !Number.isFinite(v)) return null
  return <span className={v > 0 ? 'text-bad' : v < 0 ? 'text-good' : ''}>{fmtPct(v, true)}</span>
}

function DongSo({ r, bu, nhom, onDrill, dam, periods }) {
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
      <td className={td}><Delta v={r.pct_dang_sd_2t} /></td>
      <td className={td}><Delta v={r.pct_xau_2t} /></td>
      {periods.map((p, i) => (
        <td key={p.ky} className={`${td} ${dam ? 'font-semibold' : ''}`}>{fmtTr(r.lich_su[i])}</td>
      ))}
    </>
  )
}

function DongTyTrong({ r, label, periods, className = '' }) {
  return (
    <tr className={`text-ink2 italic ${className}`}>
      <td className={`${tdl} not-italic`} colSpan={2}>{label}</td>
      {COT_SO.map((c) => (
        <td key={c.key} className={td}>{r.tong_kd ? fmtPct(r[c.key] / r.tong_kd) : ''}</td>
      ))}
      <td className={td} colSpan={6 + periods.length} />
    </tr>
  )
}

function DongTangGiam({ r, periods }) {
  const ls = r.lich_su
  const diff = (a, b) => (a == null || b == null ? null : a - b)
  const last = ls[ls.length - 1]
  const cells = (fn, fmt) => (
    <>
      {COT_SO.map((c) => (
        <td key={c.key} className={td}>{c.key === 'tong_kd' ? fmt(fn(r.tong_kd, last)) : ''}</td>
      ))}
      <td className={td} colSpan={6} />
      {periods.map((p, i) => (
        <td key={p.ky} className={td}>{i === 0 ? '' : fmt(fn(ls[i], ls[i - 1]))}</td>
      ))}
    </>
  )
  return (
    <>
      <tr className="text-ink2">
        <td className={`${tdl}`} colSpan={2}>Tăng/giảm so tháng trước (Triệu VNĐ)</td>
        {cells(diff, fmtTr)}
      </tr>
      <tr className="text-ink2">
        <td className={`${tdl} pl-5`} colSpan={2}>% tăng/giảm so tháng trước</td>
        {cells((a, b) => (a == null || !b ? null : (a - b) / b), (v) => <Delta v={v} />)}
      </tr>
    </>
  )
}

export default function ReportTable({ model, periods, onDrill }) {
  const truoc = periods[periods.length - 1]
  const p2 = periods[periods.length - 2]
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
            <th rowSpan={2} className={`${th} w-24`}>% Δ GT đang SD so {p2 && fmtNgay(p2.ky)}</th>
            <th rowSpan={2} className={`${th} w-24`}>% Δ (Hết date + Chờ hủy + Lỗi KT) so {p2 && fmtNgay(p2.ky)}</th>
            <th colSpan={periods.length} className={th}>Tổng tồn kho - Hàng đang KD các kỳ trước</th>
          </tr>
          <tr className="bg-head-2">
            {COT_HSD.map((c) => <th key={c.key} className={th}>{c.label}</th>)}
            {COT_CLC.map((c) => <th key={c.key} className={th}>{c.label}</th>)}
            {periods.map((p) => (
              <th key={p.ky} className={th} title={p.nguon}>
                {fmtNgay(p.ky)}
                {p.nguon !== 'Đã chốt' && <span className="block font-normal opacity-80">{p.nguon === 'Chưa có số liệu' ? 'chưa có' : 'ước tính'}</span>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {model.bus.map((g) => (
            <BuBlock key={g.bu} g={g} periods={periods} onDrill={onDrill} />
          ))}
          <tr className="bg-band font-bold">
            <td className={`${tdl} sticky left-0 bg-band`} colSpan={2}>KHỐI {model.khoiTen}</td>
            <DongSo r={model.khoi} bu={null} nhom={null} onDrill={onDrill} dam periods={periods} />
          </tr>
          <DongTyTrong r={model.khoi} label="TỶ TRỌNG/TỔNG GIÁ TRỊ TỒN KHO" periods={periods} className="font-semibold" />
        </tbody>
      </table>
    </div>
  )
}

function BuBlock({ g, periods, onDrill }) {
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
          <DongSo r={r} bu={g.bu} nhom={r.nhom_sp} onDrill={onDrill} periods={periods} />
        </tr>
      ))}
      <tr className="bg-band font-bold">
        <td className={`${td} sticky left-0 bg-band`} />
        <td className={`${tdl}`}>Tổng</td>
        <DongSo r={g.tong} bu={g.bu} nhom={null} onDrill={onDrill} dam periods={periods} />
      </tr>
      <DongTyTrong r={g.tong} label="Tỷ trọng/tổng giá trị tồn kho" periods={periods} />
      <DongTangGiam r={g.tong} periods={periods} />
      <tr><td colSpan={99} className="h-2 bg-page" /></tr>
    </>
  )
}
