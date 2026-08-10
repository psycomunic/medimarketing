import type { Metadata, Viewport } from "next";
import { Inter, Poppins } from "next/font/google";
import { site } from "@/lib/site";
import "./globals.css";

// Corpo de texto — legibilidade alta
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

// Títulos — moderna e confiável
const poppins = Poppins({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-poppins",
  display: "swap",
});

const titulo = `${site.nome} | ${site.tagline}`;

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: {
    default: titulo,
    template: `%s | ${site.nome}`,
  },
  description: site.descricao,
  applicationName: site.nome,
  keywords: [
    "plataforma para clínicas",
    "software para clínicas",
    "CRM para clínicas",
    "marketing médico",
    "secretariado remoto",
    "agenda médica",
    "Google Ads para médicos",
    "Meta Ads para clínicas",
    "atendimento para médicos",
    "reativação de pacientes",
  ],
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: titulo,
    description: site.descricao,
    url: site.url,
    siteName: site.nome,
    locale: "pt_BR",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: titulo,
    description: site.descricao,
  },
  robots: {
    index: true,
    follow: true,
  },
  icons: {
    icon: "/favicon.svg",
  },
};

export const viewport: Viewport = {
  themeColor: "#0B4F6C",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" className={`${inter.variable} ${poppins.variable}`}>
      <body>{children}</body>
    </html>
  );
}
