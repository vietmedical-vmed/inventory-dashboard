import { db } from './supabase'

// Chỉ tiêu lưu trong ton_kho_ky
export const CHI_TIEU = ['tong_kd', 'dang_sd', 'het_han', 'cho_huy', 'loi_kt', 'clc', 'xau']

// Cột số của bảng báo cáo (theo thứ tự hiển thị trong file Excel)
export const COT_HSD = [
  { key: 'hsd_tren_12t', label: 'Trên 12T/Ko HSD' },
  { key: 'hsd_6_12t', label: '6-12 Tháng' },
  { key: 'hsd_duoi_6t', label: 'Dưới 06 Tháng' },
]
export const COT_XAU = [
  { key: 'het_han', label: 'Hàng hết date, hỏng' },
  { key: 'cho_huy', label: 'Hàng đã duyệt chờ hủy' },
  { key: 'loi_kt', label: 'Hàng lỗi/KT' },
]
export const COT_CLC = [
  { key: 'clc_tren_24t', label: 'Tồn kho trên 24T' },
  { key: 'clc_tren_12t', label: 'Tồn kho trên 12T' },
  { key: 'clc_tren_06t', label: 'Tồn kho trên 06T' },
]
const COT_GOC = [...COT_HSD, ...COT_XAU, ...COT_CLC].map((c) => c.key)

async function rpc(name, args) {
  const { data, error } = await db.rpc(name, args)
  if (error) throw new Error(`${name}: ${error.message}`)
  return data
}

export const iso = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
export const parseIso = (s) => {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}
export const fmtNgay = (s) => {
  const [y, m, d] = s.split('-')
  return `${d}/${m}/${y}`
}

/** 3 ngày cuối tháng trước tháng của snapshot, cũ -> mới. vd 2026-10-01 -> 31/07, 31/08, 30/09 */
export function kyTruoc(cycledate, n = 3) {
  const d = parseIso(cycledate)
  const out = []
  for (let i = n; i >= 1; i--) out.push(iso(new Date(d.getFullYear(), d.getMonth() - i + 1, 0)))
  return out
}

/** Tính các chỉ tiêu dẫn xuất cho 1 dòng (nhóm SP hoặc tổng). */
export function dongTinh(r) {
  const dang_sd = r.hsd_tren_12t + r.hsd_6_12t + r.hsd_duoi_6t
  const xau = r.het_han + r.cho_huy + r.loi_kt
  const clc = r.clc_tren_24t + r.clc_tren_12t + r.clc_tren_06t
  return { ...r, dang_sd, xau, tong_kd: dang_sd + xau, clc }
}

export function cong(rows) {
  const t = Object.fromEntries(COT_GOC.map((k) => [k, 0]))
  let gv = null
  for (const r of rows) {
    for (const k of COT_GOC) t[k] += Number(r[k]) || 0
    if (r.gv_ban_tb != null) gv = (gv || 0) + Number(r.gv_ban_tb)
  }
  return dongTinh({ ...t, gv_ban_tb: gv })
}

/** Bảng giá trị 1 kỳ: key "bu|nhom|chi_tieu" -> giá trị, có fallback cộng dồn. */
function bangKy(entries) {
  const m = new Map(entries.map((e) => [`${e.bu}|${e.nhom_sp}|${e.chi_tieu}`, Number(e.gia_tri)]))
  const sum = (pred) => {
    let s = null
    for (const [k, v] of m) if (pred(k.split('|'))) s = (s || 0) + v
    return s
  }
  return {
    size: m.size,
    get(bu, nhom, ct) {
      const k = `${bu}|${nhom}|${ct}`
      // mức BU: ưu tiên cộng từ nhóm SP để khớp tổng khối và biểu đồ
      // (file Excel cũ có cột "kỳ trước" mức BU lệch với tổng các nhóm)
      if (bu && !nhom) return sum(([b, n, c]) => b === bu && n && c === ct) ?? m.get(k) ?? null
      if (m.has(k)) return m.get(k)
      if (!bu && !nhom) {
        const lvBu = sum(([b, n, c]) => b && !n && c === ct)
        return lvBu ?? sum(([b, n, c]) => b && n && c === ct)
      }
      return null
    },
  }
}

function tuBaoCao(rows) {
  const out = []
  for (const raw of rows) {
    const r = dongTinh(raw)
    for (const ct of CHI_TIEU) out.push({ bu: r.bu, nhom_sp: r.nhom_sp, chi_tieu: ct, gia_tri: r[ct] })
  }
  return out
}

const num = (rows) =>
  rows.map((r) => {
    const o = { ...r }
    for (const k of [...COT_GOC, 'gv_ban_tb']) if (o[k] != null) o[k] = Number(o[k])
    return o
  })

export const layDanhSachSnapshot = async () => (await rpc('ds_snapshot')).map((r) => r.cycledate)
export const layDanhSachKhoi = async () => (await rpc('ds_khoi')).map((r) => r.khoi)
export const layChiTiet = (args) => rpc('chi_tiet', args)
export const layKiemTra = (cycledate, khoi) => rpc('kiem_tra', { p_cycledate: cycledate, p_khoi: khoi })

/**
 * Tải toàn bộ số liệu cho 1 báo cáo:
 *  - hiện tại: bao_cao(snapshot)
 *  - 3 kỳ trước: ton_kho_ky đã chốt; kỳ nào chưa chốt thì tính từ snapshot gần nhất
 *    <= cuối tháng (trong 15 ngày), ghi rõ nguồn.
 */
export async function taiBaoCao(cycledate, khoi, snapshots) {
  const ky = kyTruoc(cycledate)
  const [rows, info, daChot, ten] = await Promise.all([
    rpc('bao_cao', { p_cycledate: cycledate, p_khoi: khoi }),
    rpc('thong_tin_snapshot', { p_cycledate: cycledate, p_khoi: khoi }),
    rpc('ds_ton_kho_ky', { p_khoi: khoi, p_tu: ky[0], p_den: ky[ky.length - 1] }),
    rpc('ds_ten_hien_thi'),
  ])
  const periods = await Promise.all(
    ky.map(async (k) => {
      const stored = daChot.filter((r) => r.ky === k)
      if (stored.length) return { ky: k, nguon: 'Đã chốt', bang: bangKy(stored) }
      const han = iso(new Date(parseIso(k).getTime() - 15 * 86400000))
      const snap = snapshots.find((s) => s <= k && s >= han)
      if (!snap) return { ky: k, nguon: 'Chưa có số liệu', bang: bangKy([]) }
      const r = await rpc('bao_cao', { p_cycledate: snap, p_khoi: khoi })
      return { ky: k, nguon: `Ước tính từ snapshot ${fmtNgay(snap)}`, bang: bangKy(tuBaoCao(r)) }
    }),
  )
  return { rows: num(rows), info: info?.[0] || null, periods, ten: tenHienThi(ten) }
}

/** Tên BU / nhóm SP theo danh mục dùng chung; không có trong danh mục thì giữ tên Excel. */
function tenHienThi(rows) {
  const m = new Map(rows.map((r) => [`${r.bu}|${r.nhom_sp}`, r.ten]))
  return {
    bu: (bu) => m.get(`${bu}|`) || bu,
    nhom: (bu, nhom) => m.get(`${bu}|${nhom}`) || nhom,
  }
}

/** Snapshot mới nhất của mỗi tháng (danh sách snapshot đã sắp giảm dần). */
export function snapshotTheoThang(snapshots) {
  const out = []
  for (const s of snapshots) if (!out.some((x) => x.thang === s.slice(0, 7))) out.push({ thang: s.slice(0, 7), cycledate: s })
  return out
}

export const pct = (a, b) => (a == null || b == null || b === 0 ? null : (a - b) / b)
