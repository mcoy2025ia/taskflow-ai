import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  experimental: {
    // Solo incluye en el bundle lo que realmente usas
    optimizePackageImports: [
      'lucide-react',
      '@base-ui/react',
      '@dnd-kit/core',
      '@dnd-kit/sortable',
      '@dnd-kit/utilities',
      'sonner',
      'next-themes',
    ],
  },
}

export default nextConfig