// Contas dentro das Configurações: conectar o Spotify e os guias do Spotify e do Last.fm.
import { $, msg, limparErro } from "./util.js";
import { estado } from "./estado.js";
import { configMudou, salvarCampos } from "./config.js";

const URL_LASTFM = "https://www.last.fm/api/account/create";
const URL_SPOTIFY = "https://developer.spotify.com/dashboard";

async function conectarSpotify() {
  // Durante o login o mesmo botão cancela, para ninguém ficar preso esperando o prazo de 5 minutos.
  if (estado.conectandoSpotify) {
    await window.api.cancelarSpotify();
    return;
  }
  const botao = $("spConectar");
  try {
    await salvarCampos();
    if (!estado.config.spotifyClientId && !estado.config.temClientIdPadrao) {
      msg("spMsg", "Cole o Client ID primeiro. Veja \"Como conseguir um Client ID\".", "erro");
      return;
    }
    estado.conectandoSpotify = true;
    botao.textContent = "Cancelar login";
    msg("spMsg", "Abrimos o Spotify no seu navegador. Autorize lá e volte para cá.");
    estado.config = await window.api.conectarSpotify();
    msg("spMsg", "Spotify conectado.", "ok");
  } catch (e) {
    msg("spMsg", limparErro(e), "erro");
  } finally {
    estado.conectandoSpotify = false;
    botao.disabled = false;
    configMudou();
  }
}

async function testarLastfm() {
  const chave = $("lfChave").value.trim();
  if (chave && !/^[0-9a-f]{32}$/i.test(chave)) {
    msg("lfMsg", "A API key tem 32 letras e números. Confira se copiou a API key inteira, e não o Shared secret pela metade.", "erro");
    return;
  }
  const botao = $("lfTestar");
  botao.disabled = true;
  msg("lfMsg", "Testando com o Last.fm...");
  try {
    configMudou(await window.api.testarLastfm({ apiKey: chave, usuario: $("lfUsuario").value }));
    msg("lfMsg", "Funcionou. Last.fm conectado.", "ok");
    setTimeout(() => $("guiaLastfm").close(), 900);
  } catch (e) {
    msg("lfMsg", limparErro(e), "erro");
  } finally {
    botao.disabled = false;
  }
}

async function copiarRedirect() {
  const botao = $("spCopiar");
  try {
    await navigator.clipboard.writeText(estado.config.spotifyRedirect);
    botao.textContent = "Copiado";
  } catch {
    botao.textContent = "Selecione e copie";
  }
  setTimeout(() => (botao.textContent = "Copiar"), 1500);
}

export function ligarContas() {
  // Spotify
  $("spConectar").onclick = conectarSpotify;
  $("spSair").onclick = async () => {
    configMudou(await window.api.desconectarSpotify());
    msg("spMsg", "Spotify desconectado neste computador.");
  };
  $("spGuia").onclick = () => {
    $("spRedirect").textContent = estado.config.spotifyRedirect;
    $("guiaSpotify").showModal();
  };
  $("spAbrirSite").onclick = () => window.api.abrirLink(URL_SPOTIFY);
  $("spCopiar").onclick = copiarRedirect;
  $("spFecharGuia").onclick = () => $("guiaSpotify").close();

  // Last.fm
  $("lfGuia").onclick = () => {
    const c = estado.config;
    $("lfUsuario").value = c.usuario;
    $("lfChave").value = "";
    $("lfChave").placeholder = c.temChavePropria ? "Deixe vazio para manter a chave atual" : "Cole a API key aqui";
    // Com a chave que vem no app, o guia pede só o usuário (a não ser que a pessoa já use a sua).
    $("guiaLastfm").classList.toggle("com-chave", !c.temChavePadraoLastfm || c.temChavePropria);
    msg("lfMsg", "");
    $("guiaLastfm").showModal();
  };
  $("lfUsarPropria").onclick = () => $("guiaLastfm").classList.add("com-chave");
  $("lfAbrirSite").onclick = () => window.api.abrirLink(URL_LASTFM);
  $("lfFechar").onclick = () => $("guiaLastfm").close();
  $("lfTestar").onclick = testarLastfm;
  $("lfRemover").onclick = async () => configMudou(await window.api.removerLastfm());
}
