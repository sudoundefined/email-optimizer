import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom'],
          mui: ['@mui/material', '@mui/icons-material', '@emotion/react', '@emotion/styled'],
        },
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        // Explicit IPv4 to match the server's 127.0.0.1 loopback bind
        // (localhost can resolve to ::1 first on Windows).
        target: 'http://127.0.0.1:3001',
        changeOrigin: false,
      },
    },
  },
})
