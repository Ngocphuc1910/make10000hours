import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/make10000hours/',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    minify: 'esbuild',
  }
})
