import { useState } from 'react'
import { fmtTr } from '../lib/format'

/**
 * Cột chồng theo kỳ (SVG thuần). series: [{ key, label, color, values: number[] }].
 * Khe 2px giữa các đoạn, đầu cột bo 4px, tổng ghi trên đỉnh, tooltip khi hover.
 */
export default function StackedBars({ categories, series, height = 240, unit = 'Triệu VNĐ' }) {
  const [hover, setHover] = useState(null)
  const W = 560
  const pad = { l: 56, r: 12, t: 22, b: 28 }
  const iw = W - pad.l - pad.r
  const ih = height - pad.t - pad.b
  const totals = categories.map((_, i) => series.reduce((s, se) => s + Math.max(0, se.values[i] || 0), 0))
  const max = niceMax(Math.max(1, ...totals))
  const y = (v) => pad.t + ih - (v / max) * ih
  const band = iw / categories.length
  const bw = Math.min(56, band * 0.5)
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => t * max)

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${height}`} className="w-full h-auto" role="img" aria-label={series.map((s) => s.label).join(', ')}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke="var(--line)" strokeWidth="1" />
            <text x={pad.l - 6} y={y(t)} dy="0.32em" textAnchor="end" fontSize="10" fill="var(--muted)" className="num">
              {fmtTr(t) === '-' ? '0' : fmtTr(t)}
            </text>
          </g>
        ))}
        <line x1={pad.l} x2={W - pad.r} y1={y(0)} y2={y(0)} stroke="var(--axis)" strokeWidth="1" />
        {categories.map((c, i) => {
          const x = pad.l + band * i + (band - bw) / 2
          let acc = 0
          const segs = series
            .map((se) => {
              const v = Math.max(0, se.values[i] || 0)
              const y0 = y(acc)
              acc += v
              return { se, v, y0, y1: y(acc) }
            })
            .filter((s) => s.v > 0)
          return (
            <g key={c} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              <rect x={pad.l + band * i} y={pad.t} width={band} height={ih} fill="transparent" />
              {segs.map((s, j) => {
                const top = j === segs.length - 1
                const h = Math.max(0, s.y0 - s.y1 - (j > 0 ? 2 : 0))
                return top ? (
                  <path key={s.se.key} d={roundTop(x, s.y1, bw, h, 4)} fill={s.se.color} opacity={hover == null || hover === i ? 1 : 0.55} />
                ) : (
                  <rect key={s.se.key} x={x} y={s.y1} width={bw} height={h} fill={s.se.color} opacity={hover == null || hover === i ? 1 : 0.55} />
                )
              })}
              <text x={x + bw / 2} y={y(totals[i]) - 6} textAnchor="middle" fontSize="10.5" fontWeight="600" fill="var(--ink)" className="num">
                {totals[i] ? fmtTr(totals[i]) : ''}
              </text>
              <text x={x + bw / 2} y={height - 8} textAnchor="middle" fontSize="10.5" fill="var(--ink-2)">{c}</text>
            </g>
          )
        })}
      </svg>
      {hover != null && (
        <div
          className="pointer-events-none absolute top-2 rounded-md border border-line bg-surface px-3 py-2 text-xs shadow-lg"
          style={{ left: `${((pad.l + band * hover + band / 2) / W) * 100}%`, transform: 'translateX(-50%)' }}
        >
          <div className="mb-1 font-semibold">{categories[hover]}</div>
          {[...series].reverse().map((se) => (
            <div key={se.key} className="flex items-center justify-between gap-4">
              <span className="flex items-center gap-1.5 text-ink2">
                <span className="inline-block h-2 w-2 rounded-sm" style={{ background: se.color }} />
                {se.label}
              </span>
              <span className="num">{fmtTr(se.values[hover])}</span>
            </div>
          ))}
          <div className="mt-1 flex justify-between gap-4 border-t border-line pt-1 font-semibold">
            <span>Tổng</span>
            <span className="num">{fmtTr(totals[hover])}</span>
          </div>
          <div className="text-muted">{unit}</div>
        </div>
      )}
      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink2">
        {series.map((se) => (
          <span key={se.key} className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: se.color }} />
            {se.label}
          </span>
        ))}
      </div>
    </div>
  )
}

function niceMax(v) {
  const p = Math.pow(10, Math.floor(Math.log10(v)))
  const n = v / p
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p
}

function roundTop(x, y, w, h, r) {
  r = Math.min(r, h, w / 2)
  return `M${x},${y + h} V${y + r} Q${x},${y} ${x + r},${y} H${x + w - r} Q${x + w},${y} ${x + w},${y + r} V${y + h} Z`
}
