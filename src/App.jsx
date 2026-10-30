import { useCallback, useEffect, useMemo, useState } from 'react'
import ReportTable from './components/ReportTable'
import CompactTable, { NGUONG } from './components/CompactTable'
import DetailDrawer from './components/DetailDrawer'
import DataCheck from './components/DataCheck'
import { CanhBaoTonDong, XuHuongBu, nhanCacKy } from './components/TrendSections'
import { fmtNgay, layDanhSachKhoi, layDanhSachSnapshot, taiBaoCao } from './lib/report'
import { canhBaoTonDong, dungMoHinh } from './lib/model'
import { fmtHs, fmtPct, fmtSo, fmtTy } from './lib/format'
import { xuatExcel } from './lib/exportExcel'

const nho = (k, v) => {
  try {
    if (v === undefined) return localStorage.getItem(k)
    localStorage.setItem(k, v)
  } catch {
    return null
  }
}

function Kpi({ label, value, unit, sub, tone }) {
  return (
    <div className="rounded-lg border border-line bg-surface px-4 py-3">
      <div className="text-xs text-ink2">{label}</div>
      <div className="mt-1 flex items-baseline gap-1">
        <span className="text-2xl font-bold">{value}</span>
        {unit && <span className="text-xs text-muted">{unit}</span>}
      </div>
      {sub && <div className={`mt-0.5 text-xs ${tone === 'bad' ? 'text-bad' : tone === 'good' ? 'text-good' : 'text-muted'}`}>{sub}</div>}
    </div>
  )
}

const dauDelta = (v) => (v == null ? null : v > 0 ? 'bad' : 'good')

const TABS = [
  { key: 'tong_quan', label: 'Tổng quan' },
  { key: 'hsd', label: 'Chất lượng HSD' },
  { key: 'clc', label: 'Luân chuyển (CLC)' },
  { key: 'so_sanh', label: 'So sánh kỳ trước' },
  { key: 'excel', label: 'Bản Excel' },
  { key: 'kiem_tra', label: 'Kiểm tra dữ liệu' },
]

export default function App() {
  const [snapshots, setSnapshots] = useState([])
  const [khois, setKhois] = useState([])
  const [cycledate, setCycledate] = useState(null)
  const [khoi, setKhoi] = useState(null)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState(null)
  const [drill, setDrill] = useState(null)
  const [exporting, setExporting] = useState(false)
  const [tab, setTab] = useState(() => {
    const t = nho('inv.tab')
    return TABS.some((x) => x.key === t) ? t : 'tong_quan'
  })

  useEffect(() => {
    Promise.all([layDanhSachSnapshot(), layDanhSachKhoi()])
      .then(([s, k]) => {
        setSnapshots(s)
        setKhois(k)
        const savedK = nho('inv.khoi')
        setKhoi(k.includes(savedK) ? savedK : k[0] || null)
        setCycledate(s[0] || null)
      })
      .catch((e) => setErr(e.message))
  }, [])

  useEffect(() => {
    if (!cycledate || !khoi) return
    setLoading(true)
    setErr(null)
    taiBaoCao(cycledate, khoi, snapshots)
      .then(setData)
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false))
  }, [cycledate, khoi, snapshots])

  const view = useMemo(() => {
    if (!data) return null
    const model = { ...dungMoHinh(data.rows, data.periods), khoiTen: khoi }
    const canhBao = canhBaoTonDong(model.khoi, data.periods)
    const nhanKy = nhanCacKy(data.periods, cycledate)
    return { model, canhBao, nhanKy }
  }, [data, khoi, cycledate])

  const onDrill = useCallback((d) => setDrill(d), [])
  const closeDrill = useCallback(() => setDrill(null), [])

  const k = view?.model.khoi
  const cb = view?.canhBao
  const tdNay = cb?.[cb.length - 1]
  const tdTruoc = cb?.[cb.length - 2]
  const info = data?.info

  return (
    <div className="mx-auto max-w-[1800px] px-4 py-5 sm:px-6">
      <header className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">
            BÁO CÁO TỒN KHO {khoi && `- KHỐI ${khoi}`} {cycledate && <span className="font-normal text-ink2">(tại {fmtNgay(cycledate)})</span>}
          </h1>
          <p className="text-xs text-ink2">
            Đơn vị: Triệu VNĐ. Chỉ tính hàng đang kinh doanh (không gồm TSCĐ/CCDC và hàng ngừng kinh doanh).
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <label className="flex items-center gap-1.5">
            <span className="text-ink2">Khối</span>
            <select
              className="rounded border border-line bg-surface px-2 py-1"
              value={khoi || ''}
              onChange={(e) => {
                setKhoi(e.target.value)
                nho('inv.khoi', e.target.value)
              }}
            >
              {khois.map((x) => <option key={x}>{x}</option>)}
            </select>
          </label>
          <label className="flex items-center gap-1.5">
            <span className="text-ink2">Snapshot</span>
            <select className="rounded border border-line bg-surface px-2 py-1" value={cycledate || ''} onChange={(e) => setCycledate(e.target.value)}>
              {snapshots.map((s) => <option key={s} value={s}>{fmtNgay(s)}</option>)}
            </select>
          </label>
          <button
            className="rounded bg-head-2 px-3 py-1 font-medium text-white hover:bg-head disabled:opacity-50"
            disabled={!view || exporting}
            onClick={async () => {
              setExporting(true)
              try {
                await xuatExcel({ ...view, periods: data.periods, cycledate, khoi })
              } finally {
                setExporting(false)
              }
            }}
          >
            {exporting ? 'Đang xuất…' : 'Xuất Excel'}
          </button>
        </div>
      </header>

      {err && <div className="mb-4 rounded border border-bad bg-surface px-3 py-2 text-sm text-bad">{err}</div>}

      {info && (Number(info.co_warnington) === 0 || data.periods.some((p) => p.nguon !== 'Đã chốt')) && (
        <div className="mb-4 space-y-1 rounded border border-line bg-surface px-3 py-2 text-xs text-ink2">
          {Number(info.co_warnington) === 0 && (
            <div>
              <b className="text-ink">Lưu ý:</b> snapshot {fmtNgay(cycledate)} chưa có cột <code>warnington</code> (cảnh báo thời gian tồn) —
              phân loại luân chuyển/CLC đang tính toàn bộ là "Dưới 06T" nên CLC = 0.
            </div>
          )}
          {data.periods
            .filter((p) => p.nguon !== 'Đã chốt')
            .map((p) => (
              <div key={p.ky}>
                Kỳ {fmtNgay(p.ky)}: {p.nguon.toLowerCase()}.
              </div>
            ))}
        </div>
      )}

      {loading && !view && <div className="py-20 text-center text-muted">Đang tải dữ liệu…</div>}

      {view && (
        <div className={`space-y-4 ${loading ? 'opacity-60' : ''}`}>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            <Kpi
              label="Tổng tồn kho - hàng đang KD"
              value={fmtTy(k.tong_kd)}
              unit="tỷ"
              sub={k.pct_ky_truoc != null && `${fmtPct(k.pct_ky_truoc, true)} so ${fmtNgay(data.periods.at(-1).ky)}`}
              tone={dauDelta(k.pct_ky_truoc)}
            />
            <Kpi label="Hàng đang sử dụng" value={fmtTy(k.dang_sd)} unit="tỷ" sub={k.tong_kd ? `${fmtPct(k.dang_sd / k.tong_kd)} tổng tồn` : null} />
            <Kpi
              label="Hết date + chờ hủy + lỗi/KT"
              value={fmtTy(k.xau)}
              unit="tỷ"
              sub={k.pct_xau_2t != null ? `${fmtPct(k.pct_xau_2t, true)} so ${fmtNgay(data.periods.at(-2).ky)}` : k.tong_kd ? `${fmtPct(k.xau / k.tong_kd)} tổng tồn` : null}
              tone={dauDelta(k.pct_xau_2t)}
            />
            <Kpi label="Chậm luân chuyển (CLC)" value={fmtTy(k.clc)} unit="tỷ" sub={k.tong_kd ? `${fmtPct(k.clc / k.tong_kd)} tổng tồn` : null} />
            <Kpi
              label="% tồn đọng / tổng tồn"
              value={tdNay?.ton_dong != null && tdNay.tong_kd ? fmtPct(tdNay.ton_dong / tdNay.tong_kd) : '–'}
              sub={
                tdTruoc?.ton_dong != null && tdTruoc.tong_kd
                  ? `kỳ trước ${fmtPct(tdTruoc.ton_dong / tdTruoc.tong_kd)}`
                  : null
              }
            />
            <Kpi
              label="Hệ số tồn kho TB"
              value={fmtHs(k.he_so) || '–'}
              unit="tháng"
              sub={info ? `${fmtSo(info.so_dong)} dòng snapshot` : null}
            />
          </div>

          <div>
            <div className="mb-2 flex flex-wrap gap-1 border-b border-line" role="tablist">
              {TABS.map((t) => (
                <button
                  key={t.key}
                  role="tab"
                  aria-selected={tab === t.key}
                  onClick={() => {
                    setTab(t.key)
                    nho('inv.tab', t.key)
                  }}
                  className={`-mb-px border-b-2 px-3 py-2 text-sm ${tab === t.key ? 'border-head-2 font-semibold text-ink' : 'border-transparent text-ink2 hover:text-ink'}`}
                >
                  {t.label}
                </button>
              ))}
            </div>
            {tab === 'kiem_tra' ? (
              <DataCheck cycledate={cycledate} khoi={khoi} />
            ) : tab === 'excel' ? (
              <ReportTable model={view.model} periods={data.periods} onDrill={onDrill} />
            ) : (
              <CompactTable model={view.model} periods={data.periods} tab={tab} onDrill={onDrill} />
            )}
            {tab !== 'kiem_tra' && (
              <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
                <span>Bấm vào ô số để xem chi tiết lô.</span>
                {tab === 'so_sanh' ? (
                  <span><span className="text-bad">▲</span> tồn tăng · <span className="text-good">▼</span> tồn giảm</span>
                ) : tab !== 'excel' ? (
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block h-3 w-3 rounded-sm bg-warn" /> vượt ngưỡng: hệ số tồn &gt; {NGUONG.he_so} tháng,
                    CLC &gt; {fmtPct(NGUONG.pct_clc)}, hàng xấu &gt; {fmtPct(NGUONG.pct_xau)} tổng tồn
                  </span>
                ) : null}
              </p>
            )}
          </div>

          {tab !== 'kiem_tra' && (
            <>
              <CanhBaoTonDong khoiTen={khoi} cot={view.canhBao} nhanKy={view.nhanKy} />
              <XuHuongBu khoiTen={khoi} model={view.model} periods={data.periods} nhanKy={view.nhanKy} />
            </>
          )}
        </div>
      )}

      {drill && <DetailDrawer drill={drill} cycledate={cycledate} khoi={khoi} onClose={closeDrill} />}
    </div>
  )
}

