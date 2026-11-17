// API pública do Deezer (sem chave e sem conta): fotos de artistas, artistas relacionados e top músicas.
const API = "https://api.deezer.com";

const normalizar = (nome) =>
  String(nome || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

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

// Busca artista com tolerância para acentos e prefixos comuns.
async function buscarArtista(nome) {
  try {
    const dados = await chamar("/search/artist?limit=5&q=" + encodeURIComponent(nome));
    const lista = dados.data || [];
    if (!lista.length) return null;
    const alvo = normalizar(nome);
    const alvoSemThe = alvo.replace(/^the\s+/, "");
    const achado =
      lista.find((a) => normalizar(a.name) === alvo) ||
      lista.find((a) => normalizar(a.name).replace(/^the\s+/, "") === alvoSemThe) ||
      (lista[0] && normalizar(lista[0].name).includes(alvoSemThe) ? lista[0] : null);
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

// Top músicas do artista com preview de áudio (30s).
async function topFaixas(id, limite = 3) {
  if (!id) return [];
  try {
    const dados = await chamar(`/artist/${id}/top?limit=${limite}`);
    return (dados.data || []).map((t) => ({
      id: t.id,
      titulo: t.title,
      preview: t.preview, // áudio mp3 de 30s
      link: t.link,
      duracao: t.duration,
    }));
  } catch {
    return [];
  }
}

module.exports = { buscarArtista, relacionados, topFaixas };
