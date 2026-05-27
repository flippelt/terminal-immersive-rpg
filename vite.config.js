import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// `npm run build`           -> /Immersive-Terminal-for-RPGs/        (main)
// `npm run build:demo`      -> /Immersive-Terminal-for-RPGs/demo/   (curated)
// `npm run dev`             -> /                                     (localhost)
export default defineConfig(({ command, mode }) => ({
  base:
    command === 'build'
      ? mode === 'demo'
        ? '/Immersive-Terminal-for-RPGs/demo/'
        : '/Immersive-Terminal-for-RPGs/'
      : '/',
  plugins: [react()],
  server: { port: 5173, open: true }
}))
