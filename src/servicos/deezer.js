// API pública do Deezer (sem chave e sem conta): fotos de artistas, artistas relacionados e top músicas.
const { buscar } = require("../comum/rede");
const { semAcento: normalizar } = require("../comum/texto");

const API = "https://api.deezer.com";

const espera = (ms) => new Promise((ok) => setTimeout(ok, ms));

async function chamar(caminho, tentativa = 0) {
  const resp = await buscar(API + caminho, { servico: "Deezer", tempo: 10000 });
  const dados = await resp.json().catch(() => {
    throw new Error(`Resposta inválida do Deezer (HTTP ${resp.status}).`);
  });
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
  return { id: a.id, nome: a.name, foto: foto(a), link: a.link, fas: Number.isFinite(a.nb_fan) ? a.nb_fan : null };
}

// Entre os do mesmo nome, o mais conhecido (há vários "Air" no Deezer; o certo tem mais fãs).
const maisFas = (lista) => lista.reduce((melhor, a) => ((a.nb_fan || 0) > (melhor.nb_fan || 0) ? a : melhor));

// Busca o artista pelo nome, ignorando acentos e um "The" no começo. Nada de "contém":
// "Air" não é "Air Supply". Devolve null se não achar; sem conexão, lança o erro.
async function buscarArtista(nome) {
  const dados = await chamar("/search/artist?limit=10&q=" + encodeURIComponent(nome));
  const lista = dados.data || [];
  const alvo = normalizar(nome);
  const semThe = (n) => normalizar(n).replace(/^the\s+/, "");
  const iguais = lista.filter((a) => normalizar(a.name) === alvo);
  const parecidos = iguais.length ? iguais : lista.filter((a) => semThe(a.name) === semThe(nome));
  return parecidos.length ? converter(maisFas(parecidos)) : null;
}

// Os erros de rede sobem para quem chamou decidir (ex.: avisar "sem conexão").
async function relacionados(id) {
  const dados = await chamar(`/artist/${id}/related?limit=30`);
  return (dados.data || []).map(converter);
}

// Top músicas do artista com prévia de áudio (30 s).
async function topFaixas(id, limite = 3) {
  if (!id) return [];
  const dados = await chamar(`/artist/${id}/top?limit=${limite}`);
  return (dados.data || []).map((t) => ({
    id: t.id,
    titulo: t.title,
    preview: t.preview, // áudio mp3 de 30 s
    link: t.link,
    duracao: t.duration,
  }));
}

module.exports = { buscarArtista, relacionados, topFaixas };
