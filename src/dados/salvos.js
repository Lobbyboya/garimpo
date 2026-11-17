// salvos.json: artistas que a pessoa guardou para ouvir depois. Separados do cache de
// propósito: as recomendações mudam com o tempo, os salvos não.
const { caminho } = require("./arquivos");
const { lerJson, salvarJson } = require("../comum/json");
const { normalizar, textoCurto, linkHttps } = require("../comum/texto");

const MAX_SALVOS = 1000;
const arquivo = () => caminho("salvos.json");

function listar() {
  const lista = lerJson(arquivo(), []);
  return Array.isArray(lista) ? lista : [];
}

// Só guarda texto curto e links https: o arquivo é lido de volta pela interface.
function limparArtista(a = {}) {
  return {
    nome: textoCurto(a.nome),
    genero: textoCurto(a.genero, 60) || null,
    grupo: textoCurto(a.grupo, 60) || null,
    img: linkHttps(a.img),
    spotify: linkHttps(a.spotify),
    spotifyDireto: Boolean(a.spotifyDireto),
    lastfm: linkHttps(a.lastfm),
    deezer: linkHttps(a.deezer),
    sementes: (Array.isArray(a.sementes) ? a.sementes : []).map((s) => textoCurto(s, 100)).filter(Boolean).slice(0, 10),
  };
}

const mesmoArtista = (a, b) => normalizar(a) === normalizar(b);

// Salva o artista (com uma cópia dos dados de agora, já que ele pode sumir das recomendações)
// ou tira dos salvos, se já estava. Devolve { lista, adicionado }.
function alternar(artista) {
  const novo = limparArtista(artista);
  if (!novo.nome) throw new Error("Artista sem nome.");
  const lista = listar();
  const i = lista.findIndex((s) => mesmoArtista(s.nome, novo.nome));
  if (i >= 0) lista.splice(i, 1);
  else lista.unshift({ ...novo, salvoEm: new Date().toISOString(), ouvido: false });
  salvarJson(arquivo(), lista.slice(0, MAX_SALVOS));
  return { lista, adicionado: i < 0 };
}

// Devolve { lista, alterado } (alterado = false se o artista não estava salvo).
function marcarOuvido(nome, ouvido) {
  const lista = listar();
  const item = lista.find((s) => mesmoArtista(s.nome, nome));
  if (item) {
    item.ouvido = Boolean(ouvido);
    salvarJson(arquivo(), lista);
  }
  return { lista, alterado: Boolean(item) };
}

module.exports = { listar, alternar, marcarOuvido };
