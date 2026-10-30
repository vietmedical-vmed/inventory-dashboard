import StackedBars from './StackedBars'
import { Panel, TH } from './ui'
import { fmtNgay, pct } from '../lib/report'
import { fmtPct, fmtTr } from '../lib/format'

const td = 'num whitespace-nowrap px-3 py-1.5 text-right'
const BU_COLORS = ['var(--s1)', 'var(--s2)', 'var(--s3)', 'var(--s4)']

function Delta({ v, tr }) {
  if (v == null || !Number.isFinite(v) || Math.abs(v) < (tr ? 0.5 : 0.0005)) return <span className="text-slate-300">·</span>
  return (
    <span className={`font-medium ${v > 0 ? 'text-red-600' : 'text-emerald-700'}`}>
      {v > 0 ? '▲' : '▼'} {tr ? fmtTr(Math.abs(v)) : fmtPct(Math.abs(v))}
    </span>
  )
}

function Bang({ head, children }) {
  return (
    <div className="scroll-shadow overflow-x-auto border-t border-slate-100">
      <table className="w-full border-collapse text-[13px]">
        <thead>
          <tr className="bg-slate-50">
            {head.map((h, i) => (
              <th key={i} className={`${TH} ${i ? 'text-right' : 'text-left'}`}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  )
}

export function CanhBaoTonDong({ khoiTen, cot, nhanKy }) {
  const dong = [
    { key: 'tong_kd', label: 'Tổng tồn kho (hàng đang KD)', dam: true },
    { key: 'het_han', label: 'Hàng hết date, hỏng', color: 'var(--st-critical)' },
    { key: 'cho_huy', label: 'Hàng đã duyệt chờ hủy', color: 'var(--st-serious)' },
    { key: 'loi_kt', label: 'Hàng lỗi / KT', color: 'var(--st-warning)' },
    { key: 'clc', label: 'Chậm luân chuyển (CLC)', color: 'var(--st-clc)' },
    { key: 'ton_dong', label: 'Tổng tồn đọng', dam: true },
  ]
  const series = dong
    .filter((d) => d.color)
    .map((d) => ({ key: d.key, label: d.label, color: d.color, values: cot.map((c) => c[d.key]) }))

  return (
    <Panel title="Cảnh báo tồn đọng" subtitle={`Khối ${khoiTen} · xu hướng 4 kỳ · triệu VNĐ · % là tỷ trọng trên tổng tồn`}>
      <div className="px-4 pb-2 pt-3">
        <StackedBars categories={nhanKy} series={series} height={220} />
      </div>
      <Bang head={['Chỉ tiêu', ...nhanKy, 'Δ kỳ trước']}>
        {dong.map((d, i) => {
          const last = cot[cot.length - 1][d.key]
          const prev = cot[cot.length - 2]?.[d.key]
          return (
            <tr key={d.key} className={`${d.dam ? 'font-semibold text-slate-900' : 'text-slate-700'} ${i % 2 ? 'bg-slate-50/50' : 'bg-white'} hover:bg-blue-50/40`}>
              <td className="whitespace-nowrap px-3 py-1.5">
                <span className="flex items-center gap-1.5">
                  {d.color && <span className="h-2.5 w-2.5 rounded-sm" style={{ background: d.color }} aria-hidden />}
                  {d.label}
                </span>
              </td>
              {cot.map((c, j) => (
                <td key={j} className={td}>
                  {fmtTr(c[d.key])}
                  {d.key !== 'tong_kd' && c[d.key] != null && c.tong_kd ? (
                    <div className="text-[11px] font-normal text-slate-400">{fmtPct(c[d.key] / c.tong_kd)}</div>
                  ) : null}
                </td>
              ))}
              <td className={td}>{last != null && prev != null ? <Delta v={last - prev} tr /> : ''}</td>
            </tr>
          )
        })}
      </Bang>
    </Panel>
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
    <Panel title="Xu hướng tồn kho theo BU" subtitle={`Khối ${khoiTen} · hàng đang KD · triệu VNĐ`}>
      <div className="px-4 pb-2 pt-3">
        <StackedBars categories={nhanKy} series={series} height={220} />
      </div>
      <Bang head={['BU', ...nhanKy]}>
        {dong.map((d, i) => (
          <tr key={d.bu} className={`text-slate-700 ${i % 2 ? 'bg-slate-50/50' : 'bg-white'} hover:bg-blue-50/40`}>
            <td className="whitespace-nowrap px-3 py-1.5">
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm" style={{ background: BU_COLORS[i] }} aria-hidden />
                {d.bu}
              </span>
            </td>
            {d.values.map((v, j) => <td key={j} className={td}>{fmtTr(v)}</td>)}
          </tr>
        ))}
        <tr className="border-t border-blue-100 bg-blue-50 font-bold text-slate-900">
          <td className="whitespace-nowrap px-3 py-1.5">Tổng khối</td>
          {tong.map((v, j) => <td key={j} className={td}>{fmtTr(v)}</td>)}
        </tr>
        <tr className="bg-white text-slate-600">
          <td className="whitespace-nowrap px-3 py-1.5">So tháng trước</td>
          {tong.map((v, j) => (
            <td key={j} className={td}>
              {j ? (
                <>
                  <Delta v={v != null && tong[j - 1] != null ? v - tong[j - 1] : null} tr />
                  <div className="text-[11px]"><Delta v={pct(v, tong[j - 1])} /></div>
                </>
              ) : (
                ''
              )}
            </td>
          ))}
        </tr>
      </Bang>
    </Panel>
  )
}

export const nhanCacKy = (periods, cycledate) => [...periods.map((p) => fmtNgay(p.ky)), fmtNgay(cycledate)]
