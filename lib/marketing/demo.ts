import { DEMO_ORG_ID } from "@/lib/demo";
import type { AnuncioDiario } from "@/lib/supabase/types";

/**
 * Campanhas de demonstração: 400 dias de números diários, com fim de
 * semana mais fraco, uma campanha que piora e outra pausada no meio.
 */
const CAMPANHAS = [
  { id: "120201", nome: "Toxina | Leads formulário", plataforma: "meta", gasto: 95, cpm: 22, ctr: 1.3, conv: 6.5, conversa: false },
  { id: "120202", nome: "Avaliação gratuita | WhatsApp", plataforma: "meta", gasto: 70, cpm: 18, ctr: 1.9, conv: 9, conversa: true },
  { id: "120203", nome: "Melasma | Reconhecimento", plataforma: "meta", gasto: 35, cpm: 9, ctr: 0.7, conv: 1.2, conversa: false },
  { id: "88101", nome: "Pesquisa | Dermatologista", plataforma: "google", gasto: 80, cpm: 120, ctr: 6.5, conv: 11, conversa: false },
  { id: "88102", nome: "Pesquisa | Botox e preenchimento", plataforma: "google", gasto: 55, cpm: 140, ctr: 5.2, conv: 8, conversa: false },
] as const;

/** Pseudoaleatório estável (mesmo dia, mesmo número). */
function ruido(semente: number) {
  const x = Math.sin(semente * 9301 + 49297) * 233280;
  return x - Math.floor(x);
}

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export function demoAnuncios(): AnuncioDiario[] {
  const lista: AnuncioDiario[] = [];
  const hoje = new Date();
  hoje.setHours(12, 0, 0, 0);
  // Os dados "chegam" até ontem, como um relatório exportado de manhã
  for (let i = 400; i >= 1; i--) {
    const d = new Date(hoje);
    d.setDate(d.getDate() - i);
    const data = iso(d);
    const fds = d.getDay() === 0 || d.getDay() === 6 ? 0.6 : 1;
    CAMPANHAS.forEach((c, k) => {
      // Reconhecimento fica pausada por um mês a cada trimestre
      if (c.id === "120203" && Math.floor(i / 30) % 3 === 1) return;
      const r = ruido(i * 7 + k);
      const gasto = Math.round(c.gasto * fds * (0.75 + r * 0.5) * 100) / 100;
      const impressoes = Math.round((gasto / c.cpm) * 1000);
      const cliques = Math.round((impressoes * c.ctr * (0.85 + ruido(i + k * 13) * 0.3)) / 100);
      // A campanha de toxina perde eficiência nas últimas duas semanas
      const piora = c.id === "120201" && i <= 14 ? 0.5 : 1;
      const contatos = Math.round((cliques * c.conv * piora * (0.7 + ruido(i * 3 + k) * 0.6)) / 100);
      lista.push({
        id: `demo-ad-${c.id}-${data}`,
        organization_id: DEMO_ORG_ID,
        plataforma: c.plataforma,
        conta_id: c.plataforma === "meta" ? "act_882014557" : "410-882-9931",
        campanha_id: c.id,
        campanha_nome: c.nome,
        data,
        investimento: gasto,
        impressoes,
        alcance: c.plataforma === "meta" ? Math.round(impressoes * 0.68) : 0,
        cliques,
        leads: c.conversa ? 0 : contatos,
        conversas: c.conversa ? contatos : 0,
        conversoes: c.plataforma === "google" ? contatos : 0,
        origem: "planilha",
        atualizado_em: hoje.toISOString(),
      });
    });
  }
  return lista;
}

export function demoOrcamento(): { meta: number; google: number } {
  return { meta: 5200, google: 3800 };
}
