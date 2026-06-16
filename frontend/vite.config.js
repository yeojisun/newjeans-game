import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  base: '/newjeans-game/',
  plugins: [vue()],
  server: {
    port: 5173
  }
})
