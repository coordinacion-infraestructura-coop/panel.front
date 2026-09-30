import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const GATEWAY_PROD = 'https://ministerio-gateway-3j5k00ma.uc.gateway.dev'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  // Desarrollo local full-stack (varios microservicios corriendo a la vez,
  // sin API Gateway): se activa SÓLO si VITE_LOCAL_VIVIENDA_URL está seteada
  // en .env.development.local (gitignored) — sin eso, comportamiento
  // intacto: todo /api va al gateway real de prod, como siempre. En prod no
  // hay un solo backend detrás de /api/v1/* (cada secretaría es un
  // microservicio distinto, el Gateway rutea por prefijo) — acá se imita lo
  // mismo pero contra puertos locales.
  const proxy = env.VITE_LOCAL_VIVIENDA_URL
    ? {
        ...(env.VITE_LOCAL_GASIFERA_URL && {
          '/api/v1/gasifera': { target: env.VITE_LOCAL_GASIFERA_URL, changeOrigin: true },
        }),
        ...(env.VITE_LOCAL_GRALGOB_URL && {
          '/api/v1/gralgob': { target: env.VITE_LOCAL_GRALGOB_URL, changeOrigin: true },
        }),
        ...(env.VITE_LOCAL_PRIVADA_URL && {
          '/api/v1/privada': { target: env.VITE_LOCAL_PRIVADA_URL, changeOrigin: true },
        }),
        '/api': { target: env.VITE_LOCAL_VIVIENDA_URL, changeOrigin: true },
      }
    : { '/api': { target: GATEWAY_PROD, changeOrigin: true, secure: true } }

  return {
    plugins: [react(), tailwindcss()],
    server: { port: 5173, proxy },
  }
})
