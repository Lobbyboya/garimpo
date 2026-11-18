-- Estatísticas de uso do Garimpo (opcionais e anônimas).
-- Rode uma vez no SQL Editor do seu projeto Supabase.
--
-- Segurança: a chave publishable/anon vai dentro do app, então qualquer um pode usá-la.
-- Por isso ela só consegue INSERIR eventos válidos e apagar os da própria instalação (pelo id
-- aleatório, que só o app conhece). Ler os dados fica restrito a você, no painel do Supabase.

create table if not exists public.eventos (
  id          bigint generated always as identity primary key,
  instalacao  uuid        not null,
  evento      text        not null check (evento in (
                'app_aberto', 'garimpo', 'aba_aberta', 'salvo_adicionado', 'salvo_removido',
                'salvo_ouvido', 'previas_abertas', 'previa_tocada', 'link_aberto',
                'artista_dispensado')),
  dados       jsonb       not null default '{}'::jsonb check (pg_column_size(dados) <= 2048),
  versao      text        not null check (char_length(versao) <= 20),
  sistema     text        not null check (sistema in ('win32', 'linux', 'darwin')),
  criado_em   timestamptz not null default now(),
  recebido_em timestamptz not null default now()
);

create index if not exists eventos_criado_em_idx on public.eventos (criado_em);
create index if not exists eventos_instalacao_idx on public.eventos (instalacao);

alter table public.eventos enable row level security;

-- O app (papel anon) só insere. Sem política de SELECT/UPDATE/DELETE: o resto é negado.
revoke all on public.eventos from anon, authenticated;
grant insert (instalacao, evento, dados, versao, sistema, criado_em) on public.eventos to anon;

drop policy if exists "app insere eventos" on public.eventos;
create policy "app insere eventos" on public.eventos
  for insert to anon
  -- relógio do usuário muito errado não vale (fica na política, não na tabela, para não
  -- impedir a restauração de backups com eventos antigos)
  with check (criado_em between now() - interval '30 days' and now() + interval '1 day');

-- Botão "Apagar o que já enviei" do app (direito de exclusão, LGPD).
create or replace function public.apagar_instalacao(p_instalacao uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.eventos where instalacao = p_instalacao;
$$;

revoke all on function public.apagar_instalacao(uuid) from public;
grant execute on function public.apagar_instalacao(uuid) to anon;

-- ---------- Visões para você consultar no painel (Table Editor ou SQL Editor) ----------
-- Ficam num schema que a API não expõe, então o app não consegue lê-las.

create schema if not exists estatisticas;
revoke all on schema estatisticas from anon, authenticated, public;

-- Pessoas (instalações) ativas por dia e por semana.
create or replace view estatisticas.ativos_por_dia as
select date_trunc('day', criado_em)::date as dia,
       count(distinct instalacao)        as instalacoes_ativas,
       count(*) filter (where evento = 'garimpo') as garimpos
from public.eventos
group by 1 order by 1 desc;

create or replace view estatisticas.ativos_por_semana as
select date_trunc('week', criado_em)::date as semana,
       count(distinct instalacao)          as instalacoes_ativas
from public.eventos
group by 1 order by 1 desc;

-- Total de instalações que já mandaram algo, e quando apareceram pela primeira vez.
create or replace view estatisticas.instalacoes as
select instalacao,
       min(criado_em) as primeira_vez,
       max(criado_em) as ultima_vez,
       count(*)       as eventos,
       (array_agg(versao  order by criado_em desc))[1] as versao_atual,
       (array_agg(sistema order by criado_em desc))[1] as sistema
from public.eventos
group by 1;

-- Uso de cada recurso nos últimos 30 dias.
create or replace view estatisticas.recursos_30_dias as
select evento,
       count(*)                   as vezes,
       count(distinct instalacao) as instalacoes
from public.eventos
where criado_em > now() - interval '30 days'
group by 1 order by 2 desc;

-- De onde vem o gosto das pessoas e qual motor de similaridade é usado.
create or replace view estatisticas.fontes_e_motor as
select fonte,
       dados->>'motor'            as motor,
       count(*)                   as garimpos,
       count(distinct instalacao) as instalacoes
from public.eventos, jsonb_array_elements_text(coalesce(dados->'fontes', '[]'::jsonb)) as fonte
where evento = 'garimpo'
group by 1, 2 order by 3 desc;

-- Versões e sistemas em uso (pelo último evento de cada instalação).
create or replace view estatisticas.versoes as
select versao_atual as versao, sistema, count(*) as instalacoes
from estatisticas.instalacoes
where ultima_vez > now() - interval '30 days'
group by 1, 2 order by 3 desc;

-- Retenção simples: das instalações que começaram em cada semana, quantas voltaram depois de 7 dias.
create or replace view estatisticas.retencao as
select date_trunc('week', primeira_vez)::date as semana_de_entrada,
       count(*) as novas,
       count(*) filter (where ultima_vez > primeira_vez + interval '7 days') as voltaram_apos_7_dias
from estatisticas.instalacoes
group by 1 order by 1 desc;
