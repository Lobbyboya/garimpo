// fetch falso e determinístico: cada teste diz como responder por host/caminho.
// Uso: instalarFetch((url, opcoes) => ({ status: 200, corpo: {...} }) | "sem-conexao")

const chamadas = [];

function resposta({ status = 200, corpo = {} }) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => corpo,
    text: async () => JSON.stringify(corpo),
  };
}

function instalarFetch(responder) {
  chamadas.length = 0;
  global.fetch = async (url, opcoes = {}) => {
    const u = new URL(String(url));
    chamadas.push({ url: u, opcoes });
    const r = await responder(u, opcoes);
    if (r === "sem-conexao") throw new TypeError("fetch failed");
    return resposta(r || { status: 404, corpo: {} });
  };
}

// APIs falsas do Deezer e do Last.fm usadas por vários testes.
const relacionadosDeezer = (base) =>
  Array.from({ length: 6 }, (_, i) => ({
    id: base * 10 + i,
    name: `Rel${(base + i) % 9}`,
    nb_fan: 1000 * (i + 1),
    picture_medium: `https://e-cdns-images.dzcdn.net/images/artist/x${i}/250x250.jpg`,
    link: `https://www.deezer.com/artist/${base * 10 + i}`,
  }));

function apisMusicais(u) {
  if (u.hostname === "api.deezer.com") {
    if (u.pathname === "/search/artist") {
      const q = u.searchParams.get("q");
      return { corpo: { data: [{ id: q.length, name: q, nb_fan: 500, picture_medium: "https://e-cdns-images.dzcdn.net/images/artist/abc/250x250.jpg", link: "https://www.deezer.com/artist/" + q.length }] } };
    }
    if (u.pathname.endsWith("/related")) return { corpo: { data: relacionadosDeezer(Number(u.pathname.split("/")[2])) } };
    if (u.pathname.endsWith("/top")) return { corpo: { data: [{ id: 1, title: "Faixa", preview: "https://cdnt-preview.dzcdn.net/a.mp3", link: "https://www.deezer.com/track/1", duration: 30 }] } };
  }
  if (u.hostname === "ws.audioscrobbler.com") {
    const m = u.searchParams.get("method");
    const artista = u.searchParams.get("artist");
    if (m === "user.gettopartists") return { corpo: { topartists: { artist: [{ name: "A1", playcount: "100" }, { name: "A2", playcount: "50" }, { name: "A3", playcount: "10" }] } } };
    if (m === "artist.getsimilar") return { corpo: { similarartists: { artist: [{ name: "S" + artista, match: "0.9", url: "https://www.last.fm/music/x" }, { name: "Comum", match: "0.5", url: "https://www.last.fm/music/c" }, { name: "A2", match: "1" }] } } };
    if (m === "artist.gettoptags") return { corpo: { toptags: { tag: [{ name: artista === "A3" ? "jazz" : "rock", count: 100 }, { name: "seen live", count: 90 }, { name: "Post-Rock", count: 50 }] } } };
  }
  return null;
}

module.exports = { instalarFetch, chamadas, apisMusicais };
