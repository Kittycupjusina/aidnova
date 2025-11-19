/** @type {import('next').NextConfig} */
const basePath = process.env.NEXT_BASE_PATH || "";
const nextConfig = {
  reactStrictMode: true,
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
  // Use basePath and assetPrefix when deploying to GitHub Pages (project site)
  basePath: basePath || undefined,
  assetPrefix: basePath ? `${basePath}/` : undefined,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Cross-Origin-Embedder-Policy", value: "require-corp" },
          { key: "Cross-Origin-Resource-Policy", value: "cross-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;

