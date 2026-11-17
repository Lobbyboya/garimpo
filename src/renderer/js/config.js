// Janela de Configurações e o resumo das fontes na barra lateral.
import { $, msg } from "./util.js";
import { estado, acoes, temFonte, temLastfm } from "./estado.js";
import { pintarTelemetria } from "./telemetria.js";
import { pintarAparencia } from "./aparencia.js";

// "Garimpando a partir de Spotify (nome), Last.fm (usuário)." na barra lateral.
export function atualizarFontes() {
  const c = estado.config;
  const fontes = [];
  if (c.spotifyConectado) fontes.push("Spotify" + (c.spotifyNome ? ` (${c.spotifyNome})` : ""));
  if (temLastfm()) fontes.push(`Last.fm (${c.usuario})`);
  if (c.manual.length) fontes.push(`sua lista (${c.manual.length})`);
  $("sub").textContent = fontes.length
    ? "Garimpando a partir de " + fontes.join(", ") + "."
    : "Nenhuma fonte configurada ainda.";
}

// Estado do Spotify, do Last.fm e da versão dentro da janela.
export function pintarConfig() {
  const c = estado.config;
  const sp = $("spEstado");
  sp.textContent = c.spotifyConectado ? "Conectado" + (c.spotifyNome ? " como " + c.spotifyNome : "") : "Não conectado.";
  sp.classList.toggle("ok", c.spotifyConectado);
  if (!estado.conectandoSpotify) $("spConectar").textContent = c.spotifyConectado ? "Conectar outra conta" : "Conectar ao Spotify";
  $("spSair").hidden = !c.spotifyConectado;

  const lf = $("lfEstado");
  lf.textContent = temLastfm() ? `Configurado para o usuário ${c.usuario}.` : "Não configurado. Sem ele, os artistas parecidos vêm do Deezer.";
  lf.classList.toggle("ok", temLastfm());
  $("lfGuia").textContent = temLastfm() ? "Trocar usuário ou chave" : "Configurar passo a passo";
  $("lfRemover").hidden = !c.temChave;

  $("updEstado").textContent = `Garimpo v${c.versao || "1.0.0"}`;
}

// Depois de qualquer mudança de conta ou config.
export function configMudou(nova) {
  if (nova) estado.config = nova;
  atualizarFontes();
  pintarConfig();
}

export function abrirConfig() {
  $("cfgClientId").value = estado.config.spotifyClientId;
  $("cfgClientId").placeholder = estado.config.temClientIdPadrao ? "Opcional: usar o seu próprio" : "32 letras e números";
  $("cfgManual").value = estado.config.manual.join("\n");
  msg("telMsg", "");
  pintarTelemetria();
  pintarAparencia();
  msg("spMsg", "");
  pintarConfig();
  if (!$("config").open) $("config").showModal();
}

const lerManual = () => $("cfgManual").value.split("\n").map((s) => s.trim()).filter(Boolean);

// Grava o Client ID e a lista manual.
export async function salvarCampos() {
  configMudou(await window.api.salvarConfig({ spotifyClientId: $("cfgClientId").value, manual: lerManual() }));
}

export function ligarConfig() {
  $("abrirConfig").onclick = abrirConfig;
  $("cfgSalvar").onclick = async () => {
    await salvarCampos();
    $("config").close();
    acoes.render();
    if (temFonte() && !estado.auto) acoes.gerar();
  };
  $("cfgCancelar").onclick = () => $("config").close();
  // Fechar a janela (botão ou Esc) no meio do login do Spotify cancela o login.
  $("config").addEventListener("close", () => {
    if (estado.conectandoSpotify) window.api.cancelarSpotify();
  });
}
