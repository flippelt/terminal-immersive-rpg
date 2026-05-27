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
  server: { port: 5173, open: true },
  // Vitest transforms .jsx with esbuild, which defaults to the classic JSX
  // runtime (React.createElement) — our component test files don't import
  // React, so they need the automatic runtime to resolve the JSX factory.
  // Scoped to test runs: Vite 8's build uses oxc and would warn that this
  // esbuild option is ignored.
  ...(process.env.VITEST ? { esbuild: { jsx: 'automatic' } } : {})
}))
