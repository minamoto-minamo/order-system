import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import { config } from 'dotenv'

const frontendEnv = config({ path: path.resolve(__dirname, '../env/frontend.env') }).parsed ?? {}
const envDefine = Object.fromEntries(
  Object.entries(frontendEnv)
    .filter(([k]) => k.startsWith('VITE_'))
    .map(([k, v]) => [`import.meta.env.${k}`, JSON.stringify(v)])
)

export default defineConfig({
  define: envDefine,
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: true,
    allowedHosts: ['.localhost'],
    proxy: {
      '/api': { target: 'http://localhost:3000', changeOrigin: false },
      '/socket.io': { target: 'http://localhost:3000', ws: true, changeOrigin: false },
    },
  },
})
