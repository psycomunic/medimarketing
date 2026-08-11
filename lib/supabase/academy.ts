import { createClient } from "@/lib/supabase/server";
import { emModoDemo } from "@/lib/supabase/queries";
import {
  demoAulasConcluidas,
  demoComentarios,
  demoDataConclusao,
  demoCourses,
  demoLessons,
  demoTodosComentarios,
} from "@/lib/demo-dados";
import type {
  ComentarioComAutor,
  Course,
  Lesson,
  LessonComment,
  Role,
} from "@/lib/supabase/types";

/** Trilha com o progresso do usuário já calculado. */
export type TrilhaComProgresso = Course & {
  aulas: number;
  concluidas: number;
  /** 0 a 100 */
  percentual: number;
  duracao_total: number;
};

function montaProgresso(
  cursos: Course[],
  aulas: Lesson[],
  concluidas: Set<string>
): TrilhaComProgresso[] {
  return cursos.map((c) => {
    const doCurso = aulas.filter((a) => a.course_id === c.id && a.publicado);
    const feitas = doCurso.filter((a) => concluidas.has(a.id)).length;
    return {
      ...c,
      aulas: doCurso.length,
      concluidas: feitas,
      percentual: doCurso.length ? Math.round((feitas / doCurso.length) * 100) : 0,
      duracao_total: doCurso.reduce((soma, a) => soma + (a.duracao_min ?? 0), 0),
    };
  });
}

/** Aulas que o usuário já concluiu. */
export async function getAulasConcluidas(userId: string): Promise<Set<string>> {
  if (await emModoDemo()) return new Set(demoAulasConcluidas());

  const supabase = await createClient();
  const { data } = await supabase
    .from("lesson_progress")
    .select("lesson_id")
    .eq("user_id", userId)
    .eq("concluida", true);

  return new Set((data ?? []).map((p) => p.lesson_id));
}

/**
 * Data da última aula concluída dentro de uma trilha.
 *
 * O certificado precisa da data real da conclusão, e não da data em que a
 * página foi aberta — senão o mesmo certificado muda de data a cada visita.
 */
export async function getDataConclusao(
  userId: string,
  lessonIds: string[]
): Promise<string | null> {
  if (!lessonIds.length) return null;
  if (await emModoDemo()) return demoDataConclusao();

  const supabase = await createClient();
  const { data } = await supabase
    .from("lesson_progress")
    .select("concluida_em")
    .eq("user_id", userId)
    .eq("concluida", true)
    .in("lesson_id", lessonIds)
    .order("concluida_em", { ascending: false })
    .limit(1)
    .maybeSingle();

  return data?.concluida_em ?? null;
}

/** Trilhas visíveis para o papel, com progresso. */
export async function getTrilhas(
  role: Role,
  userId: string
): Promise<TrilhaComProgresso[]> {
  const concluidas = await getAulasConcluidas(userId);

  if (await emModoDemo()) {
    const cursos = demoCourses()
      .filter((c) => c.publicado && c.papeis.includes(role))
      .sort((a, b) => a.ordem - b.ordem);
    return montaProgresso(cursos, demoLessons(), concluidas);
  }

  const supabase = await createClient();
  // A RLS já filtra por papel e por publicado; a ordenação é explícita
  const { data: cursos } = await supabase
    .from("courses")
    .select("*")
    .eq("publicado", true)
    .order("ordem", { ascending: true });

  if (!cursos?.length) return [];

  const { data: aulas } = await supabase
    .from("lessons")
    .select("*")
    .in(
      "course_id",
      cursos.map((c) => c.id)
    );

  return montaProgresso(cursos, aulas ?? [], concluidas);
}

/** Uma trilha pelo slug, com as aulas em ordem. */
export async function getTrilha(
  slug: string
): Promise<{ curso: Course; aulas: Lesson[] } | null> {
  if (await emModoDemo()) {
    const curso = demoCourses().find((c) => c.slug === slug);
    if (!curso) return null;
    return {
      curso,
      aulas: demoLessons(curso.id).sort((a, b) => a.ordem - b.ordem),
    };
  }

  const supabase = await createClient();
  const { data: curso } = await supabase
    .from("courses")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();

  if (!curso) return null;

  const { data: aulas } = await supabase
    .from("lessons")
    .select("*")
    .eq("course_id", curso.id)
    .order("ordem", { ascending: true });

  return { curso, aulas: aulas ?? [] };
}

/** Todas as trilhas, publicadas ou não (painel administrativo). */
export async function getTrilhasAdmin(): Promise<TrilhaComProgresso[]> {
  if (await emModoDemo()) {
    return montaProgresso(
      demoCourses().sort((a, b) => a.ordem - b.ordem),
      demoLessons(),
      new Set()
    );
  }

  const supabase = await createClient();
  const { data: cursos } = await supabase
    .from("courses")
    .select("*")
    .order("ordem", { ascending: true });

  if (!cursos?.length) return [];

  const { data: aulas } = await supabase
    .from("lessons")
    .select("*")
    .in(
      "course_id",
      cursos.map((c) => c.id)
    );

  return montaProgresso(cursos, aulas ?? [], new Set());
}

/* ------------------------------------------------------------------ */
/* Comentários                                                         */
/* ------------------------------------------------------------------ */

/**
 * Busca os autores em uma segunda consulta em vez de usar join aninhado:
 * o tipo `Database` declara `Relationships: []`, então o supabase-js não
 * consegue inferir o formato do join e os tipos colapsariam.
 */
async function anexaAutores(
  comentarios: LessonComment[]
): Promise<ComentarioComAutor[]> {
  if (!comentarios.length) return [];

  const supabase = await createClient();
  const ids = Array.from(new Set(comentarios.map((c) => c.user_id)));
  const { data: perfis } = await supabase
    .from("profiles")
    .select("id,nome,role")
    .in("id", ids);

  const mapa = new Map(
    (perfis ?? []).map((p) => [p.id, { nome: p.nome, role: p.role }])
  );

  return comentarios.map((c) => ({
    ...c,
    autor_nome: mapa.get(c.user_id)?.nome ?? "Usuário",
    autor_papel: (mapa.get(c.user_id)?.role ?? "medico") as Role,
  }));
}

/** Agrupa respostas dentro do comentário original. */
function emArvore(lista: ComentarioComAutor[]): ComentarioComAutor[] {
  const raizes = lista.filter((c) => !c.parent_id);
  return raizes.map((r) => ({
    ...r,
    respostas: lista
      .filter((c) => c.parent_id === r.id)
      .sort((a, b) => a.created_at.localeCompare(b.created_at)),
  }));
}

/** Comentários de uma aula, já em árvore (pergunta + respostas). */
export async function getComentarios(
  lessonId: string
): Promise<ComentarioComAutor[]> {
  if (await emModoDemo()) return demoComentarios(lessonId);

  const supabase = await createClient();
  const { data } = await supabase
    .from("lesson_comments")
    .select("*")
    .eq("lesson_id", lessonId)
    .order("created_at", { ascending: true });

  return emArvore(await anexaAutores(data ?? []));
}

export type ComentarioDaFila = ComentarioComAutor & {
  aula_titulo: string;
  aula_slug: string;
  curso_titulo: string;
  curso_slug: string;
  clinica: string;
  respondido: boolean;
};

/**
 * Fila de dúvidas do painel administrativo: toda pergunta feita nas aulas,
 * com o contexto de aula, trilha e clínica, marcando o que já foi respondido.
 */
export async function getFilaComentarios(): Promise<ComentarioDaFila[]> {
  if (await emModoDemo()) {
    const cursos = demoCourses();
    const aulas = demoLessons();
    return demoTodosComentarios()
      .filter((c) => !c.parent_id)
      .map((c) => {
        const aula = aulas.find((a) => a.id === c.lesson_id);
        const curso = cursos.find((cc) => cc.id === aula?.course_id);
        return {
          ...c,
          aula_titulo: aula?.titulo ?? "Aula",
          aula_slug: aula?.slug ?? "",
          curso_titulo: curso?.titulo ?? "Trilha",
          curso_slug: curso?.slug ?? "",
          clinica: "Clínica Vida Derma",
          respondido: (c.respostas?.length ?? 0) > 0,
        };
      })
      .sort((a, b) => Number(a.respondido) - Number(b.respondido) ||
        b.created_at.localeCompare(a.created_at));
  }

  const supabase = await createClient();
  const { data } = await supabase
    .from("lesson_comments")
    .select("*")
    .order("created_at", { ascending: false });

  const todos = await anexaAutores(data ?? []);
  const raizes = todos.filter((c) => !c.parent_id);
  if (!raizes.length) return [];

  const [{ data: aulas }, { data: cursos }, { data: orgs }] = await Promise.all([
    supabase.from("lessons").select("id,titulo,slug,course_id"),
    supabase.from("courses").select("id,titulo,slug"),
    supabase.from("organizations").select("id,nome"),
  ]);

  const mapaAula = new Map((aulas ?? []).map((a) => [a.id, a]));
  const mapaCurso = new Map((cursos ?? []).map((c) => [c.id, c]));
  const mapaOrg = new Map((orgs ?? []).map((o) => [o.id, o.nome]));

  return raizes
    .map((c) => {
      const aula = mapaAula.get(c.lesson_id);
      const curso = aula ? mapaCurso.get(aula.course_id) : undefined;
      return {
        ...c,
        respostas: todos.filter((r) => r.parent_id === c.id),
        aula_titulo: aula?.titulo ?? "Aula",
        aula_slug: aula?.slug ?? "",
        curso_titulo: curso?.titulo ?? "Trilha",
        curso_slug: curso?.slug ?? "",
        clinica: c.organization_id
          ? mapaOrg.get(c.organization_id) ?? "Clínica"
          : "Sem clínica",
        respondido: todos.some((r) => r.parent_id === c.id),
      };
    })
    .sort(
      (a, b) =>
        Number(a.respondido) - Number(b.respondido) ||
        b.created_at.localeCompare(a.created_at)
    );
}
