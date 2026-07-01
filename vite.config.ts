import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'https://ministerio-gateway-3j5k00ma.uc.gateway.dev',
        changeOrigin: true,
        secure: true,
      },
    },
  },
})
