import { existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const rootDir = dirname(fileURLToPath(import.meta.url))
const localSeed = resolve(rootDir, 'private/localFunds.ts')
const defaultSeed = resolve(rootDir, 'src/data/emptySeed.ts')

const eastmoneyFundProxy = {
  target: 'https://api.fund.eastmoney.com',
  changeOrigin: true,
  rewrite: (path: string) => path.replace(/^\/api\/fund/, ''),
  configure: (proxy: {
    on: (
      event: 'proxyReq',
      handler: (
        proxyReq: { setHeader: (name: string, value: string) => void },
        req: { url?: string },
      ) => void,
    ) => void;
  }) => {
    proxy.on('proxyReq', (proxyReq, req) => {
      const url = req.url ?? ''
      const match = url.match(/fundCode=(\d+)/)
      const code = match?.[1] ?? '000001'
      proxyReq.setHeader(
        'Referer',
        `https://fundf10.eastmoney.com/jjjz_${code}.html`,
      )
      proxyReq.setHeader(
        'User-Agent',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      )
    })
  },
}

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  resolve: {
    alias: {
      '@app-seed-funds':
        mode === 'development' && existsSync(localSeed)
          ? localSeed
          : defaultSeed,
    },
  },
  server: {
    proxy: {
      '/api/fund': eastmoneyFundProxy,
      '/api/search': {
        target: 'https://fundsuggest.eastmoney.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/search/, ''),
      },
      '/api/rank': {
        target: 'https://fund.eastmoney.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/rank/, ''),
      },
      '/api/market': {
        target: 'https://push2.eastmoney.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/market/, ''),
      },
    },
  },
  preview: {
    proxy: {
      '/api/fund': eastmoneyFundProxy,
      '/api/search': {
        target: 'https://fundsuggest.eastmoney.com',
        changeOrigin: true,
        rewrite: (path: string) => path.replace(/^\/api\/search/, ''),
      },
      '/api/rank': {
        target: 'https://fund.eastmoney.com',
        changeOrigin: true,
        rewrite: (path: string) => path.replace(/^\/api\/rank/, ''),
      },
      '/api/market': {
        target: 'https://push2.eastmoney.com',
        changeOrigin: true,
        rewrite: (path: string) => path.replace(/^\/api\/market/, ''),
      },
    },
  },
}))
