import { Check, CheckCheck } from "lucide-react";

/**
 * A mensagem como o paciente vê.
 *
 * É a mesma que o sistema envia de verdade, com o texto real — copiar
 * o layout do WhatsApp aqui vale mais que qualquer descrição, porque
 * o visitante reconhece na hora o que vai acontecer com o paciente
 * dele.
 */
export function ConversaWhatsApp() {
  return (
    <div className="mx-auto w-full max-w-sm rounded-2xl border border-border bg-white p-3 shadow-card">
      {/* Cabeçalho da conversa */}
      <div className="flex items-center gap-3 rounded-xl bg-azul-medico px-4 py-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-teal/25 font-heading text-sm font-bold text-white">
          CV
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-white">
            Clínica Vida Derma
          </p>
          <p className="text-xs text-white/60">online</p>
        </div>
      </div>

      <div className="space-y-2.5 bg-[#EFE7DE]/40 px-3 py-4">
        <Balao>
          <p>
            Olá, Ana! Aqui é da <strong>Clínica Vida Derma</strong>.
          </p>
          <p className="mt-2">Passando para lembrar da sua consulta:</p>
          <p className="mt-2 text-cinza-texto">
            Data: 18/08/2026 (terça-feira)
            <br />
            Horário: 14:30
            <br />
            Profissional: Dra. Helena Costa
          </p>
          <p className="mt-2">
            Para confirmar sua presença, é só tocar no link:
          </p>
          <p className="truncate text-teal underline">
            medimarketing.com.br/confirmar
          </p>
          <Hora>09:00</Hora>
        </Balao>

        {/* Resposta do paciente, do outro lado */}
        <div className="flex justify-end">
          <div className="max-w-[80%] rounded-2xl rounded-br-sm bg-verde-menta px-3.5 py-2.5 text-sm text-cinza-texto shadow-soft">
            <p className="inline-flex items-center gap-1.5 font-medium text-teal">
              <Check className="size-4" /> Presença confirmada
            </p>
            <span className="mt-1 flex items-center justify-end gap-1 text-[11px] text-cinza-suave">
              09:04 <CheckCheck className="size-3.5 text-teal" />
            </span>
          </div>
        </div>
      </div>

      {/* O que a clínica vê, do outro lado da mesma história */}
      <div className="mt-3 flex items-start gap-3 rounded-xl border border-teal/20 bg-white px-4 py-3">
        <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-verde-menta text-teal">
          <CheckCheck className="size-4" />
        </span>
        <p className="text-sm text-cinza-suave">
          <strong className="font-semibold text-azul-medico">
            No painel, ao mesmo tempo:
          </strong>{" "}
          a consulta muda para confirmada e a equipe recebe o aviso.
        </p>
      </div>
    </div>
  );
}

function Balao({ children }: { children: React.ReactNode }) {
  return (
    <div className="max-w-[88%] rounded-2xl rounded-bl-sm bg-white px-3.5 py-2.5 text-sm leading-relaxed text-cinza-suave shadow-soft">
      {children}
    </div>
  );
}

function Hora({ children }: { children: React.ReactNode }) {
  return (
    <span className="mt-1 block text-right text-[11px] text-cinza-suave">
      {children}
    </span>
  );
}
