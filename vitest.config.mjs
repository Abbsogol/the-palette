import { fileURLToPath } from 'node:url'
import { transformAsync } from '@babel/core'
import { defineConfig } from 'vitest/config'
import { testEnv } from './tests/helpers/test-env.mjs'

const root = fileURLToPath(new URL('.', import.meta.url))

export default defineConfig({
  resolve: { alias: { '@': root } },
  plugins: [{
    // The existing app uses JSX in .js files. Transform it before Vite's
    // import analysis, without changing application files or Next's build.
    name: 'laque-test-jsx',
    enforce: 'pre',
    async transform(source, id) {
      if (!id.startsWith(root) || id.includes('/node_modules/') || !/\.jsx?$/.test(id)) return
      const result = await transformAsync(source, {
        filename: id, configFile: false, babelrc: false, sourceMaps: true,
        plugins: [['@babel/plugin-transform-react-jsx', { runtime: 'automatic' }]],
      })
      return { code: result.code, map: result.map }
    },
  }],
  test: {
    environment: 'node',
    env: testEnv,
    include: ['tests/unit/**/*.test.{js,jsx}', 'tests/regressions/**/*.test.{js,jsx}'],
    setupFiles: ['./tests/setup.mjs'],
    testTimeout: 5000,
    restoreMocks: true,
  },
})
