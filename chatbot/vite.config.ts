import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
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
