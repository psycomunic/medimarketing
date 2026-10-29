"use client";

import { useState, useTransition } from "react";
import { BellOff, CheckCircle2, Loader2 } from "lucide-react";
import { descadastrar } from "@/lib/actions/disparos";
import { Button } from "@/components/ui/button";

export function ConfirmarSaida({ token, paciente, clinica, jaSaiu }: { token: string; paciente: string; clinica: string; jaSaiu: boolean }) {
  const [feito, setFeito] = useState(jaSaiu);
  const [erro, setErro] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (feito)
    return (
      <div className="text-center">
        <CheckCircle2 className="mx-auto size-12 text-teal" />
        <p className="mt-4 font-heading text-lg font-semibold text-azul-medico">Pronto, {paciente}.</p>
        <p className="mt-2 text-sm text-cinza-suave">Você não vai mais receber novidades e campanhas da {clinica}.</p>
      </div>
    );

  return (
    <div className="text-center">
      <BellOff className="mx-auto size-10 text-cinza-suave" />
      <p className="mt-4 font-heading text-lg font-semibold text-azul-medico">Olá, {paciente}!</p>
      <p className="mt-2 text-sm text-cinza-suave">Quer parar de receber novidades e campanhas da {clinica}?</p>
      {erro && <p className="mt-4 rounded-md bg-coral/10 px-3 py-2 text-sm text-coral">{erro}</p>}
      <Button
        variant="marca"
        className="mt-6 w-full"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setErro(null);
            const r = await descadastrar(token);
            if (r.ok) setFeito(true);
            else setErro(r.erro);
          })
        }
      >
        {pending && <Loader2 className="size-4 animate-spin" />}
        Não quero mais receber
      </Button>
    </div>
  );
}
