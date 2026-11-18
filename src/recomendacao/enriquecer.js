// Etapa 3: completa as recomendações com link direto do Spotify, gênero e foto.
const lastfm = require("../servicos/lastfm");
const spotify = require("../servicos/spotify");
const deezer = require("../servicos/deezer");
const { emLotes } = require("../comum/lotes");
const { limparTags } = require("./tags");

// Com o Spotify conectado: link direto para a página do artista, foto e gênero.
async function comSpotify(recs, token, progresso) {
  if (!token || !recs.length) return;
  progresso("Procurando os artistas no Spotify...");
  let parar = false;
  await emLotes(recs, 3, async (r) => {
    if (parar) return;
    try {
      const a = await spotify.buscarArtista(token, r.nome);
      if (!a) return;
      if (a.link) {
        r.spotify = a.link;
        r.spotifyDireto = true;
      }
      r.img = r.img || a.img;
      r.genero = limparTags(a.generos)[0] || null;
    } catch (e) {
      if (e.codigo === 429 || e.codigo === 401 || e.codigo === 403) parar = true; // os demais ficam com o link de busca
    }
  });
}

// Quem ficou sem gênero: a tag mais votada no Last.fm.
async function generosLastfm(recs, chaveLastfm, progresso) {
  const semGenero = recs.filter((r) => !r.genero);
  if (!chaveLastfm || !semGenero.length) return;
  progresso("Descobrindo o estilo de cada recomendação...");
  await emLotes(semGenero, 4, async (r) => {
    try {
      r.genero = limparTags(await lastfm.tags(chaveLastfm, r.nome))[0] || null;
    } catch {
      // fica sem gênero
    }
  });
}

// Completa pelo Deezer o que faltou: foto, número de fãs (para "pouco conhecidos") e o link do
// artista lá (que deixa as prévias certeiras). Um artista que falhar não atrapalha os outros.
async function dadosDeezer(recs, progresso) {
  const faltando = recs.filter((r) => !r.img || r.fas == null || !r.deezer);
  if (!faltando.length) return;
  progresso("Completando fotos e popularidade dos artistas...");
  await emLotes(faltando, 3, async (r) => {
    try {
      const a = await deezer.buscarArtista(r.nome);
      if (!a) return;
      r.img = r.img || a.foto;
      r.fas = r.fas ?? a.fas;
      r.deezer = r.deezer || a.link;
    } catch {
      // sem dados extras: o cartão mostra a inicial e fica fora do filtro "pouco conhecidos"
    }
  });
}

module.exports = { comSpotify, generosLastfm, dadosDeezer };
