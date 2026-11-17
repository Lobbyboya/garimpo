// Etapa 2: artistas parecidos com cada semente, e a pontuação de cada um.
// A similaridade vem do Last.fm quando há chave; sem chave, dos "relacionados" do Deezer.
const lastfm = require("../servicos/lastfm");
const deezer = require("../servicos/deezer");
const { normalizar } = require("../comum/texto");
const { emLotes } = require("../comum/lotes");

const MAX_RECOMENDACOES = 60;

// Devolve { listas, semConexao }: listas = parecidos de cada semente, na ordem de `base`;
// semConexao = quantas buscas falharam por falta de conexão (e não por "artista desconhecido").
async function buscarSimilares(base, chaveLastfm, progresso) {
  let feitos = 0;
  let semConexao = 0;
  const listas = await emLotes(base, chaveLastfm ? 4 : 3, async (semente) => {
    try {
      if (chaveLastfm) return await lastfm.similares(chaveLastfm, semente.nome);
      const artista = await deezer.buscarArtista(semente.nome);
      if (!artista) return [];
      const rel = await deezer.relacionados(artista.id);
      // O Deezer só dá a ordem: o 1º relacionado vale 1 e o último 0,4.
      return rel.map((r, i) => ({ nome: r.nome, match: 1 - 0.6 * (i / rel.length), img: r.foto, deezer: r.link }));
    } catch (e) {
      if (e.semConexao) semConexao++;
      return []; // um artista sem similares não derruba o resto
    } finally {
      feitos++;
      progresso(`Buscando parecidos (${feitos}/${base.length}): ${semente.nome}`);
    }
  });
  return { listas, semConexao };
}

/**
 * Cada parecido soma `similaridade × peso da semente`. Quem a pessoa já ouve (está em `pesos`)
 * fica de fora. Devolve as melhores recomendações, já no formato que vai para a tela.
 */
function pontuar(base, similares, pesos) {
  const pontos = new Map();
  base.forEach((semente, i) => {
    for (const s of similares[i]) {
      const chave = normalizar(s.nome);
      if (pesos.has(chave)) continue; // a pessoa já ouve
      const contribuicao = s.match * semente.peso;
      const atual = pontos.get(chave) || { nome: s.nome, pontos: 0, sementes: [], img: null, lastfm: null, deezer: null };
      atual.pontos += contribuicao;
      atual.sementes.push({ nome: semente.nome, peso: contribuicao });
      atual.img = atual.img || s.img || null;
      atual.lastfm = atual.lastfm || s.lastfm || null;
      atual.deezer = atual.deezer || s.deezer || null;
      pontos.set(chave, atual);
    }
  });

  return [...pontos.values()]
    .sort((a, b) => b.pontos - a.pontos)
    .slice(0, MAX_RECOMENDACOES)
    .map((r) => ({
      nome: r.nome,
      pontos: Number(r.pontos.toFixed(3)),
      sementes: r.sementes.sort((a, b) => b.peso - a.peso).map((s) => s.nome),
      grupo: null,
      genero: null,
      img: r.img,
      spotify: "https://open.spotify.com/search/" + encodeURIComponent(r.nome),
      spotifyDireto: false,
      lastfm: r.lastfm,
      deezer: r.deezer,
    }));
}

module.exports = { buscarSimilares, pontuar, MAX_RECOMENDACOES };
