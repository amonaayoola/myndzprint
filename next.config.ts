import type { NextConfig } from 'next'
import path from 'path'

const nextConfig: NextConfig = {
  // Turbopack-compatible alias config
  turbopack: {
    resolveAlias: {
      'sharp': './src/lib/empty.ts',
      'onnxruntime-node': './src/lib/empty.ts',
    },
  },
  // Webpack alias config (used by `next build` and `next dev` without --turbo)
  webpack(config) {
    config.resolve.alias = {
      ...config.resolve.alias,
      'sharp': path.resolve('./src/lib/empty.ts'),
      'onnxruntime-node': path.resolve('./src/lib/empty.ts'),
    }
    return config
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'Cross-Origin-Embedder-Policy', value: 'require-corp' },
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
        ],
      },
    ]
  },
}

export default nextConfig
