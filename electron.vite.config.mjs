import { resolve } from 'node:path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import vue from '@vitejs/plugin-vue'
import { readFileSync } from 'node:fs'

const pkg = JSON.parse(readFileSync('package.json', 'utf8'))

export default defineConfig({
  main: {
    // Runtime `dependencies` (e.g. electron-store) are required at runtime, not bundled.
    plugins: [externalizeDepsPlugin()],
    build: { outDir: 'out/main' }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: { outDir: 'out/preload' }
  },
  renderer: {
    root: 'src/renderer',
    resolve: {
      alias: { '@': resolve('src/renderer/src') }
    },
    plugins: [vue()],
    define: {
      __APP_NAME__: JSON.stringify(pkg.productName),
      __APP_VERSION__: JSON.stringify(pkg.version),
      __APP_COPYRIGHT__: JSON.stringify(pkg.copyright)
    },
    build: {
      outDir: 'out/renderer',
      rollupOptions: { input: resolve('src/renderer/index.html') }
    }
  }
})
