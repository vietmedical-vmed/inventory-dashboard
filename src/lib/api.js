// Đăng nhập + gọi dữ liệu qua Edge Function, dùng chung tài khoản (shared.users) và token với portal.
//  - Đăng nhập: sale_target-login (giống portal) → token HMAC sống 2h.
//  - Token lưu ở localStorage['vmed_token']: vào từ portal thì đã có sẵn, không phải đăng nhập lại.
//  - Đọc dữ liệu: inventory-api { fn, args } → RPC trong schema app_inventory.

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_KEY

if (!url || !key) {
  throw new Error('Thiếu VITE_SUPABASE_URL / VITE_SUPABASE_KEY — copy .env.example thành .env')
}

// Dev đi qua proxy của Vite (vite.config.js) vì sale_target-login chỉ mở CORS cho GitHub Pages
const FN = import.meta.env.DEV ? '/fn' : `${url}/functions/v1`
const TOKEN_KEY = 'vmed_token'
const USER_KEY = 'vmed_user'
const LAM_MOI_TRUOC = 30 * 60 // giây: còn ít hơn thì xin token mới

const LOI = {
  invalid: 'Sai tài khoản hoặc mật khẩu',
  missing_credentials: 'Vui lòng nhập tài khoản và mật khẩu',
  weak_password: 'Mật khẩu mới phải từ 6 ký tự trở lên',
  same_password: 'Mật khẩu mới phải khác mật khẩu hiện tại',
  update_failed: 'Không cập nhật được mật khẩu, thử lại sau',
  token_expired: 'Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại',
}

const doc = (k) => {
  try {
    return localStorage.getItem(k)
  } catch {
    return null
  }
}

// Payload token: base64url(JSON UTF-8)
function giaiMa(token) {
  try {
    let p = String(token).split('.')[0].replace(/-/g, '+').replace(/_/g, '/')
    while (p.length % 4) p += '='
    return JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(p), (c) => c.charCodeAt(0))))
  } catch {
    return {}
  }
}

const bayGio = () => Math.floor(Date.now() / 1000)

function luuToken(token) {
  const c = giaiMa(token)
  const user = { username: c.username || '', ho_ten: c.ho_ten || '', role: c.role || '', mien: c.mien || '', bu: c.bu || '' }
  try {
    localStorage.setItem(TOKEN_KEY, token)
    localStorage.setItem(USER_KEY, JSON.stringify(user))
  } catch {
    /* chế độ riêng tư: vẫn chạy được trong phiên này */
  }
  return user
}

/** User của token còn hạn, hoặc null. */
export function layPhien() {
  const token = doc(TOKEN_KEY)
  if (!token) return null
  const c = giaiMa(token)
  if (!c.exp || c.exp <= bayGio()) return null
  return { username: c.username || '', ho_ten: c.ho_ten || c.username || '', role: c.role || '' }
}

let khiHetPhien = () => {}
export const onHetPhien = (cb) => {
  khiHetPhien = cb
}

export function dangXuat() {
  // Cùng các key portal xoá khi đăng xuất
  for (const k of [TOKEN_KEY, USER_KEY, 'ctch_auth_token', 'sp_tok']) {
    try {
      localStorage.removeItem(k)
    } catch {
      /* bỏ qua */
    }
  }
}

async function post(path, body, token) {
  const headers = { 'Content-Type': 'application/json', apikey: key }
  if (token) headers['x-portal-token'] = token
  let res
  try {
    res = await fetch(`${FN}/${path}`, { method: 'POST', headers, body: JSON.stringify(body) })
  } catch {
    throw Object.assign(new Error('Không kết nối được máy chủ'), { status: 0 })
  }
  const data = await res.json().catch(() => ({}))
  if (!res.ok || data.ok === false) {
    const msg = LOI[data.error] || data.message || data.error || `Lỗi ${res.status}`
    throw Object.assign(new Error(msg), { status: res.status, code: data.error })
  }
  return data
}

export async function dangNhap(username, password) {
  const r = await post('sale_target-login', { username, password })
  if (!r.token) throw new Error('Máy chủ không trả token')
  return luuToken(r.token)
}

export async function doiMatKhau(username, password, newPassword) {
  await post('sale_target-login', { username, password, newPassword })
}

// Gộp các lần gọi song song thành một lần xin token mới
let dangLamMoi = null
async function tokenHienTai() {
  const token = doc(TOKEN_KEY)
  const exp = giaiMa(token).exp || 0
  if (!token || exp <= bayGio()) return null
  if (exp - bayGio() > LAM_MOI_TRUOC) return token
  dangLamMoi ??= post('inventory-api', { fn: 'lam_moi' }, token)
    .then((r) => (luuToken(r.token), r.token))
    .catch(() => token)
    .finally(() => {
      dangLamMoi = null
    })
  return dangLamMoi
}

/** Gọi RPC đọc trong app_inventory qua inventory-api. */
export async function goi(fn, args) {
  const token = await tokenHienTai()
  if (!token) {
    khiHetPhien(LOI.token_expired)
    throw new Error(LOI.token_expired)
  }
  try {
    return (await post('inventory-api', { fn, args }, token)).data
  } catch (e) {
    // Token hỏng / tài khoản bị khoá thì đăng xuất; thiếu quyền một RPC (no_permission) thì không
    if (e.status === 401 || e.code === 'forbidden') {
      dangXuat()
      khiHetPhien(e.message)
    }
    throw e
  }
}
