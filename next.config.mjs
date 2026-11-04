/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Anexos (até 10 MB), banner, logo e foto passam por server action,
    // cujo limite padrão é 1 MB.
    serverActions: { bodySizeLimit: "12mb" },
  },
  async headers() {
    return [
      // O service worker precisa vir sempre fresco: é ele que traz as versões novas
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
      { source: "/manifest.webmanifest", headers: [{ key: "Cache-Control", value: "public, max-age=3600" }] },
    ];
  },
  async rewrites() {
    return [
      // Linktree do Instituto Correr (página estática em public/institutocorrer).
      { source: "/institutocorrer", destination: "/institutocorrer/index.html" },
    ];
  },
  images: {
    remotePatterns: [
      // Domínios externos permitidos para next/image (ex.: fotos de perfil no Supabase Storage).
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "*.supabase.co" },
    ],
  },
};

export default nextConfig;
