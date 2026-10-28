/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Anexos (até 10 MB), banner, logo e foto passam por server action,
    // cujo limite padrão é 1 MB.
    serverActions: { bodySizeLimit: "12mb" },
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
