// Supabase do administrador do Garimpo, que recebe as estatísticas de uso (opcionais).
// Preencha com os dados do SEU projeto (Project Settings > API). A chave é a "publishable"
// (sb_publishable_...) ou a "anon" antiga: ela é pública por natureza, e o banco só aceita
// INSERT na tabela de eventos (ver supabase/telemetria.sql). Vazios = estatísticas desligadas.
const { buscar } = require("../comum/rede");

const URL_PROJETO = process.env.GARIMPO_SUPABASE_URL || ""; // a variável de ambiente serve para testes
const CHAVE = process.env.GARIMPO_SUPABASE_CHAVE || "";

const configurado = () => Boolean(URL_PROJETO && CHAVE);

async function postar(caminho, corpo) {
  const resp = await buscar(URL_PROJETO.replace(/\/+$/, "") + caminho, {
    servico: "servidor de estatísticas",
    tempo: 10000,
    method: "POST",
    headers: { apikey: CHAVE, "Content-Type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify(corpo),
  });
  if (!resp.ok) throw new Error(`Supabase respondeu ${resp.status}: ${(await resp.text().catch(() => "")).slice(0, 200)}`);
}

const inserirEventos = (eventos) => postar("/rest/v1/eventos", eventos);
const apagarInstalacao = (instalacao) => postar("/rest/v1/rpc/apagar_instalacao", { p_instalacao: instalacao });

module.exports = { configurado, inserirEventos, apagarInstalacao };
