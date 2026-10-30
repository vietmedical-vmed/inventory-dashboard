import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// base './' để deploy tĩnh (GitHub Pages) ở bất kỳ đường dẫn con nào
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  return {
    plugins: [react()],
    base: './',
    server: {
      port: 5180,
      // Edge Function đăng nhập chỉ mở CORS cho GitHub Pages: dev gọi cùng origin qua proxy
      proxy: {
        '/fn': {
          target: env.VITE_SUPABASE_URL,
          changeOrigin: true,
          rewrite: (p) => p.replace(/^\/fn/, '/functions/v1'),
          headers: { origin: 'https://vietmedical-vmed.github.io' },
        },
      },
    },
  }
})
