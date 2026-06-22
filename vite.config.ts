import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const localSeed = resolve(__dirname, 'private/localFunds.ts')
const defaultSeed = resolve(__dirname, 'src/data/emptySeed.ts')

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
      '/api/fund': {
        target: 'https://api.fund.eastmoney.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/fund/, ''),
        configure: (proxy) => {
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
      },
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
}))
