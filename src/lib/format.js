const nf0 = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 })
const nf1 = new Intl.NumberFormat('vi-VN', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
const nf2 = new Intl.NumberFormat('vi-VN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/** Triệu VNĐ, không lẻ. 0 hiển thị "-" như Excel kế toán. */
export const fmtTr = (v) => (v == null || Number.isNaN(v) ? '' : Math.abs(v) < 0.5 ? '-' : nf0.format(v))
export const fmtPct = (v, sign = false) =>
  v == null || !Number.isFinite(v) ? '' : `${sign && v > 0 ? '+' : ''}${nf1.format(v * 100)}%`
export const fmtHs = (v) => (v == null || !Number.isFinite(v) ? '' : nf2.format(v))
export const fmtSo = (v) => (v == null ? '' : nf0.format(v))
export const fmtVnd = (v) => (v == null ? '' : nf0.format(v))
/** Tỷ VNĐ cho thẻ KPI */
export const fmtTy = (v) => (v == null ? '–' : nf1.format(v / 1000))
