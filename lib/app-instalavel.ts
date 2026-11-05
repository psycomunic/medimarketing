import type { Metadata, Viewport } from "next";

/**
 * Metadados do app instalável (PWA): só no painel e no login.
 *
 * Fora daí (site, link de agendamento do paciente) o manifesto não entra
 * de propósito — senão o Android ofereceria ao paciente instalar o app da
 * equipe da clínica.
 */

// Mesmas telas de scripts/gerar-icones-app.mjs: [largura, altura, densidade]
const TELAS: [number, number, number][] = [
  [430, 932, 3],
  [393, 852, 3],
  [428, 926, 3],
  [390, 844, 3],
  [375, 812, 3],
  [414, 896, 3],
  [414, 896, 2],
  [375, 667, 2],
  [820, 1180, 2],
  [834, 1194, 2],
  [1024, 1366, 2],
];

export const metadataApp: Metadata = {
  manifest: "/manifest.webmanifest",
  applicationName: "Medi Marketing",
  appleWebApp: {
    capable: true,
    title: "Medi",
    statusBarStyle: "default",
    startupImage: TELAS.map(([w, h, d]) => ({
      url: `/icones-app/abertura-${w * d}x${h * d}.png`,
      media: `(device-width: ${w}px) and (device-height: ${h}px) and (-webkit-device-pixel-ratio: ${d}) and (orientation: portrait)`,
    })),
  },
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/icones-app/icone-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/icones-app/apple-touch-icon.png", sizes: "180x180" }],
  },
  formatDetection: { telephone: false },
};

export const viewportApp: Viewport = {
  themeColor: "#0B4F6C",
  // Ocupa a tela toda no iPhone; as barras usam env(safe-area-inset-*)
  viewportFit: "cover",
  // Teclado aberto encolhe a área útil (Android): a janela de baixo
  // sobe junto com o campo, em vez de ficar escondida atrás dele
  interactiveWidget: "resizes-content",
};
