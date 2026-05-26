import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ command }) => ({
  // GitHub Pages serves under /terminal-immersive-rpg/. Dev uses /.
  base: command === 'build' ? '/terminal-immersive-rpg/' : '/',
  plugins: [react()],
  server: { port: 5173, open: true }
}))
