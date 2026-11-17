// Web API do Spotify (com o token da pessoa): perfil, top artistas e busca de artistas.
const { buscar } = require("../comum/rede");
const { normalizar } = require("../comum/texto");

const API = "https://api.spotify.com/v1";

async function chamar(token, caminho) {
  const resp = await buscar(API + caminho, { servico: "Spotify", headers: { Authorization: "Bearer " + token } });
  if (resp.status === 403) {
    throw new Error("O Spotify recusou o acesso. A conta precisa estar na lista de usuários do app (User Management) no painel de desenvolvedor.");
  }
  if (!resp.ok) {
    const e = new Error(resp.status === 429 ? "O Spotify pediu para ir mais devagar." : `Erro ${resp.status} ao falar com o Spotify.`);
    e.codigo = resp.status;
    throw e;
  }
  return resp.json();
}

async function perfil(token) {
  const eu = await chamar(token, "/me");
  return eu.display_name || eu.id || "";
}

// time_range: short_term (~4 semanas), medium_term (~6 meses) ou long_term (~1 ano).
async function topArtistas(token, timeRange) {
  const dados = await chamar(token, `/me/top/artists?limit=50&time_range=${timeRange}`);
  return (dados.items || []).map((a) => ({ nome: a.name, generos: a.genres || [] }));
}

// Procura o artista pelo nome exato. Devolve o link direto, a foto e os gêneros, ou null.
async function buscarArtista(token, nome) {
  const dados = await chamar(token, "/search?type=artist&limit=5&q=" + encodeURIComponent(nome));
  const alvo = normalizar(nome);
  const a = (dados.artists?.items || []).find((x) => normalizar(x?.name) === alvo);
  if (!a) return null;
  return {
    id: a.id,
    link: a.external_urls?.spotify || null,
    img: a.images?.[1]?.url || a.images?.[0]?.url || null,
    generos: a.genres || [],
  };
}

module.exports = { perfil, topArtistas, buscarArtista };
