/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverActions: {
      // Payment screenshots are uploaded through a Server Action (default
      // limit is 1 MB). Proofs are capped at 4 MB, under Vercel's 4.5 MB
      // request-body limit, plus room for the other form fields.
      bodySizeLimit: "4.4mb",
    },
  },
};

export default nextConfig;
