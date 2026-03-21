import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
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
