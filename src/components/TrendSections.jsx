import StackedBars from './StackedBars'
import { fmtNgay, pct } from '../lib/report'
import { fmtPct, fmtTr } from '../lib/format'

const tdl = 'border border-line px-2 py-1 whitespace-nowrap text-left'
const td = 'border border-line px-2 py-1 text-right num whitespace-nowrap'
const th = 'border border-white/30 px-2 py-1.5 text-[11px] font-semibold text-white'
const BU_COLORS = ['var(--s1)', 'var(--s2)', 'var(--s3)', 'var(--s4)']

function Card({ title, children }) {
  return (
    <section className="rounded-lg border border-line bg-surface p-4">
      <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-head-2">{title}</h2>
      {children}
    </section>
  )
}

function Delta({ v }) {
  if (v == null || !Number.isFinite(v)) return null
  return <span className={v > 0 ? 'text-bad' : v < 0 ? 'text-good' : ''}>{fmtPct(v, true)}</span>
}

export function CanhBaoTonDong({ khoiTen, cot, nhanKy }) {
  const dong = [
    { key: 'tong_kd', label: 'Tổng tồn kho (hàng đang KD)', dam: true },
    { key: 'het_han', label: 'Hàng hết date, hỏng', ty: true },
    { key: 'cho_huy', label: 'Hàng đã duyệt chờ hủy', ty: true },
    { key: 'loi_kt', label: 'Hàng lỗi/KT', ty: true },
    { key: 'clc', label: 'Tổng giá trị CLC (chậm luân chuyển)', ty: true },
    { key: 'ton_dong', label: 'Tổng tồn đọng (HH + Chờ hủy + Lỗi/KT + CLC)', ty: true, dam: true },
  ]
  const series = [
    { key: 'het_han', label: 'Hết date, hỏng', color: 'var(--st-critical)' },
    { key: 'cho_huy', label: 'Chờ hủy', color: 'var(--st-serious)' },
    { key: 'loi_kt', label: 'Lỗi/KT', color: 'var(--st-warning)' },
    { key: 'clc', label: 'Chậm luân chuyển', color: 'var(--s1)' },
  ].map((s) => ({ ...s, values: cot.map((c) => c[s.key]) }))

  return (
    <Card title={`Cảnh báo tồn đọng - Khối ${khoiTen} (xu hướng 4 kỳ, Triệu VNĐ)`}>
      <div className="grid gap-4 xl:grid-cols-[1.25fr_1fr]">
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-xs">
            <thead>
              <tr className="bg-head">
                <th className={`${th} text-left`}>Chỉ tiêu</th>
                {nhanKy.map((k) => <th key={k} className={th}>{k}</th>)}
                <th className={th}>Δ so kỳ trước</th>
              </tr>
            </thead>
            <tbody>
              {dong.map((d) => {
                const last = cot[cot.length - 1][d.key]
                const prev = cot[cot.length - 2]?.[d.key]
                return [
                  <tr key={d.key} className={d.dam ? 'bg-band font-semibold' : ''}>
                    <td className={`${tdl}`}>{d.label}</td>
                    {cot.map((c, i) => <td key={i} className={td}>{fmtTr(c[d.key])}</td>)}
                    <td className={td}>{last != null && prev != null ? fmtTr(last - prev) : ''}</td>
                  </tr>,
                  d.ty && (
                    <tr key={d.key + '%'} className="text-ink2 italic">
                      <td className={`${tdl} pl-5`}>% / Tổng tồn kho</td>
                      {cot.map((c, i) => (
                        <td key={i} className={td}>{c[d.key] != null && c.tong_kd ? fmtPct(c[d.key] / c.tong_kd) : ''}</td>
                      ))}
                      <td className={td} />
                    </tr>
                  ),
                ]
              })}
            </tbody>
          </table>
        </div>
        <StackedBars categories={nhanKy} series={series} />
      </div>
    </Card>
  )
}

export function XuHuongBu({ khoiTen, model, periods, nhanKy }) {
  const dong = model.bus.map((g) => ({
    bu: g.bu,
    values: [...periods.map((p) => p.bang.get(g.bu, '', 'tong_kd')), g.tong.tong_kd],
  }))
  const tong = [...periods.map((p) => p.bang.get('', '', 'tong_kd')), model.khoi.tong_kd]
  const series = dong.map((d, i) => ({ key: d.bu, label: d.bu, color: BU_COLORS[i] || 'var(--muted)', values: d.values }))

  return (
    <Card title={`Xu hướng tồn kho hàng đang KD theo BU - Khối ${khoiTen} (Triệu VNĐ)`}>
      <div className="grid gap-4 xl:grid-cols-[1.25fr_1fr]">
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-xs">
            <thead>
              <tr className="bg-head">
                <th className={`${th} text-left`}>BU</th>
                {nhanKy.map((k) => <th key={k} className={th}>{k}</th>)}
              </tr>
            </thead>
            <tbody>
              {dong.map((d, i) => (
                <tr key={d.bu}>
                  <td className={`${tdl}`}>
                    <span className="mr-1.5 inline-block h-2 w-2 rounded-sm" style={{ background: BU_COLORS[i] }} />
                    {d.bu}
                  </td>
                  {d.values.map((v, j) => <td key={j} className={td}>{fmtTr(v)}</td>)}
                </tr>
              ))}
              <tr className="bg-band font-bold">
                <td className={`${tdl}`}>TỔNG KHỐI {khoiTen}</td>
                {tong.map((v, j) => <td key={j} className={td}>{fmtTr(v)}</td>)}
              </tr>
              <tr className="text-ink2">
                <td className={`${tdl}`}>Tăng/giảm so tháng trước (Triệu VNĐ)</td>
                {tong.map((v, j) => <td key={j} className={td}>{j && v != null && tong[j - 1] != null ? fmtTr(v - tong[j - 1]) : ''}</td>)}
              </tr>
              <tr className="text-ink2">
                <td className={`${tdl} pl-5`}>% tăng/giảm so tháng trước</td>
                {tong.map((v, j) => <td key={j} className={td}>{j ? <Delta v={pct(v, tong[j - 1])} /> : ''}</td>)}
              </tr>
            </tbody>
          </table>
        </div>
        <StackedBars categories={nhanKy} series={series} />
      </div>
    </Card>
  )
}

export const nhanCacKy = (periods, cycledate) => [...periods.map((p) => fmtNgay(p.ky)), fmtNgay(cycledate)]
