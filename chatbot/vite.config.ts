import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    allowedHosts: true,
    historyApiFallback: true,
    proxy: {
      '/insforge': {
        target: 'http://localhost:7130',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/insforge/, ''),
      },
      '/functions': {
        target: 'http://localhost:7133',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/functions/, ''),
      },
    },
  },
})
