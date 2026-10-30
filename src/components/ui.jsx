import { useEffect, useRef, useState } from 'react'

// Bộ khung giao diện dùng chung, theo bidding-and-contract / sale-target.

const icon = (paths) =>
  function Icon({ size = 16, className = '' }) {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        aria-hidden
      >
        {paths.map((d) => (
          <path key={d} d={d} />
        ))}
      </svg>
    )
  }

export const Check = icon(['M20 6 9 17l-5-5'])
export const Loader2 = icon(['M21 12a9 9 0 1 1-6.219-8.56'])
export const AlertCircle = icon(['M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z', 'M12 8v4', 'M12 16h.01'])
export const AlertTriangle = icon([
  'm21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3',
  'M12 9v4',
  'M12 17h.01',
])
export const ChevronDown = icon(['m6 9 6 6 6-6'])
export const ChevronRight = icon(['m9 6 6 6-6 6'])
export const RefreshCw = icon(['M3 12a9 9 0 0 1 15-6.7L21 8', 'M21 3v5h-5', 'M21 12a9 9 0 0 1-15 6.7L3 16', 'M3 21v-5h5'])
export const XIcon = icon(['M18 6 6 18', 'm6 6 12 12'])
export const Download = icon(['M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4', 'm7 10 5 5 5-5', 'M12 15V3'])
export const LogOut = icon(['M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4', 'm16 17 5-5-5-5', 'M21 12H9'])
export const Search = icon(['m21 21-4.34-4.34', 'M11 17a6 6 0 1 0 0-12 6 6 0 0 0 0 12Z'])

/** Khung nội dung có tiêu đề 13px + phụ đề 11px. */
export function Panel({ title, subtitle, right, children, className = '' }) {
  return (
    <section className={`overflow-hidden rounded-lg border border-slate-200 bg-white ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-2.5">
        <div>
          <h3 className="text-[13px] font-semibold text-slate-800">{title}</h3>
          {subtitle && <p className="text-[11px] text-slate-400">{subtitle}</p>}
        </div>
        {right}
      </div>
      {children}
    </section>
  )
}

const BADGE = {
  red: 'bg-red-50 text-red-700 border-red-200',
  amber: 'bg-amber-50 text-amber-700 border-amber-200',
  blue: 'bg-blue-50 text-blue-700 border-blue-200',
  green: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  grey: 'bg-slate-100 text-slate-500 border-slate-200',
}

export function Badge({ tone = 'grey', children, title }) {
  return (
    <span title={title} className={`inline-block whitespace-nowrap rounded border px-1.5 py-0.5 text-[11px] font-medium ${BADGE[tone]}`}>
      {children}
    </span>
  )
}

export function LoadingBlock({ error }) {
  if (error) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-10 text-[13px] text-red-700">
        <span className="flex items-center gap-1.5">
          <AlertCircle size={14} /> Không tải được dữ liệu: {error}
        </span>
        <span className="text-[12px] text-red-600">Bấm Reload trên header để thử lại.</span>
      </div>
    )
  }
  return (
    <div className="flex flex-col items-center gap-3 py-16 text-[13px] text-slate-500">
      <div className="spinner" />
      Đang tải dữ liệu…
    </div>
  )
}

export function RefreshingBar() {
  return (
    <div className="flex items-center gap-2 rounded-md border border-blue-200 bg-blue-50 px-3 py-1.5 text-[12px] text-blue-700">
      <Loader2 size={12} className="animate-spin" />
      Đang cập nhật dữ liệu…
    </div>
  )
}

/** Bộ lọc dạng "Nhãn: giá trị ▾", chọn 1. options: [{ value, label }] */
export function FilterSelect({ label, options, value, onChange }) {
  const [open, setOpen] = useState(false)
  const box = useRef(null)
  useEffect(() => {
    const onDoc = (e) => box.current && !box.current.contains(e.target) && setOpen(false)
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])
  const cur = options.find((o) => o.value === value)
  return (
    <div ref={box} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex max-w-[260px] items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-[13px] outline-none hover:border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
      >
        <span className="shrink-0 text-slate-400">{label}:</span>
        <span className="truncate font-medium text-blue-700">{cur?.label ?? '—'}</span>
        <ChevronDown size={13} className="shrink-0 text-slate-400" />
      </button>
      {open && (
        <div className="scroll-shadow absolute left-0 top-full z-50 mt-1 max-h-[300px] min-w-[200px] overflow-y-auto rounded-md border border-slate-200 bg-white py-1 shadow-lg">
          {options.map((o) => (
            <div
              key={o.value}
              onClick={() => {
                onChange(o.value)
                setOpen(false)
              }}
              className={`flex cursor-pointer items-center justify-between gap-3 px-3 py-1.5 text-[13px] hover:bg-slate-50 ${o.value === value ? 'font-medium text-blue-700' : 'text-slate-700'}`}
            >
              <span>{o.label}</span>
              {o.hint && <span className="text-[11px] text-slate-400">{o.hint}</span>}
              {o.value === value && <Check size={14} className="text-blue-600" />}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/** Tab gạch chân trong header. */
export function Tabs({ tabs, value, onChange }) {
  return (
    <nav className="scroll-shadow flex items-center gap-1 overflow-x-auto border-t border-slate-100 px-6" role="tablist">
      {tabs.map((t) => (
        <button
          key={t.key}
          role="tab"
          aria-selected={value === t.key}
          onClick={() => onChange(t.key)}
          className={`-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-[13px] font-medium transition-colors ${value === t.key ? 'border-blue-500 text-blue-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
        >
          {t.label}
          {t.badge != null && <span className="ml-1.5">{t.badge}</span>}
        </button>
      ))}
    </nav>
  )
}

/** Tiêu đề cột bảng: 11px chữ hoa, nền slate-50. */
export const TH = 'px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500'
