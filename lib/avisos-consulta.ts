import "server-only";

import { createAdminClient, adminDisponivel } from "@/lib/supabase/admin";
import { emailConfigurado, enviarEmail } from "@/lib/email";
import { emailPacienteAgendada } from "@/lib/email-modelos";
import { enviarWhatsApp } from "@/lib/envio";
import { msgAgendada } from "@/lib/mensagens";
import { diaDaSemana, formatarData, formatarHora } from "@/lib/lembretes";

/**
 * AVISO DE CONSULTA MARCADA
 *
 * Sai assim que a recepção salva o agendamento, pelos dois canais que
 * o paciente tem. Não é o mesmo que o lembrete da véspera: aqui ele
 * acabou de combinar por telefone ou no balcão e ainda não tem nada
 * por escrito — a mensagem é o comprovante, não uma cobrança.
 *
 * Roda com a service role de propósito. Quem marca a consulta pode ser
 * a secretária, cuja RLS não alcança o registro da organização nem o
 * perfil do médico; ler por aqui evita transformar uma questão de
 * permissão em mensagem sem o nome da clínica.
 */
export async function avisarConsultaMarcada(consultaId: string): Promise<void> {
  if (!adminDisponivel()) return;

  const admin = createAdminClient();

  const { data: consulta } = await admin
    .from("consultas")
    .select(
      "paciente_nome,paciente_email,paciente_telefone,data_hora,medico_id,organization_id"
    )
    .eq("id", consultaId)
    .maybeSingle();

  if (!consulta?.organization_id) return;
  if (!consulta.paciente_email && !consulta.paciente_telefone) return;

  const [{ data: org }, { data: medico }] = await Promise.all([
    admin
      .from("organizations")
      .select("nome,endereco,cidade,telefone,email,logo_url,merge_connection_id")
      .eq("id", consulta.organization_id)
      .maybeSingle(),
    admin.from("profiles").select("nome").eq("id", consulta.medico_id).maybeSingle(),
  ]);

  if (!org) return;

  const endereco = [org.endereco, org.cidade].filter(Boolean).join(" — ") || null;
  const envios: Promise<unknown>[] = [];

  if (emailConfigurado() && consulta.paciente_email) {
    const modelo = emailPacienteAgendada(
      {
        clinica: org.nome,
        logoUrl: org.logo_url,
        emailClinica: org.email,
        telefoneClinica: org.telefone,
      },
      {
        paciente: consulta.paciente_nome,
        data: formatarData(consulta.data_hora),
        hora: formatarHora(consulta.data_hora),
        diaSemana: diaDaSemana(consulta.data_hora),
        medico: medico?.nome ?? null,
        endereco,
      }
    );

    envios.push(
      enviarEmail({
        para: consulta.paciente_email,
        assunto: modelo.assunto,
        html: modelo.html,
        texto: modelo.texto,
        remetenteNome: org.nome,
      })
    );
  }

  if (consulta.paciente_telefone) {
    envios.push(
      enviarWhatsApp(
        {
          nome: consulta.paciente_nome,
          telefone: consulta.paciente_telefone,
          conexaoId: org.merge_connection_id ?? null,
        },
        msgAgendada({
          paciente: consulta.paciente_nome,
          clinica: org.nome,
          data: formatarData(consulta.data_hora),
          hora: formatarHora(consulta.data_hora),
          diaSemana: diaDaSemana(consulta.data_hora),
          medico: medico?.nome ?? null,
          endereco,
        })
      )
    );
  }

  // Nenhum aviso pode derrubar o agendamento que já foi salvo
  await Promise.allSettled(envios);
}
