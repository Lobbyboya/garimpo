// Contas da pessoa: login do Spotify (e o token sempre válido) e chave do Last.fm.
const { shell } = require("electron");
const config = require("../dados/config");
const segredos = require("../dados/segredos");
const spotifyLogin = require("../servicos/spotify-login");
const spotify = require("../servicos/spotify");
const lastfm = require("../servicos/lastfm");

const MARGEM_EXPIRACAO = 60_000;

// ---------- Spotify ----------

// Lê um segredo; se o cofre do sistema estiver fechado, o login continua guardado e só avisamos.
function lerSegredoOuAvisar(guardado) {
  try {
    return segredos.ler(guardado);
  } catch (e) {
    if (e.cofreIndisponivel) throw new Error("O login do Spotify continua salvo, mas " + e.message.charAt(0).toLowerCase() + e.message.slice(1));
    throw e;
  }
}

// Acesso ainda válido guardado? (não decifrável conta como "não": aí tenta renovar)
function acessoGuardado(sp) {
  try {
    const acesso = segredos.ler(sp.access);
    return acesso && sp.expira > Date.now() + MARGEM_EXPIRACAO ? acesso : "";
  } catch {
    return "";
  }
}

// Renova com o token de renovação guardado e salva os tokens novos.
async function renovarSpotify(atual) {
  const sp = atual.spotify;
  const novo = await spotifyLogin.renovar(config.clientIdSpotify(atual), lerSegredoOuAvisar(sp.refresh));
  config.alterar((c) => {
    c.spotify = {
      ...sp,
      access: segredos.guardar(novo.access),
      expira: novo.expira,
      refresh: novo.refresh ? segredos.guardar(novo.refresh) : sp.refresh,
    };
  });
  return novo.access;
}

// Devolve um token de acesso válido do Spotify, renovando se preciso. null se não conectado.
async function tokenSpotify() {
  const atual = config.ler();
  if (!atual.spotify?.refresh) return null;
  const acesso = acessoGuardado(atual.spotify);
  if (acesso) return acesso;
  try {
    return await renovarSpotify(atual);
  } catch (e) {
    if (e.codigo !== "invalid_grant") throw e;
    // O Spotify troca o token de renovação a cada uso. Se outro processo acabou de renovar,
    // o nosso ficou velho: relê a config e tenta uma vez com o novo antes de desistir.
    const releitura = config.ler();
    if (JSON.stringify(releitura.spotify?.refresh) !== JSON.stringify(atual.spotify.refresh)) {
      return renovarSpotify(releitura);
    }
    config.alterar((c) => (c.spotify = null)); // acesso revogado de verdade: precisa conectar de novo
    throw e;
  }
}

// Abre o navegador para a pessoa autorizar e guarda o login. Devolve a config pública.
async function conectarSpotify() {
  const clientId = config.clientIdSpotify(config.ler());
  if (!clientId) throw new Error("Informe o Client ID do Spotify primeiro.");
  const tokens = await spotifyLogin.login(clientId, (url) => shell.openExternal(url));
  let nome = "";
  try {
    nome = await spotify.perfil(tokens.access);
  } catch {
    // sem nome: segue conectado mesmo assim
  }
  const nova = config.alterar((c) => {
    c.spotify = { refresh: segredos.guardar(tokens.refresh), access: segredos.guardar(tokens.access), expira: tokens.expira, nome };
  });
  return config.publico(nova);
}

const cancelarLoginSpotify = () => spotifyLogin.cancelarLogin();

const desconectarSpotify = () => config.publico(config.alterar((c) => (c.spotify = null)));

// ---------- Last.fm ----------

// Confere se a chave e o usuário funcionam antes de salvar. Chave vazia = a que já está salva
// ou, se não houver, a que vem no app (aí a pessoa só informa o usuário).
async function testarLastfm({ apiKey, usuario } = {}) {
  const propria = String(apiKey || "").trim();
  const chave = propria || config.chaveLastfm(config.ler());
  const nome = String(usuario || "").trim();
  if (!chave) throw new Error("Cole a sua API key.");
  if (!nome) throw new Error("Informe o seu usuário do Last.fm.");
  await lastfm.topArtistas(chave, nome, "overall", 1);
  return config.publico(config.alterar((c) => {
    if (propria) c.apiKey = propria; // a do app não é copiada para a config
    c.usuario = nome;
  }));
}

// Desconecta o Last.fm: tira a chave própria e o usuário.
const removerLastfm = () => config.publico(config.alterar((c) => {
  c.apiKey = "";
  c.usuario = "";
}));

module.exports = { tokenSpotify, conectarSpotify, cancelarLoginSpotify, desconectarSpotify, testarLastfm, removerLastfm };
