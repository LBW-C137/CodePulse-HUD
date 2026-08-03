import { resolve } from 'node:path'
import type { Plugin } from 'vite'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

// Workspace packages are TypeScript source — must be bundled, not externalized.
// Pure JS dependencies are bundled so the installer only ships runtime-native addons.
const bundleIntoApp = [
  '@codepulse/shared',
  '@codepulse/core',
  '@codepulse/adapters',
  '@codepulse/local-server',
  'fastify',
  '@fastify/websocket',
  'bonjour-service',
]

/** Native modules that must not be bundled into the main process. */
const nativeExternals = ['serialport'] as const

const emptyNativeStub = resolve(__dirname, 'scripts/empty-native-stub.cjs')

/**
 * `ws` optionally requires bufferutil / utf-8-validate for perf. Alias them to
 * an empty stub so the main bundle never hard-fails at load when they are absent.
 */
function stubOptionalWsNatives(): Plugin {
  const stubs = new Set(['bufferutil', 'utf-8-validate'])
  return {
    name: 'stub-optional-ws-natives',
    enforce: 'pre',
    resolveId(id) {
      if (stubs.has(id)) return emptyNativeStub
      return null
    },
  }
}

export default defineConfig({
  main: {
    resolve: {
      alias: {
        bufferutil: emptyNativeStub,
        'utf-8-validate': emptyNativeStub,
      },
    },
    plugins: [
      stubOptionalWsNatives(),
      // Keep native serial access external; pack the rest into out/main.
      externalizeDepsPlugin({
        exclude: bundleIntoApp,
        include: [...nativeExternals],
      }),
    ],
    build: {
      minify: 'esbuild',
      rollupOptions: {
        input: { index: resolve(__dirname, 'src/main/index.ts') },
        // Belt-and-suspenders: never try to bundle the native addon.
        external: [...nativeExternals],
      },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin({ exclude: bundleIntoApp })],
    build: {
      minify: 'esbuild',
      rollupOptions: {
        input: { index: resolve(__dirname, 'src/preload/index.ts') },
      },
    },
  },
  renderer: {
    root: resolve(__dirname, 'src/renderer'),
    resolve: {
      alias: { '@renderer': resolve(__dirname, 'src/renderer/src') },
    },
    plugins: [react()],
    build: {
      minify: 'esbuild',
      cssMinify: true,
      rollupOptions: {
        input: { index: resolve(__dirname, 'src/renderer/index.html') },
        output: {
          // Slightly smaller than default hashed multi-chunk for this small UI.
          manualChunks: undefined,
        },
      },
    },
  },
})
