import { useState } from 'react'
import { AlertCircle } from './ui'
import { dangNhap, doiMatKhau } from '../lib/api'

// Màn đăng nhập giống các app khác của công ty (sale-target, order): dùng chung tài khoản portal.
const INPUT =
  'w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100'

export default function Login({ thongBao, onDangNhap }) {
  const [mode, setMode] = useState('login')
  const [username, setUsername] = useState('')
  const [pw, setPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [error, setError] = useState(thongBao || '')
  const [info, setInfo] = useState('')
  const [busy, setBusy] = useState(false)
  const isChange = mode === 'change'

  const switchMode = (m) => {
    setMode(m)
    setError('')
    setInfo('')
    setNewPw('')
    setConfirmPw('')
  }

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setInfo('')
    const u = username.trim()
    if (isChange) {
      if (!u || !pw || !newPw || !confirmPw) return setError('Vui lòng nhập đầy đủ thông tin')
      if (newPw.length < 6) return setError('Mật khẩu mới phải từ 6 ký tự trở lên')
      if (newPw !== confirmPw) return setError('Xác nhận mật khẩu không khớp')
      if (newPw === pw) return setError('Mật khẩu mới phải khác mật khẩu hiện tại')
    } else if (!u || !pw) {
      return setError('Vui lòng nhập tài khoản và mật khẩu')
    }
    setBusy(true)
    try {
      if (isChange) {
        await doiMatKhau(u, pw, newPw)
        setPw('')
        setNewPw('')
        setConfirmPw('')
        setMode('login')
        setInfo('Đổi mật khẩu thành công. Đăng nhập lại bằng mật khẩu mới.')
      } else {
        onDangNhap(await dangNhap(u, pw))
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 p-4">
      <form
        onSubmit={submit}
        className="w-full max-w-[360px] rounded-lg border border-slate-200 bg-white p-6 shadow-[0_2px_4px_rgba(0,0,0,0.1),0_8px_16px_rgba(0,0,0,0.1)]"
      >
        <div className="mx-auto mb-5 grid h-12 w-12 place-items-center rounded-full bg-blue-500 text-base font-bold text-white">
          TK
        </div>
        <h1 className="mb-5 text-center text-lg font-bold uppercase text-slate-900">
          {isChange ? 'Đổi mật khẩu' : 'Báo cáo tồn kho'}
        </h1>

        <div className="space-y-2.5">
          <input
            autoFocus
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Tài khoản"
            className={INPUT}
          />
          <input
            type="password"
            autoComplete="current-password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            placeholder={isChange ? 'Mật khẩu hiện tại' : 'Mật khẩu'}
            className={INPUT}
          />
          {isChange && (
            <>
              <input
                type="password"
                autoComplete="new-password"
                value={newPw}
                onChange={(e) => setNewPw(e.target.value)}
                placeholder="Mật khẩu mới (tối thiểu 6 ký tự)"
                className={INPUT}
              />
              <input
                type="password"
                autoComplete="new-password"
                value={confirmPw}
                onChange={(e) => setConfirmPw(e.target.value)}
                placeholder="Xác nhận mật khẩu mới"
                className={INPUT}
              />
            </>
          )}
        </div>

        {info && <div className="mt-3 text-xs text-emerald-700">{info}</div>}
        {error && (
          <div className="mt-3 flex items-center gap-1.5 text-xs text-red-500" role="alert">
            <AlertCircle size={12} className="shrink-0" /> {error}
          </div>
        )}

        <button
          disabled={busy}
          className="mt-4 w-full rounded-md bg-blue-500 px-3 py-2 text-[15px] font-bold text-white hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {busy ? (isChange ? 'Đang đổi…' : 'Đang xác thực…') : isChange ? 'Đổi mật khẩu' : 'Đăng nhập'}
        </button>
        <div className="mt-3.5 text-center">
          <button
            type="button"
            onClick={() => switchMode(isChange ? 'login' : 'change')}
            className="text-[13px] text-blue-500 hover:underline"
          >
            {isChange ? 'Quay lại đăng nhập' : 'Đổi mật khẩu'}
          </button>
        </div>
      </form>
      <div className="mt-6 text-center text-[11px] text-slate-400">Designed and developed by Do Hoang Giang</div>
    </div>
  )
}
