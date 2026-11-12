// API pública do Deezer (sem chave e sem conta): fotos de artistas e artistas relacionados.
const API = "https://api.deezer.com";

const normalizar = (nome) => nome.trim().toLowerCase();
const espera = (ms) => new Promise((ok) => setTimeout(ok, ms));

async function chamar(caminho, tentativa = 0) {
  const resp = await fetch(API + caminho, { signal: AbortSignal.timeout(10000) });
  const dados = await resp.json();
  if (dados.error) {
    // Código 4 = limite de requisições (50 a cada 5 segundos): espera e tenta de novo.
    if (dados.error.code === 4 && tentativa < 4) {
      await espera(1500);
      return chamar(caminho, tentativa + 1);
    }
    throw new Error(dados.error.message || "Erro do Deezer.");
  }
  return dados;
}

function foto(artista) {
  const url = artista?.picture_medium;
  // Artista sem foto vem com o caminho ".../artist//250x250..." (imagem padrão).
  return url && !url.includes("/artist//") ? url : null;
}

function converter(a) {
  return { id: a.id, nome: a.name, foto: foto(a), link: a.link };
}

// Só aceita nome idêntico, para não confundir com outro artista. Devolve null se não achar.
async function buscarArtista(nome) {
  try {
    const dados = await chamar("/search/artist?limit=5&q=" + encodeURIComponent(nome));
    const achado = (dados.data || []).find((a) => normalizar(a.name) === normalizar(nome));
    return achado ? converter(achado) : null;
  } catch {
    return null;
  }
}

async function relacionados(id) {
  try {
    const dados = await chamar(`/artist/${id}/related?limit=30`);
    return (dados.data || []).map(converter);
  } catch {
    return [];
  }
}

module.exports = { buscarArtista, relacionados };
