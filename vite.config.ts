import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api/internal': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      '/api/dashboard': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      '/auth': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      '/admin': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        // '/admin/*' is both a backend API prefix (admin CRUD endpoints) and a
        // frontend SPA route (/admin/brokers, /admin/users). Browser navigations
        // (full page loads / refreshes) request `text/html` — bypass the proxy
        // for those so Vite serves index.html and React Router handles the route.
        // Actual API calls (axios, Accept: application/json) still proxy through.
        bypass: (req) => {
          if (req.headers.accept?.includes('text/html')) {
            return '/index.html';
          }
        },
      }
    }
  }
})
