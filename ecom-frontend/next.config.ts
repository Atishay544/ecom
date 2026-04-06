import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

// In dev: allow unsafe-eval (React needs it for debugging)
// In prod: strict CSP, no eval
const cspScriptSrc = isDev
  ? "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://checkout.razorpay.com https://challenges.cloudflare.com"
  : "script-src 'self' 'unsafe-inline' https://checkout.razorpay.com https://challenges.cloudflare.com";

const securityHeaders = [
  { key: "X-DNS-Prefetch-Control",    value: "on" },
  { key: "X-Frame-Options",           value: "SAMEORIGIN" },
  { key: "X-Content-Type-Options",    value: "nosniff" },
  { key: "Referrer-Policy",           value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy",        value: "camera=(), microphone=(), geolocation=()" },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      cspScriptSrc,
      "frame-src https://checkout.razorpay.com https://challenges.cloudflare.com",
      "connect-src 'self' https://api.razorpay.com https://*.supabase.co wss://*.supabase.co",
      "img-src 'self' data: blob: https://*.supabase.co https://razorpay.com",
      "style-src 'self' 'unsafe-inline'",
    ].join("; "),
  },
  // Only apply HSTS in production
  ...(!isDev ? [{
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  }] : []),
];

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.supabase.co" },
      { protocol: "https", hostname: "razorpay.com" },
    ],
  },
};

export default nextConfig;
