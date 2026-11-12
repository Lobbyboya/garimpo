// Junta o que a pessoa ouve (Spotify, Last.fm e/ou lista manual) e pontua artistas parecidos.
const lastfm = require("./lastfm");
const spotify = require("./spotify");
const deezer = require("./deezer");

// Período escolhido na tela -> parâmetro de cada serviço.
const PERIODOS = {
  curto: { lastfm: "1month", spotify: "short_term" },
  medio: { lastfm: "6month", spotify: "medium_term" },
  longo: { lastfm: "overall", spotify: "long_term" },
};

const normalizar = (nome) => nome.trim().toLowerCase();
const linkSpotify = (nome) => "https://open.spotify.com/search/" + encodeURIComponent(nome);

// Executa fn em cada item com no máximo `limite` chamadas ao mesmo tempo.
async function emLotes(itens, limite, fn) {
  const saida = new Array(itens.length);
  let proximo = 0;
  async function trabalhador() {
    while (proximo < itens.length) {
      const i = proximo++;
      saida[i] = await fn(itens[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limite, itens.length) }, trabalhador));
  return saida;
}

/**
 * fontes: { lastfm: {apiKey, usuario} | null, spotifyToken: string | null, manual: string[] }
 *
 * Cada artista que a pessoa ouve vira uma "semente" com peso de 0 a 1:
 *  - Last.fm: scrobbles ÷ scrobbles do artista mais ouvido;
 *  - Spotify: posição no ranking (o 1º vale 1, o último perto de 0), pois o Spotify não informa contagens;
 *  - lista manual: 0,8.
 * Os similares das N sementes mais fortes ganham pontos = match × peso da semente, somados.
 * A similaridade vem do Last.fm quando há chave; sem chave, dos "relacionados" do Deezer.
 */
async function gerar({ fontes, periodo, sementes, progresso = () => {} }) {
  const p = PERIODOS[periodo] || PERIODOS.longo;
  const pesos = new Map(); // nome normalizado -> { nome, peso }
  const usadas = [];
  const avisos = [];

  function somar(lista, origem) {
    if (!lista.length) return;
    usadas.push(origem);
    for (const { nome, peso } of lista) {
      const chave = normalizar(nome);
      const atual = pesos.get(chave);
      if (!atual || peso > atual.peso) pesos.set(chave, { nome, peso });
    }
  }

  if (fontes.spotifyToken) {
    progresso("Lendo seus top artistas no Spotify...");
    try {
      const top = await spotify.topArtistas(fontes.spotifyToken, p.spotify);
      somar(top.map((a, i) => ({ nome: a.nome, peso: (top.length - i) / top.length })), "Spotify");
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

  somar((fontes.manual || []).map((nome) => ({ nome, peso: 0.8 })), "sua lista");

  if (!pesos.size) {
    throw new Error(avisos.length
      ? avisos.join(" ")
      : "Nenhum artista encontrado. Conecte o Spotify, configure o Last.fm ou liste artistas em Configurações.");
  }

  const base = [...pesos.values()].sort((a, b) => b.peso - a.peso).slice(0, sementes);
  const usarLastfm = Boolean(fontes.lastfm?.apiKey);

  let feitos = 0;
  const similares = await emLotes(base, usarLastfm ? 4 : 3, async (semente) => {
    try {
      if (usarLastfm) return await lastfm.similares(fontes.lastfm.apiKey, semente.nome);
      const artista = await deezer.buscarArtista(semente.nome);
      if (!artista) return [];
      const rel = await deezer.relacionados(artista.id);
      // O Deezer só dá a ordem: o 1º relacionado vale 1 e o último 0,4.
      return rel.map((r, i) => ({ nome: r.nome, match: 1 - 0.6 * (i / rel.length), img: r.foto, deezer: r.link }));
    } catch {
      return []; // um artista sem similares não derruba o resto
    } finally {
      feitos++;
      progresso(`Buscando parecidos (${feitos}/${base.length}): ${semente.nome}`);
    }
  });

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

  const recs = [...pontos.values()]
    .sort((a, b) => b.pontos - a.pontos)
    .slice(0, 60)
    .map((r) => ({
      nome: r.nome,
      pontos: Number(r.pontos.toFixed(3)),
      sementes: r.sementes.sort((a, b) => b.peso - a.peso).map((s) => s.nome),
      img: r.img,
      spotify: linkSpotify(r.nome),
      lastfm: r.lastfm,
      deezer: r.deezer,
    }));

  const semFoto = recs.filter((r) => !r.img);
  if (semFoto.length) {
    progresso("Buscando fotos dos artistas...");
    await emLotes(semFoto, 3, async (r) => {
      r.img = (await deezer.buscarArtista(r.nome))?.foto || null;
    });
  }

  if (!recs.length) avisos.push("Nenhum artista parecido foi encontrado para essas sementes.");
  progresso(`Pronto: ${recs.length} recomendações.`);
  return {
    periodo,
    fontes: usadas,
    motor: usarLastfm ? "Last.fm" : "Deezer",
    sementes: base.map((a) => a.nome),
    avisos,
    recs,
  };
}

module.exports = { gerar };
