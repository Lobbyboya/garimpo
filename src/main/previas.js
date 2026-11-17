// Prévias de 30 s: top músicas de um artista no Deezer, já conferidas para a interface.
const deezer = require("../servicos/deezer");
const { textoCurto } = require("../comum/texto");
const telemetria = require("./telemetria");

// Só passa áudio https do CDN do Deezer, que é o único liberado na CSP da interface.
function doCdnDeezer(url) {
  try {
    const u = new URL(url);
    return u.protocol === "https:" && u.hostname.endsWith(".dzcdn.net");
  } catch {
    return false;
  }
}

// Com o id do Deezer (quando a recomendação veio de lá) não há risco de pegar outro artista
// com nome parecido; sem ele, busca pelo nome.
async function topFaixas({ nome, deezerId } = {}) {
  let id = /^\d{1,12}$/.test(String(deezerId || "")) ? String(deezerId) : null;
  if (!id) {
    const alvo = textoCurto(nome);
    if (!alvo) return [];
    id = (await deezer.buscarArtista(alvo))?.id || null;
  }
  telemetria.registrar("previas_abertas");
  const faixas = await deezer.topFaixas(id, 3);
  return faixas.map((f) => ({
    titulo: String(f.titulo || ""),
    preview: doCdnDeezer(f.preview) ? f.preview : null,
    link: f.link || null,
  }));
}

module.exports = { topFaixas };
