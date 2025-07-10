import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3001,
    host: 'localhost'
  },
  define: {
    global: 'globalThis',
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    minify: 'esbuild',
    rollupOptions: {
      external: [],
      output: {
        manualChunks: undefined,
      }
    },
    commonjsOptions: {
      include: [/node_modules/],
    }
  },
  optimizeDeps: {
    include: ['react', 'react-dom'],
  },
})
