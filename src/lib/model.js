import { cong, dongTinh, pct } from './report'

/**
 * Dựng mô hình báo cáo giống sheet Excel:
 *   khối -> các BU (theo thứ tự cấu hình) -> các nhóm SP + dòng Tổng
 * Mỗi dòng có số kỳ này + so sánh các kỳ trước (periods: cũ -> mới).
 */
export function dungMoHinh(rows, periods) {
  const pTruoc = periods[periods.length - 1] // kỳ trước liền kề
  const p2 = periods[periods.length - 2] // 2 tháng trước

  const soSanh = (bu, nhom, cur) => {
    const truoc = pTruoc?.bang.get(bu, nhom, 'tong_kd') ?? null
    const ds2 = p2?.bang.get(bu, nhom, 'dang_sd') ?? null
    const xau2 = p2?.bang.get(bu, nhom, 'xau') ?? null
    return {
      ky_truoc: truoc,
      pct_ky_truoc: pct(cur.tong_kd, truoc),
      pct_dang_sd_2t: pct(cur.dang_sd, ds2),
      pct_xau_2t: pct(cur.xau, xau2),
      lich_su: periods.map((p) => p.bang.get(bu, nhom, 'tong_kd')),
      he_so: cur.gv_ban_tb ? cur.dang_sd / cur.gv_ban_tb : null,
    }
  }

  const theoBu = new Map()
  for (const r of rows) {
    if (!theoBu.has(r.bu)) theoBu.set(r.bu, [])
    theoBu.get(r.bu).push(r)
  }
  const bus = [...theoBu.entries()]
    .map(([bu, list]) => {
      list.sort((a, b) => a.thu_tu - b.thu_tu || a.nhom_sp.localeCompare(b.nhom_sp, 'vi'))
      const nhom = list.map((r) => {
        const d = dongTinh(r)
        return { ...d, ...soSanh(bu, r.nhom_sp, d) }
      })
      const tong = cong(list)
      return {
        bu,
        thu_tu: Math.min(...list.map((r) => r.thu_tu)),
        nhom,
        tong: { ...tong, ...soSanh(bu, '', tong) },
      }
    })
    .sort((a, b) => a.thu_tu - b.thu_tu || a.bu.localeCompare(b.bu))

  const khoiTong = cong(rows)
  const khoi = { ...khoiTong, ...soSanh('', '', khoiTong) }
  return { bus, khoi }
}

/** Bảng cảnh báo tồn đọng mức khối: 3 kỳ trước + kỳ này. */
export function canhBaoTonDong(khoi, periods) {
  const cot = periods.map((p) => {
    const g = (ct) => p.bang.get('', '', ct)
    return { tong_kd: g('tong_kd'), het_han: g('het_han'), cho_huy: g('cho_huy'), loi_kt: g('loi_kt'), clc: g('clc') }
  })
  cot.push({ tong_kd: khoi.tong_kd, het_han: khoi.het_han, cho_huy: khoi.cho_huy, loi_kt: khoi.loi_kt, clc: khoi.clc })
  return cot.map((c) => {
    const parts = [c.het_han, c.cho_huy, c.loi_kt, c.clc]
    const ton_dong = parts.some((v) => v == null) ? null : parts.reduce((a, b) => a + b, 0)
    return { ...c, ton_dong }
  })
}
