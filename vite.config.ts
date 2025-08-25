import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3001,
    host: 'localhost',
    https: false
    // Alternative: Enable HTTPS for local dev to match production
    // https: true
  },
  define: {
    global: 'globalThis',
    // Explicitly define environment variables for production builds
    __VITE_GOOGLE_OAUTH_CLIENT_ID__: JSON.stringify(process.env.VITE_GOOGLE_OAUTH_CLIENT_ID),
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
