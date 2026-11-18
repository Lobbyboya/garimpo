// config.json: usuário e chave do Last.fm, Client ID e login do Spotify, lista manual.
const { app } = require("electron");
const { caminho } = require("./arquivos");
const { lerJsonProtegido, salvarJson } = require("../comum/json");
const { REDIRECT } = require("../servicos/spotify-login");

// Client ID do Spotify que já vem no app. Vazio = cada pessoa informa o seu em Configurações.
// O Client ID não é segredo (o login usa PKCE), mas o Spotify limita cada um a 5 usuários.
const SPOTIFY_CLIENT_ID_PADRAO = "";

// Chave de API do Last.fm que já vem no app. Preenchida, a pessoa só digita o usuário do Last.fm.
// A chave é da aplicação, não da pessoa, e o app só lê dados públicos (top artistas, similares,
// tags). Crie em https://www.last.fm/api/account/create com a SUA conta. A variável de ambiente
// serve para testes.
const LASTFM_CHAVE_PADRAO = process.env.GARIMPO_LASTFM_CHAVE || "";

// A chave própria da pessoa, se ela tiver colado uma; senão a do app.
const chaveLastfm = (config) => config.apiKey || LASTFM_CHAVE_PADRAO;

const PADRAO = { apiKey: "", usuario: "", spotifyClientId: "", spotify: null, manual: [], aparencia: null };

const MODOS = ["sistema", "claro", "escuro"];

// Aparência sempre válida: modo conhecido e tema com nome simples (a interface conhece a lista;
// um tema que ela não conhece vira o padrão lá).
function limparAparencia(a) {
  return {
    modo: MODOS.includes(a?.modo) ? a.modo : "sistema",
    tema: typeof a?.tema === "string" && /^[a-z0-9-]{1,30}$/.test(a.tema) ? a.tema : "garimpo",
  };
}

// Se o config.json estiver corrompido, usa a cópia de segurança (config.json.bak).
const ler = () => ({ ...PADRAO, ...lerJsonProtegido(caminho("config.json"), {}).dados });
const salvar = (config) => salvarJson(caminho("config.json"), config, { backup: true });

// Lê, aplica a mudança e salva. Devolve a config nova.
function alterar(mudanca) {
  const config = ler();
  mudanca(config);
  salvar(config);
  return config;
}

const clientIdSpotify = (config) => config.spotifyClientId || SPOTIFY_CLIENT_ID_PADRAO;

// O que a interface pode ver: nunca a chave nem os tokens.
function publico(config = ler()) {
  return {
    versao: app.getVersion(),
    usuario: config.usuario,
    temChave: Boolean(chaveLastfm(config)),
    temChavePropria: Boolean(config.apiKey),
    temChavePadraoLastfm: Boolean(LASTFM_CHAVE_PADRAO),
    spotifyClientId: config.spotifyClientId,
    temClientIdPadrao: Boolean(SPOTIFY_CLIENT_ID_PADRAO),
    spotifyConectado: Boolean(config.spotify?.refresh),
    spotifyNome: config.spotify?.nome || "",
    spotifyRedirect: REDIRECT,
    manual: config.manual,
    aparencia: limparAparencia(config.aparencia),
  };
}

// Lista manual: sem vazios, sem repetidos (ignorando maiúsculas), no máximo 100 de até 100 letras.
function limparLista(lista) {
  if (!Array.isArray(lista)) return null;
  const vistos = new Set();
  return lista
    .map((s) => String(s).trim().slice(0, 100))
    .filter((s) => s && !vistos.has(s.toLowerCase()) && vistos.add(s.toLowerCase()))
    .slice(0, 100);
}

// Campos da tela de Configurações. Ausentes (undefined) ficam como estão; apiKey vazia mantém a atual.
function atualizarCampos(dados = {}) {
  return alterar((config) => {
    if (typeof dados.usuario === "string") config.usuario = dados.usuario.trim();
    if (typeof dados.apiKey === "string" && dados.apiKey.trim()) config.apiKey = dados.apiKey.trim();
    if (typeof dados.spotifyClientId === "string") {
      const novo = dados.spotifyClientId.trim();
      if (novo !== config.spotifyClientId) config.spotify = null; // outro app do Spotify: login antigo não vale
      config.spotifyClientId = novo;
    }
    const manual = limparLista(dados.manual);
    if (manual) config.manual = manual;
    if (dados.aparencia && typeof dados.aparencia === "object") {
      config.aparencia = limparAparencia({ ...limparAparencia(config.aparencia), ...dados.aparencia });
    }
  });
}

module.exports = { ler, salvar, alterar, clientIdSpotify, chaveLastfm, publico, atualizarCampos, limparAparencia };
