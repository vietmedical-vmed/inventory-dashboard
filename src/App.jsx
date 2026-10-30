import { useCallback, useEffect, useMemo, useState } from 'react'
import ReportTable from './components/ReportTable'
import CompactTable, { NGUONG } from './components/CompactTable'
import DetailDrawer from './components/DetailDrawer'
import DataCheck from './components/DataCheck'
import { CanhBaoTonDong, XuHuongBu, nhanCacKy } from './components/TrendSections'
import { AlertTriangle, Download, FilterSelect, LoadingBlock, Panel, RefreshCw, RefreshingBar, Tabs } from './components/ui'
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

const TABS = [
  { key: 'excel', label: 'Tổng quan', sub: 'Tồn kho hàng đang kinh doanh theo BU / nhóm SP, bố cục như file báo cáo Excel' },
  { key: 'hsd', label: 'Chất lượng HSD', sub: 'Phân loại theo hạn sử dụng và hàng hết date / chờ hủy / lỗi' },
  { key: 'clc', label: 'Luân chuyển (CLC)', sub: 'Phân loại theo thời gian tồn (warnington) và hệ số tồn kho' },
  { key: 'so_sanh', label: 'So sánh kỳ trước', sub: 'Tổng tồn kho hàng đang KD qua các kỳ' },
  { key: 'kiem_tra', label: 'Kiểm tra dữ liệu', sub: 'Độ đầy đủ của snapshot, master, GV bán và chốt kỳ' },
]

// Thành phần tổng tồn: đang SD + hết date + chờ hủy + lỗi KT
const PHAN = [
  { key: 'dang_sd', label: 'Đang sử dụng', color: 'var(--s1)' },
  { key: 'het_han', label: 'Hết date, hỏng', color: 'var(--st-critical)' },
  { key: 'cho_huy', label: 'Chờ hủy', color: 'var(--st-serious)' },
  { key: 'loi_kt', label: 'Lỗi / KT', color: 'var(--st-warning)' },
]

function DeltaText({ v, so }) {
  if (v == null || !Number.isFinite(v)) return null
  return (
    <span className={v > 0 ? 'text-red-600' : 'text-emerald-700'}>
      {v > 0 ? '▲' : '▼'} {fmtPct(Math.abs(v))} <span className="text-slate-400">so {so}</span>
    </span>
  )
}

function TongCard({ k, periods }) {
  const tong = k.tong_kd || 0
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3.5">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-3 text-[11px] tracking-wide text-slate-400">
        <span>Tổng tồn kho - hàng đang kinh doanh</span>
        <span className="text-[12px]">
          <DeltaText v={k.pct_ky_truoc} so={fmtNgay(periods.at(-1).ky)} />
        </span>
      </div>
      <div className="mb-1.5 flex items-baseline justify-between">
        <span className="text-[13px] font-semibold text-slate-800">Giá trị tồn</span>
        <span className="num text-[22px] font-bold text-blue-600">
          {fmtTy(tong)} <span className="text-[13px] font-semibold text-slate-400">tỷ</span>
        </span>
      </div>
      <div className="mb-1.5 flex h-3.5 gap-px overflow-hidden rounded bg-slate-100">
        {tong > 0 &&
          PHAN.map((p) =>
            k[p.key] > 0 ? (
              <div
                key={p.key}
                style={{ flexGrow: k[p.key], flexBasis: 0, background: p.color }}
                title={`${p.label}: ${fmtTy(k[p.key])} tỷ (${fmtPct(k[p.key] / tong)})`}
              />
            ) : null,
          )}
      </div>
      <div className="flex flex-wrap gap-3 text-[11px] text-slate-500">
        {PHAN.map((p) => (
          <span key={p.key} className="flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: p.color }} aria-hidden />
            {p.label} <span className="num text-slate-400">{tong ? fmtPct(k[p.key] / tong) : ''}</span>
          </span>
        ))}
      </div>
    </div>
  )
}

function StatCard({ label, swatch, value, unit, sub, warn }) {
  return (
    <div className={`rounded-xl border bg-white p-3.5 ${warn ? 'border-red-200' : 'border-slate-200'}`}>
      <div className="mb-2 flex items-center gap-1.5 text-[11px] tracking-wide text-slate-400">
        {swatch && <span className="h-2 w-2 rounded-sm" style={{ background: swatch }} aria-hidden />}
        {label}
      </div>
      <div className={`num text-[20px] font-bold ${warn ? 'text-red-600' : 'text-slate-800'}`}>
        {value} {unit && <span className="text-[12px] font-semibold text-slate-400">{unit}</span>}
      </div>
      {sub && <div className="mt-0.5 text-[11px] text-slate-400">{sub}</div>}
    </div>
  )
}

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
  const [nonce, setNonce] = useState(0)
  const [tab, setTab] = useState(() => {
    const t = nho('inv.tab')
    return TABS.some((x) => x.key === t) ? t : TABS[0].key
  })

  useEffect(() => {
    Promise.all([layDanhSachSnapshot(), layDanhSachKhoi()])
      .then(([s, k]) => {
        setSnapshots(s)
        setKhois(k)
        setKhoi((cur) => (k.includes(cur) ? cur : k.includes(nho('inv.khoi')) ? nho('inv.khoi') : k[0] || null))
        setCycledate((cur) => (s.includes(cur) ? cur : s[0] || null))
      })
      .catch((e) => setErr(e.message))
  }, [nonce])

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
  const tabInfo = TABS.find((t) => t.key === tab)
  const ghiChu = data
    ? [
        ...(info && Number(info.co_warnington) === 0
          ? [`Snapshot ${fmtNgay(cycledate)} chưa có warnington — luân chuyển tính toàn bộ là "dưới 6T", CLC = 0.`]
          : []),
        ...data.periods.filter((p) => p.nguon !== 'Đã chốt').map((p) => `Kỳ ${fmtNgay(p.ky)}: ${p.nguon.toLowerCase()}.`),
      ]
    : []

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-3">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-blue-500 text-sm font-bold text-white">TK</div>
            <div className="leading-tight">
              <div className="text-base font-bold text-slate-900 md:text-lg">BÁO CÁO TỒN KHO</div>
              <div className="mt-0.5 text-xs text-slate-500">
                {khoi ? `Khối ${khoi}` : '…'}
                {cycledate && ` · tại ${fmtNgay(cycledate)}`} · Đơn vị: triệu VNĐ, chỉ hàng đang kinh doanh
              </div>
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className="text-right text-[9px] italic text-slate-400">
              Designed and developed by <span className="font-semibold not-italic text-slate-500">Do Hoang Giang</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setNonce((n) => n + 1)}
                className="flex items-center gap-1.5 rounded-md bg-blue-600 px-4 py-1.5 text-[13px] font-semibold text-white hover:bg-blue-700"
              >
                <RefreshCw size={14} />
                Reload
              </button>
              <button
                type="button"
                disabled={!view || exporting}
                onClick={async () => {
                  setExporting(true)
                  try {
                    await xuatExcel({ ...view, periods: data.periods, cycledate, khoi })
                  } finally {
                    setExporting(false)
                  }
                }}
                className="flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-4 py-1.5 text-[13px] font-semibold text-slate-700 hover:border-slate-300 hover:bg-slate-50 disabled:opacity-50"
              >
                <Download size={14} />
                {exporting ? 'Đang xuất…' : 'Xuất Excel'}
              </button>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 border-t border-slate-100 px-6 py-2">
          <span className="pl-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Lọc</span>
          <FilterSelect
            label="Khối"
            value={khoi}
            options={khois.map((x) => ({ value: x, label: x }))}
            onChange={(v) => {
              setKhoi(v)
              nho('inv.khoi', v)
            }}
          />
          <FilterSelect
            label="Snapshot"
            value={cycledate}
            options={snapshots.map((s, i) => ({ value: s, label: fmtNgay(s), hint: i === 0 ? 'mới nhất' : null }))}
            onChange={setCycledate}
          />
        </div>

        <Tabs
          tabs={TABS}
          value={tab}
          onChange={(t) => {
            setTab(t)
            nho('inv.tab', t)
          }}
        />
      </header>

      <main className="space-y-4 px-6 py-4">
        {err && <LoadingBlock error={err} />}
        {!view && !err && <LoadingBlock />}
        {view && loading && <RefreshingBar />}

        {view && ghiChu.length > 0 && (
          <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-800">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" />
            <div className="space-y-0.5">{ghiChu.map((g) => <div key={g}>{g}</div>)}</div>
          </div>
        )}

        {view && (
          <>
            <div className="grid gap-3 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,3fr)]">
              <TongCard k={k} periods={data.periods} />
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <StatCard
                  label="Hàng xấu (hết date + hủy + lỗi)"
                  swatch="var(--st-critical)"
                  value={fmtTy(k.xau)}
                  unit="tỷ"
                  sub={k.tong_kd ? `${fmtPct(k.xau / k.tong_kd)} tổng tồn` : null}
                  warn={k.tong_kd && k.xau / k.tong_kd > NGUONG.pct_xau}
                />
                <StatCard
                  label="Chậm luân chuyển (CLC)"
                  swatch="var(--st-clc)"
                  value={fmtTy(k.clc)}
                  unit="tỷ"
                  sub={k.tong_kd ? `${fmtPct(k.clc / k.tong_kd)} tổng tồn` : null}
                  warn={k.tong_kd && k.clc / k.tong_kd > NGUONG.pct_clc}
                />
                <StatCard
                  label="% tồn đọng / tổng tồn"
                  swatch="var(--st-warning)"
                  value={tdNay?.ton_dong != null && tdNay.tong_kd ? fmtPct(tdNay.ton_dong / tdNay.tong_kd) : '–'}
                  sub={tdTruoc?.ton_dong != null && tdTruoc.tong_kd ? `kỳ trước ${fmtPct(tdTruoc.ton_dong / tdTruoc.tong_kd)}` : 'HH + chờ hủy + lỗi + CLC'}
                />
                <StatCard
                  label="Hệ số tồn kho TB"
                  swatch="var(--s1)"
                  value={fmtHs(k.he_so) || '–'}
                  unit="tháng"
                  sub={info ? `${fmtSo(info.so_dong)} dòng snapshot` : null}
                  warn={k.he_so > NGUONG.he_so}
                />
              </div>
            </div>

            {tab === 'kiem_tra' ? (
              <DataCheck cycledate={cycledate} khoi={khoi} />
            ) : (
              <Panel
                title={tabInfo.label}
                subtitle={tabInfo.sub}
                right={
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-400">
                    <span>Bấm ô số để xem chi tiết lô</span>
                    {tab === 'so_sanh' ? (
                      <span>
                        <span className="text-red-600">▲</span> tồn tăng · <span className="text-emerald-700">▼</span> tồn giảm
                      </span>
                    ) : tab !== 'excel' ? (
                      <span className="flex items-center gap-1.5">
                        <span className="inline-block h-2.5 w-2.5 rounded-sm border border-red-200 bg-red-50" />
                        hệ số &gt; {NGUONG.he_so} tháng · CLC &gt; {fmtPct(NGUONG.pct_clc)} · hàng xấu &gt; {fmtPct(NGUONG.pct_xau)}
                      </span>
                    ) : null}
                  </div>
                }
              >
                {tab === 'excel' ? (
                  <div className="p-3">
                    <ReportTable model={view.model} periods={data.periods} onDrill={onDrill} />
                  </div>
                ) : (
                  <CompactTable model={view.model} periods={data.periods} tab={tab} onDrill={onDrill} />
                )}
              </Panel>
            )}

            {tab !== 'kiem_tra' && (
              <div className="grid gap-4 xl:grid-cols-2">
                <CanhBaoTonDong khoiTen={khoi} cot={view.canhBao} nhanKy={view.nhanKy} />
                <XuHuongBu khoiTen={khoi} model={view.model} periods={data.periods} nhanKy={view.nhanKy} />
              </div>
            )}
          </>
        )}
      </main>

      {drill && <DetailDrawer drill={drill} cycledate={cycledate} khoi={khoi} onClose={closeDrill} />}
    </div>
  )
}
