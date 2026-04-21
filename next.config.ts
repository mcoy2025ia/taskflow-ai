import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  experimental: {
    // Only bundle the icons/components actually imported from these packages.
    // lucide-react has 1500+ icons; without this flag the whole package goes
    // into the initial bundle even if only 10 icons are used.
    optimizePackageImports: ['lucide-react', '@base-ui/react'],
  },
}

export default nextConfig
