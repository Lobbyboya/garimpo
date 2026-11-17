// API do Last.fm (com a chave da pessoa): top artistas de um usuário, similares e tags.
const { buscar } = require("../comum/rede");

const API = "https://ws.audioscrobbler.com/2.0/";

const ERROS = {
  6: "Não encontrado no Last.fm. Confira o nome de usuário.", // código 6 vale para usuário e artista
  10: "Chave de API do Last.fm inválida.",
  26: "Chave de API suspensa pelo Last.fm.",
  29: "Limite de requisições do Last.fm atingido. Espere um pouco e tente de novo.",
};

async function chamar(params, apiKey) {
  const url = new URL(API);
  for (const [k, v] of Object.entries({ ...params, api_key: apiKey, format: "json" })) {
    url.searchParams.set(k, v);
  }
  const resp = await buscar(url, { servico: "Last.fm", headers: { "User-Agent": "Garimpo/1.0" } });
  let dados;
  try {
    dados = await resp.json();
  } catch {
    throw new Error(`Resposta inválida do Last.fm (HTTP ${resp.status}).`);
  }
  if (dados.error) throw new Error(ERROS[dados.error] || dados.message || `Erro ${dados.error} do Last.fm.`);
  return dados;
}

// period: overall, 7day, 1month, 3month, 6month ou 12month.
async function topArtistas(apiKey, usuario, period, limite = 500) {
  const top = await chamar({ method: "user.gettopartists", user: usuario, period, limit: limite }, apiKey);
  return (top.topartists?.artist || []).map((a) => ({ nome: a.name, scrobbles: Number(a.playcount) || 0 }));
}

async function similares(apiKey, nome) {
  const r = await chamar({ method: "artist.getsimilar", artist: nome, limit: 30, autocorrect: 1 }, apiKey);
  return (r.similarartists?.artist || []).map((s) => ({ nome: s.name, match: Number(s.match) || 0, lastfm: s.url }));
}

// Tags mais votadas do artista (gêneros, na prática), da mais forte para a mais fraca.
async function tags(apiKey, nome) {
  const r = await chamar({ method: "artist.gettoptags", artist: nome, autocorrect: 1 }, apiKey);
  return (r.toptags?.tag || [])
    .filter((t) => Number(t.count) >= 20)
    .slice(0, 6)
    .map((t) => t.name);
}

module.exports = { topArtistas, similares, tags };
