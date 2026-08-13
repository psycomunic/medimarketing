import {
  CalendarDays,
  Users,
  MessagesSquare,
  Megaphone,
  Repeat,
  BarChart3,
  LayoutDashboard,
} from "lucide-react";

const menu = [
  { icone: LayoutDashboard, label: "Início", ativo: true },
  { icone: CalendarDays, label: "Agenda" },
  { icone: Users, label: "CRM" },
  { icone: MessagesSquare, label: "Atendimento" },
  { icone: Repeat, label: "Retenção" },
  { icone: Megaphone, label: "Marketing" },
  { icone: BarChart3, label: "Indicadores" },
];

const kpis = [
  { valor: "18", label: "consultas hoje", cor: "text-azul-medico" },
  { valor: "94%", label: "confirmadas", cor: "text-sucesso" },
  { valor: "37", label: "leads no mês", cor: "text-teal" },
  { valor: "4,8x", label: "retorno", cor: "text-coral" },
];

const funil = [
  { etapa: "Novos", n: 37, largura: "100%" },
  { etapa: "Em contato", n: 29, largura: "78%" },
  { etapa: "Agendados", n: 21, largura: "57%" },
  { etapa: "Compareceram", n: 17, largura: "46%" },
];

/** Semana em curso, para o painel mostrar movimento e não só números. */
const semana = [
  { dia: "D", n: 0 },
  { dia: "S", n: 12 },
  { dia: "T", n: 18, hoje: true },
  { dia: "Q", n: 15 },
  { dia: "Q", n: 21 },
  { dia: "S", n: 14 },
  { dia: "S", n: 6 },
];

const MAIOR = Math.max(...semana.map((s) => s.n));

/**
 * Mockup do painel usado na seção "A Plataforma" e na proposta.
 *
 * Puro CSS, sem imagem, por dois motivos: não pesa no carregamento e
 * não envelhece. A foto do topo do site tem a agenda de agosto de 2026
 * gravada nos pixels; esta aqui é HTML, nítida em qualquer tela.
 *
 * `semMoldura` existe para quando ele entra dentro do notebook, que já
 * fornece a borda: sem isso ficariam duas molduras concêntricas.
 */
export function PainelMockup() {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-white shadow-card">
      {/* Barra do navegador */}
      <div className="flex items-center gap-2 border-b border-border bg-branco-clinico px-4 py-3">
        <span className="size-2.5 rounded-full bg-coral/60" />
        <span className="size-2.5 rounded-full bg-alerta/60" />
        <span className="size-2.5 rounded-full bg-sucesso/60" />
        <div className="ml-3 flex-1 truncate rounded-md bg-white px-3 py-1 text-[11px] text-cinza-suave">
          painel.medimarketing.com.br
        </div>
      </div>

      <div className="flex">
        {/* Menu lateral */}
        <div className="hidden w-40 shrink-0 border-r border-border bg-branco-clinico/60 p-3 sm:block">
          {menu.map((m) => (
            <div
              key={m.label}
              className={
                "mb-1 flex items-center gap-2 rounded-md px-2.5 py-2 text-xs font-medium " +
                (m.ativo
                  ? "bg-verde-menta text-azul-medico"
                  : "text-cinza-suave")
              }
            >
              <m.icone className="size-3.5" />
              {m.label}
            </div>
          ))}
        </div>

        {/* Conteúdo */}
        <div className="min-w-0 flex-1 p-4 sm:p-5">
          <div className="flex items-center justify-between">
            <p className="font-heading text-sm font-semibold text-azul-medico">
              Clínica Vida Derma
            </p>
            <span className="flex items-center gap-1.5 rounded-full bg-sucesso/10 px-2 py-0.5 text-[10px] font-semibold text-sucesso">
              <span className="size-1.5 animate-pulse rounded-full bg-sucesso" />
              ao vivo
            </span>
          </div>

          {/* Cartões de indicador */}
          <div className="mt-3 grid grid-cols-2 gap-2 lg:grid-cols-4">
            {kpis.map((k) => (
              <div
                key={k.label}
                className="rounded-lg border border-border bg-branco-clinico p-2.5"
              >
                <p className={`font-heading text-lg font-bold ${k.cor}`}>
                  {k.valor}
                </p>
                <p className="text-[10px] leading-tight text-cinza-suave">
                  {k.label}
                </p>
              </div>
            ))}
          </div>

          {/* Movimento da semana: um painel sem gráfico parece planilha */}
          <div className="mt-3 rounded-lg border border-border p-3">
            <div className="flex items-baseline justify-between">
              <p className="text-[11px] font-semibold text-cinza-suave">
                Consultas na semana
              </p>
              <p className="text-[10px] text-cinza-suave">
                <strong className="text-azul-medico">86</strong> no total
              </p>
            </div>
            {/* A área da barra precisa de altura própria: com o rótulo
                no mesmo bloco, a porcentagem não tinha contra o que
                medir e as barras nasciam com zero. */}
            <div className="mt-2.5 flex h-16 gap-1.5">
              {semana.map((s, i) => (
                <div key={i} className="flex flex-1 flex-col">
                  <div className="flex flex-1 items-end">
                    <div
                      className={
                        "w-full rounded-sm " +
                        (s.hoje ? "bg-teal" : "bg-verde-menta")
                      }
                      style={{ height: `${Math.max(8, (s.n / MAIOR) * 100)}%` }}
                    />
                  </div>
                  <span
                    className={
                      "mt-1 text-center text-[9px] " +
                      (s.hoje ? "font-bold text-teal" : "text-cinza-suave")
                    }
                  >
                    {s.dia}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-3 grid gap-3 lg:grid-cols-2">
            {/* Funil comercial */}
            <div className="rounded-lg border border-border p-3">
              <p className="text-[11px] font-semibold text-cinza-suave">
                Funil do mês
              </p>
              <div className="mt-2.5 space-y-2">
                {funil.map((f) => (
                  <div key={f.etapa}>
                    <div className="flex justify-between text-[10px] text-cinza-suave">
                      <span>{f.etapa}</span>
                      <span className="font-semibold text-azul-medico">
                        {f.n}
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 rounded-full bg-verde-menta">
                      <div
                        className="h-full rounded-full bg-teal"
                        style={{ width: f.largura }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Agenda do dia */}
            <div className="rounded-lg border border-border p-3">
              <div className="flex items-baseline justify-between">
                <p className="text-[11px] font-semibold text-cinza-suave">
                  Próximas consultas
                </p>
                <p className="flex items-center gap-2 text-[9px] text-cinza-suave">
                  <span className="flex items-center gap-1">
                    <span className="size-1.5 rounded-full bg-sucesso" />
                    confirmada
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="size-1.5 rounded-full bg-alerta" />
                    pendente
                  </span>
                </p>
              </div>
              <div className="mt-2.5 space-y-1.5">
                {/* O status virou ponto colorido: a palavra "confirmada"
                    ocupava a linha inteira e empurrava o nome do
                    paciente para fora, que é justamente o dado que a
                    recepção procura. */}
                {[
                  { h: "08:30", p: "Ana Ribeiro", s: "confirmada" },
                  { h: "09:15", p: "Carlos Menezes", s: "confirmada" },
                  { h: "10:00", p: "Juliana Faria", s: "pendente" },
                  { h: "11:00", p: "Marcos Lima", s: "confirmada" },
                ].map((c) => (
                  <div
                    key={c.h}
                    className="flex items-center gap-1.5 rounded-md bg-branco-clinico px-2 py-1.5"
                    title={`${c.h} · ${c.p} · ${c.s}`}
                  >
                    <span
                      aria-hidden
                      className={
                        "size-1.5 shrink-0 rounded-full " +
                        (c.s === "confirmada" ? "bg-sucesso" : "bg-alerta")
                      }
                    />
                    <span className="shrink-0 font-mono text-[10px] font-semibold text-azul-medico">
                      {c.h}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[10px] text-cinza-texto">
                      {c.p}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
