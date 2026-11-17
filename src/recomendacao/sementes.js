// Etapa 1: o que a pessoa ouve vira "sementes" com peso de 0 a 1.
//  - Spotify: posição no ranking (o 1º vale 1, o último perto de 0), pois o Spotify não informa contagens;
//  - Last.fm: scrobbles ÷ scrobbles do artista mais ouvido;
//  - lista manual: 0,8.
const lastfm = require("../servicos/lastfm");
const spotify = require("../servicos/spotify");
const { normalizar } = require("../comum/texto");
const { emLotes } = require("../comum/lotes");
const { limparTags } = require("./tags");

// Período escolhido na tela -> parâmetro de cada serviço.
const PERIODOS = {
  curto: { lastfm: "1month", spotify: "short_term" },
  medio: { lastfm: "6month", spotify: "medium_term" },
  longo: { lastfm: "overall", spotify: "long_term" },
};

const PESO_MANUAL = 0.8;

/**
 * Lê as fontes e devolve:
 *  - pesos: Map(nome normalizado -> { nome, peso, tags }) com tudo o que a pessoa ouve;
 *  - usadas: nomes das fontes que trouxeram algum artista;
 *  - avisos: problemas com fontes que falharam (as outras seguem).
 */
async function coletarSementes(fontes, periodo, progresso) {
  const p = PERIODOS[periodo] || PERIODOS.longo;
  const pesos = new Map();
  const usadas = [];
  const avisos = [];

  // Se o artista vem de mais de uma fonte, fica o maior peso e as tags se somam.
  function somar(lista, origem) {
    if (!lista.length) return;
    usadas.push(origem);
    for (const { nome, peso, tags } of lista) {
      const chave = normalizar(nome);
      const atual = pesos.get(chave);
      const juntas = limparTags([...(atual?.tags || []), ...(tags || [])]);
      if (!atual || peso > atual.peso) pesos.set(chave, { nome, peso, tags: juntas });
      else atual.tags = juntas;
    }
  }

  if (fontes.spotifyToken) {
    progresso("Lendo seus top artistas no Spotify...");
    try {
      const top = await spotify.topArtistas(fontes.spotifyToken, p.spotify);
      somar(top.map((a, i) => ({ nome: a.nome, peso: (top.length - i) / top.length, tags: a.generos })), "Spotify");
    } catch (e) {
      avisos.push("Spotify: " + e.message);
    }
  }

  if (fontes.lastfm) {
    progresso("Lendo seus top artistas no Last.fm...");
    try {
      const top = await lastfm.topArtistas(fontes.lastfm.apiKey, fontes.lastfm.usuario, p.lastfm);
      const maior = top[0]?.scrobbles || 1;
      somar(top.map((a) => ({ nome: a.nome, peso: a.scrobbles / maior })), "Last.fm");
    } catch (e) {
      avisos.push("Last.fm: " + e.message);
    }
  }

  somar((fontes.manual || []).map((nome) => ({ nome, peso: PESO_MANUAL })), "sua lista");

  return { pesos, usadas, avisos };
}

// As N sementes mais fortes.
function maisFortes(pesos, quantidade) {
  return [...pesos.values()].sort((a, b) => b.peso - a.peso).slice(0, quantidade);
}

// Gêneros das sementes que o Spotify não informou: tags do Last.fm, se houver chave.
async function completarGeneros(base, chaveLastfm, progresso) {
  const semTags = base.filter((s) => !s.tags.length);
  if (!chaveLastfm || !semTags.length) return;
  progresso("Descobrindo os estilos dos seus artistas...");
  await emLotes(semTags, 4, async (s) => {
    try {
      s.tags = limparTags(await lastfm.tags(chaveLastfm, s.nome));
    } catch {
      // sem tags: a semente cai em "Outros"
    }
  });
}

module.exports = { PERIODOS, coletarSementes, maisFortes, completarGeneros };
