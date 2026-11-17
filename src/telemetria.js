// Estatísticas de uso, opcionais e anônimas, enviadas ao Supabase do administrador do Garimpo.
//
// Regras:
//  - nada é enviado sem a pessoa dizer "sim" (opt-in); a escolha pode ser trocada em Configurações;
//  - nada identifica a pessoa: sem nome, e-mail, usuário do Last.fm/Spotify nem nomes de artistas;
//    só um id aleatório desta instalação, o tipo do evento e alguns números;
//  - só eventos da lista EVENTOS, com campos conferidos; o resto é descartado;
//  - os eventos ficam numa fila local e vão em lote; sem internet, ficam para depois.
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

// Preencha com os dados do SEU projeto no Supabase (Project Settings > API).
// A chave é a "publishable" (sb_publishable_...) ou a "anon" antiga: ela é pública por natureza,
// e o banco só aceita INSERT na tabela de eventos (ver supabase/telemetria.sql).
// Com os dois vazios a telemetria fica desligada e a opção nem aparece no app.
const SUPABASE_URL = process.env.GARIMPO_SUPABASE_URL || ""; // a variável de ambiente serve para testes
const SUPABASE_CHAVE = process.env.GARIMPO_SUPABASE_CHAVE || "";

const MAX_FILA = 500;
const LOTE = 100;
const INTERVALO_ENVIO = 10 * 60 * 1000;

// Evento -> campos aceitos e o tipo de cada um.
const EVENTOS = {
  app_aberto: {},
  garimpo: { fontes: "lista", motor: "texto", periodo: "texto", sementes: "numero", recomendacoes: "numero", duracao_ms: "numero", erro: "bool" },
  aba_aberta: { aba: "texto" },
  salvo_adicionado: { aba: "texto" },
  salvo_removido: { aba: "texto" },
  salvo_ouvido: { ouvido: "bool" },
  previas_abertas: {},
  previa_tocada: {},
  link_aberto: { destino: "texto" },
};

let arquivo = null; // caminho do telemetria.json
let versao = "0.0.0";
let estado = { escolha: null, id: null, fila: [] }; // escolha: null (não perguntado), true ou false
let enviando = false;
let relogio = null;

function disponivel() {
  return Boolean(SUPABASE_URL && SUPABASE_CHAVE);
}

function salvar() {
  try {
    fs.mkdirSync(path.dirname(arquivo), { recursive: true });
    fs.writeFileSync(arquivo, JSON.stringify(estado));
  } catch {
    // sem disco: as estatísticas não são importantes o bastante para atrapalhar o app
  }
}

function iniciar({ caminho, versaoApp }) {
  arquivo = caminho;
  versao = versaoApp;
  try {
    const lido = JSON.parse(fs.readFileSync(arquivo, "utf8"));
    estado = { escolha: null, id: null, fila: [], ...lido };
    if (!Array.isArray(estado.fila)) estado.fila = [];
  } catch {
    // primeira vez
  }
  if (!disponivel()) return;
  if (estado.escolha === true) {
    clearInterval(relogio);
    relogio = setInterval(enviar, INTERVALO_ENVIO);
    enviar();
  }
}

// O que a interface pode saber.
function situacao() {
  return { disponivel: disponivel(), escolha: estado.escolha };
}

function escolher(sim) {
  estado.escolha = Boolean(sim);
  if (estado.escolha) {
    estado.id = estado.id || crypto.randomUUID();
    clearInterval(relogio);
    relogio = setInterval(enviar, INTERVALO_ENVIO);
  } else {
    estado.fila = []; // quem desliga não envia nem o que estava na fila
    clearInterval(relogio);
  }
  salvar();
  return situacao();
}

// Mantém só os campos previstos para o evento, com tipo e tamanho conferidos.
function limpar(evento, dados = {}) {
  const regras = EVENTOS[evento];
  const saida = {};
  for (const [campo, tipo] of Object.entries(regras)) {
    const v = dados[campo];
    if (tipo === "texto" && typeof v === "string") saida[campo] = v.slice(0, 40);
    else if (tipo === "numero" && Number.isFinite(v)) saida[campo] = Math.round(v);
    else if (tipo === "bool" && typeof v === "boolean") saida[campo] = v;
    else if (tipo === "lista" && Array.isArray(v)) saida[campo] = v.filter((x) => typeof x === "string").map((x) => x.slice(0, 40)).slice(0, 5);
  }
  return saida;
}

function registrar(evento, dados) {
  if (!disponivel() || estado.escolha !== true || !EVENTOS[evento]) return;
  estado.fila.push({
    instalacao: estado.id,
    evento,
    dados: limpar(evento, dados),
    versao,
    sistema: process.platform,
    criado_em: new Date().toISOString(),
  });
  if (estado.fila.length > MAX_FILA) estado.fila.splice(0, estado.fila.length - MAX_FILA);
  salvar();
  if (estado.fila.length >= LOTE) enviar();
}

async function postar(caminho, corpo) {
  const resp = await fetch(SUPABASE_URL.replace(/\/+$/, "") + caminho, {
    method: "POST",
    headers: { apikey: SUPABASE_CHAVE, "Content-Type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify(corpo),
    signal: AbortSignal.timeout(10000),
  });
  if (!resp.ok) throw new Error(`Supabase respondeu ${resp.status}: ${(await resp.text().catch(() => "")).slice(0, 200)}`);
}

// Manda a fila em lotes. Falhou? Tenta de novo no próximo ciclo.
async function enviar() {
  if (!disponivel() || estado.escolha !== true || enviando || !estado.fila.length) return;
  enviando = true;
  try {
    while (estado.fila.length && estado.escolha === true) {
      const lote = estado.fila.slice(0, LOTE);
      await postar("/rest/v1/eventos", lote);
      estado.fila.splice(0, lote.length);
      salvar();
    }
  } catch {
    // sem internet ou Supabase fora do ar: fica para depois
  } finally {
    enviando = false;
  }
}

// Apaga do servidor tudo o que esta instalação já enviou e troca o id.
async function apagarEnviados() {
  if (!disponivel()) throw new Error("Estatísticas não estão disponíveis nesta versão.");
  if (estado.id) await postar("/rest/v1/rpc/apagar_instalacao", { p_instalacao: estado.id });
  estado.id = estado.escolha === true ? crypto.randomUUID() : null;
  estado.fila = [];
  salvar();
}

module.exports = { iniciar, situacao, escolher, registrar, enviar, apagarEnviados, EVENTOS };
