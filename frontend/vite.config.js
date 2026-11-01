import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    strictPort: true,
    plugins: [{
      name: 'report-http-activity',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (typeof process.send === 'function') {
            process.send({ type: 'http-activity' })
          }
          next()
        })
      },
    }],
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
})
