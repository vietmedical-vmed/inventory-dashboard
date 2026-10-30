import { COT_CLC, COT_HSD, fmtNgay } from './report'

function taiFile(blob, ten) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = ten
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}

export function taiCsv(rows, ten) {
  if (!rows.length) return
  const cols = Object.keys(rows[0])
  const esc = (v) => (v == null ? '' : /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v))
  const csv = [cols.join(','), ...rows.map((r) => cols.map((c) => esc(r[c])).join(','))].join('\n')
  taiFile(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }), ten)
}

const XANH = 'FF2E5395'
const XANH2 = 'FF4472C4'
const NEN = 'FFEEF2F9'

/** Xuất bảng báo cáo chính theo bố cục sheet Excel gốc (giá trị, không công thức). */
export async function xuatExcel({ model, periods, cycledate, khoi, canhBao, nhanKy }) {
  const ExcelJS = (await import('exceljs')).default
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('Bao_cao', { views: [{ state: 'frozen', xSplit: 2, ySplit: 5 }] })
  const truoc = periods[periods.length - 1]
  const nCol = 18

  ws.mergeCells(1, 1, 1, 17)
  ws.getCell(1, 1).value = `BÁO CÁO TỒN KHO - KHỐI ${khoi} (tại ${fmtNgay(cycledate)})`
  ws.getCell(1, 1).font = { bold: true, size: 14 }
  ws.mergeCells(2, 1, 2, 17)
  ws.getCell(2, 1).value =
    'Đơn vị: Triệu VNĐ. CHỈ TÍNH HÀNG ĐANG KINH DOANH (không bao gồm TSCĐ/CCDC và hàng ngừng kinh doanh).'
  ws.getCell(2, 1).font = { italic: true, color: { argb: 'FF595959' } }

  const h1 = [
    'Ngành hàng', 'Nhóm SP', 'Phân loại hàng theo HSD (Triệu VNĐ)', '', '', 'Tổng GT Hàng đang sử dụng (Triệu)',
    'Hàng hết date, hỏng (Triệu)', 'Hàng đã duyệt chờ hủy (Triệu)', 'Hàng lỗi/KT (Triệu)', 'Tổng tồn kho - Hàng đang KD (Triệu VNĐ)',
    'Phân loại theo mức độ luân chuyển (Triệu VNĐ)', '', '', 'Tổng giá trị CLC (Triệu VNĐ)', 'GV bán trung bình tháng gần nhất (Triệu VNĐ)',
    'Hệ số tồn kho TB', `Giá trị kỳ trước (${fmtNgay(truoc.ky)}, Triệu VNĐ)`, '% Tăng/giảm so kỳ trước',
  ]
  const h2 = ['', '', ...COT_HSD.map((c) => c.label), '', '', '', '', '', ...COT_CLC.map((c) => c.label), '', '', '', '', '']
  ws.getRow(4).values = h1
  ws.getRow(5).values = h2
  for (const c of [1, 2, 6, 7, 8, 9, 10, 14, 15, 16, 17, 18]) ws.mergeCells(4, c, 5, c)
  ws.mergeCells(4, 3, 4, 5)
  ws.mergeCells(4, 11, 4, 13)
  for (const r of [4, 5]) {
    ws.getRow(r).eachCell({ includeEmpty: true }, (cell, c) => {
      if (c > nCol) return
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: r === 4 ? XANH : XANH2 } }
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }
      cell.alignment = { wrapText: true, vertical: 'middle', horizontal: 'center' }
    })
  }
  ws.getRow(4).height = 48

  const giaTri = (r) => [
    r.hsd_tren_12t, r.hsd_6_12t, r.hsd_duoi_6t, r.dang_sd, r.het_han, r.cho_huy, r.loi_kt, r.tong_kd,
    r.clc_tren_24t, r.clc_tren_12t, r.clc_tren_06t, r.clc, r.gv_ban_tb ?? null, r.he_so ?? null,
    r.ky_truoc ?? null, r.pct_ky_truoc ?? null,
  ]
  const dinhDang = (row, kieu) => {
    row.eachCell({ includeEmpty: true }, (cell, c) => {
      if (c > nCol) return
      cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } }
      if (c >= 3) cell.numFmt = kieu === 'pct' ? '0.0%' : c === 16 ? '0.00' : c === 18 ? '+0.0%;-0.0%' : '#,##0'
      if (kieu === 'tong') {
        cell.font = { bold: true }
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NEN } }
      }
    })
  }

  let r = 6
  for (const g of model.bus) {
    const dau = r
    for (const n of g.nhom) {
      const row = ws.getRow(r++)
      row.values = [r - 1 === dau ? g.ten : '', n.ten, ...giaTri(n)]
      dinhDang(row)
    }
    if (g.nhom.length > 1) ws.mergeCells(dau, 1, r - 1, 1)
    ws.getCell(dau, 1).alignment = { vertical: 'middle', horizontal: 'center' }
    ws.getCell(dau, 1).font = { bold: true }
    let row = ws.getRow(r++)
    row.values = ['', 'Tổng', ...giaTri(g.tong)]
    dinhDang(row, 'tong')
    row = ws.getRow(r++)
    const t = g.tong
    row.values = ['', 'Tỷ trọng/tổng giá trị tồn kho', ...giaTri(t).slice(0, 12).map((v) => (t.tong_kd ? v / t.tong_kd : null))]
    dinhDang(row, 'pct')
  }
  let row = ws.getRow(r++)
  row.values = [`KHỐI ${khoi}`, '', ...giaTri(model.khoi)]
  dinhDang(row, 'tong')
  row = ws.getRow(r++)
  row.values = ['TỶ TRỌNG/TỔNG GIÁ TRỊ TỒN KHO', '', ...giaTri(model.khoi).slice(0, 12).map((v) => (model.khoi.tong_kd ? v / model.khoi.tong_kd : null))]
  dinhDang(row, 'pct')

  // Cảnh báo tồn đọng
  r += 2
  ws.getCell(r++, 1).value = `CẢNH BÁO TỒN ĐỌNG - KHỐI ${khoi} (xu hướng 4 kỳ, Triệu VNĐ)`
  ws.getCell(r - 1, 1).font = { bold: true }
  ws.getRow(r++).values = ['Chỉ tiêu', ...nhanKy]
  const cb = [
    ['tong_kd', 'Tổng tồn kho (hàng đang KD)'], ['het_han', 'Hàng hết date, hỏng'], ['cho_huy', 'Hàng đã duyệt chờ hủy'],
    ['loi_kt', 'Hàng lỗi/KT'], ['clc', 'Tổng giá trị CLC (chậm luân chuyển)'], ['ton_dong', 'Tổng tồn đọng (HH + Chờ hủy + Lỗi/KT + CLC)'],
  ]
  for (const [k, label] of cb) {
    const x = ws.getRow(r++)
    x.values = [label, ...canhBao.map((c) => c[k] ?? null)]
    x.eachCell((cell, c) => c > 1 && (cell.numFmt = '#,##0'))
    if (k !== 'tong_kd') {
      const y = ws.getRow(r++)
      y.values = ['  % / Tổng tồn kho', ...canhBao.map((c) => (c[k] != null && c.tong_kd ? c[k] / c.tong_kd : null))]
      y.eachCell((cell, c) => c > 1 && (cell.numFmt = '0.0%'))
    }
  }

  ws.getColumn(1).width = 14
  ws.getColumn(2).width = 32
  for (let c = 3; c <= nCol; c++) ws.getColumn(c).width = 14

  const buf = await wb.xlsx.writeBuffer()
  const [y, m, d] = cycledate.split('-')
  taiFile(
    new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    `BaoCao_TonKho_${khoi.replace(/\s+/g, '')}_${d}_${m}_${y}.xlsx`,
  )
}
