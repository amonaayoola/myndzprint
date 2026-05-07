import type { NextConfig } from 'next'
import path from 'path'

const nextConfig: NextConfig = {
    typescript: { ignoreBuildErrors: true },
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
          // Existing COOP/COEP headers (required for SharedArrayBuffer / wasm)
          { key: 'Cross-Origin-Embedder-Policy', value: 'require-corp' },
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
          // Prevent clickjacking
          { key: 'X-Frame-Options', value: 'DENY' },
          // Stop MIME-type sniffing
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          // Strict referrer policy
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // Basic XSS protection (legacy browsers)
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          // Permissions policy — disable unused browser features
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ]
  },
}

export default nextConfig
