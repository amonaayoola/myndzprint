import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Turbopack-compatible alias config
  turbopack: {
    resolveAlias: {
      'sharp': './src/lib/empty.ts',
      'onnxruntime-node': './src/lib/empty.ts',
    },
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
