import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    'process.env.NODE_ENV': '"production"',
  },
  build: {
    lib: {
      entry: "src/widget.tsx",
      name: "IzuChatWidget",
      fileName: "izu-chat-widget",
      formats: ["iife"],
    },
    rollupOptions: {
      external: [],
    },
  },
})
