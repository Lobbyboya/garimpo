// Garimpar: monta as fontes a partir da config, gera as recomendações, guarda no cache e
// registra a estatística do uso.
const recomendacao = require("../recomendacao");
const config = require("../dados/config");
const { caminho } = require("../dados/arquivos");
const { lerJson, salvarJson } = require("../comum/json");
const contas = require("./contas");
const telemetria = require("./telemetria");

const lerCache = () => lerJson(caminho("cache.json"), null);

// Período e quantidade de sementes vindos da tela, já validados.
const PERIODOS_VALIDOS = ["curto", "medio", "longo"];
const escolhasDe = (opcoes) => ({
  periodo: PERIODOS_VALIDOS.includes(opcoes?.periodo) ? opcoes.periodo : "longo",
  sementes: Math.min(Math.max(Number(opcoes?.sementes) || 20, 1), 50),
});

async function gerar(opcoes, progresso) {
  const atual = config.ler();
  const avisos = [];
  let spotifyToken = null;
  try {
    spotifyToken = await contas.tokenSpotify();
  } catch (erro) {
    avisos.push("Spotify: " + erro.message);
  }

  const escolhas = escolhasDe(opcoes);
  const temLastfm = Boolean(atual.apiKey && atual.usuario);
  const fontesLigadas = [spotifyToken && "spotify", temLastfm && "lastfm", atual.manual?.length && "manual"].filter(Boolean);
  const inicio = Date.now();

  let resultado;
  try {
    resultado = await recomendacao.gerar({
      fontes: {
        spotifyToken,
        lastfm: temLastfm ? { apiKey: atual.apiKey, usuario: atual.usuario } : null,
        manual: atual.manual,
      },
      ...escolhas,
      progresso,
    });
  } catch (erro) {
    telemetria.registrar("garimpo", { fontes: fontesLigadas, ...escolhas, duracao_ms: Date.now() - inicio, erro: true });
    throw erro;
  }
  telemetria.registrar("garimpo", {
    fontes: fontesLigadas,
    motor: resultado.motor,
    ...escolhas,
    recomendacoes: resultado.recs.length,
    duracao_ms: Date.now() - inicio,
    erro: false,
  });

  const cache = { ...resultado, opcoes: escolhas, avisos: [...avisos, ...resultado.avisos], geradoEm: new Date().toISOString() };
  salvarJson(caminho("cache.json"), cache);
  return cache;
}

module.exports = { gerar, lerCache };
