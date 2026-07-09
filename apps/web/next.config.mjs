/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@campus/contracts'],
  // ponytail: `pnpm lint` already runs eslint directly for this package; Next's
  // bundled internal ESLint step can't resolve our workspace shareable config
  // through its own module resolution, so skip the redundant pass here.
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
