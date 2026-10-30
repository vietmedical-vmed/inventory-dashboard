import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base './' để deploy tĩnh (GitHub Pages) ở bất kỳ đường dẫn con nào
export default defineConfig({
  plugins: [react()],
  base: './',
  server: { port: 5180 },
})
