import { Header } from "@/components/marketing/header";
import { Footer } from "@/components/marketing/footer";

// Layout público: header fixo + conteúdo + footer
export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Header />
      <main>{children}</main>
      <Footer />
    </>
  );
}
