// Prévias de 30 s (Deezer): a lista de músicas dentro do cartão e o "rádio", que toca uma prévia
// de cada recomendação em sequência. Um tocador só para o app todo.
import { $, esc } from "./util.js";
import { ehDispensado } from "./dispensados.js";

const player = new Audio();
let tocando = null; // botão de faixa (dentro de um cartão) que está tocando
const faixasCache = new Map(); // nome do artista -> faixas (ou a promessa em andamento)

// Rádio: fila de recomendações e a posição atual.
const radio = { fila: [], pos: -1, ativo: false };

// O id do Deezer vem no link da recomendação (https://www.deezer.com/artist/123).
const deezerIdDe = (r) => String(r.deezer || "").match(/\/artist\/(\d+)/)?.[1] || null;

function carregarFaixas(r) {
  if (!faixasCache.has(r.nome)) {
    const promessa = window.api.topFaixas({ nome: r.nome, deezerId: deezerIdDe(r) }).catch(() => {
      faixasCache.delete(r.nome); // falhou: tenta de novo no próximo clique
      return null;
    });
    faixasCache.set(r.nome, promessa);
  }
  return faixasCache.get(r.nome);
}

function soltarBotao() {
  if (tocando) tocando.textContent = "▶";
  tocando = null;
}

// Para tudo, inclusive o rádio.
export function pararPrevia() {
  player.pause();
  soltarBotao();
  if (radio.ativo) desligarRadio();
}

// Chamado quando a grade é redesenhada: a prévia de um cartão para (o botão dela sumiu),
// mas o rádio continua e o novo cartão do artista volta a ficar destacado.
export function aoRedesenhar() {
  if (radio.ativo) {
    destacarCartao();
    return;
  }
  player.pause();
  soltarBotao();
}

player.addEventListener("ended", () => (radio.ativo ? proxima() : soltarBotao()));
player.addEventListener("error", () => {
  if (radio.ativo) return proxima();
  if (tocando) tocando.title = "Não foi possível tocar esta prévia.";
  soltarBotao();
});

// ---------- Prévias dentro do cartão ----------

function botaoTocar(f) {
  const tocar = document.createElement("button");
  tocar.className = "tocar";
  tocar.type = "button";
  tocar.textContent = "▶";
  tocar.disabled = !f.preview;
  tocar.title = f.preview ? "Ouvir 30 segundos" : "Sem prévia disponível";
  tocar.onclick = () => {
    if (tocando === tocar) return pararPrevia();
    pararPrevia(); // tocar uma faixa à mão desliga o rádio
    player.src = f.preview;
    player.play().then(() => {
      window.api.registrarEvento("previa_tocada");
      tocando = tocar;
      tocar.textContent = "❚❚";
    }).catch(() => (tocar.title = "Não foi possível tocar esta prévia."));
  };
  return tocar;
}

function tituloFaixa(f) {
  const nome = document.createElement(f.link ? "a" : "span");
  nome.className = "titulo";
  nome.textContent = f.titulo;
  if (f.link) {
    nome.href = f.link;
    nome.target = "_blank";
    nome.title = "Abrir no Deezer";
  }
  return nome;
}

// Abre ou fecha a lista de músicas do cartão `c`.
export async function alternarFaixas(c, r) {
  const lista = c.querySelector(".faixas");
  if (!lista.hidden) {
    lista.hidden = true;
    if (tocando && lista.contains(tocando)) pararPrevia();
    return;
  }
  lista.hidden = false;
  lista.innerHTML = '<li class="carregando">Carregando...</li>';
  const faixas = await carregarFaixas(r);
  lista.innerHTML = "";
  if (!faixas?.length) {
    const aviso = faixas ? "Nenhuma música encontrada no Deezer." : "Não foi possível falar com o Deezer.";
    lista.innerHTML = `<li class="carregando">${esc(aviso)}</li>`;
    return;
  }
  for (const f of faixas) {
    const li = document.createElement("li");
    li.append(botaoTocar(f), tituloFaixa(f));
    lista.appendChild(li);
  }
}

// ---------- Rádio: uma prévia de cada recomendação, em sequência ----------

const atual = () => radio.fila[radio.pos];

function destacarCartao() {
  for (const c of document.querySelectorAll(".card.tocando-agora")) c.classList.remove("tocando-agora");
  const r = atual();
  if (!r) return;
  const c = [...document.querySelectorAll(".card")].find((el) => el.dataset.nome === r.nome && !el.closest("[hidden]"));
  if (c) {
    c.classList.add("tocando-agora");
    c.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }
}

function pintarBarra(r, faixa) {
  $("radio").hidden = false;
  $("radioArtista").textContent = r.nome;
  $("radioFaixa").textContent = faixa ? faixa.titulo : "Procurando uma prévia...";
  $("radioPosicao").textContent = `${radio.pos + 1} de ${radio.fila.length}`;
  $("radioPausar").textContent = player.paused ? "▶" : "❚❚";
}

async function tocarAtual() {
  const r = atual();
  if (!r) return desligarRadio();
  const pos = radio.pos;
  pintarBarra(r, null);
  destacarCartao();
  const faixas = await carregarFaixas(r);
  if (!radio.ativo || radio.pos !== pos) return; // a pessoa pulou ou parou enquanto carregava
  const faixa = faixas?.find((f) => f.preview);
  if (!faixa) return proxima(); // sem prévia: segue para o próximo
  player.src = faixa.preview;
  try {
    await player.play();
    window.api.registrarEvento("previa_tocada");
  } catch {
    return proxima();
  }
  pintarBarra(r, faixa);
}

export function proxima() {
  if (!radio.ativo) return;
  do radio.pos++;
  while (radio.pos < radio.fila.length && ehDispensado(radio.fila[radio.pos].nome));
  if (radio.pos >= radio.fila.length) return desligarRadio();
  tocarAtual();
}

// Começa o rádio com as recomendações que estão na tela, na ordem.
export function ligarRadio(recs) {
  if (!recs.length) return;
  player.pause();
  soltarBotao();
  Object.assign(radio, { fila: [...recs], pos: -1, ativo: true });
  proxima();
  pintarBotaoRadio();
}

// O botão da aba "Para você" acompanha o estado do rádio.
function pintarBotaoRadio() {
  const b = document.querySelector(".chip-radio");
  if (b) b.textContent = radio.ativo ? "■ Parar sequência" : "▶ Ouvir em sequência";
}

export function desligarRadio() {
  radio.ativo = false;
  pintarBotaoRadio();
  player.pause();
  $("radio").hidden = true;
  for (const c of document.querySelectorAll(".card.tocando-agora")) c.classList.remove("tocando-agora");
}

export const radioLigado = () => radio.ativo;

// Pausa ou retoma o que estiver tocando (rádio ou prévia de um cartão).
export function pausarOuRetomar() {
  if (!player.src || (!radio.ativo && !tocando)) return false;
  if (player.paused) player.play().catch(() => {});
  else player.pause();
  if (radio.ativo) $("radioPausar").textContent = player.paused ? "▶" : "❚❚";
  else if (tocando) tocando.textContent = player.paused ? "▶" : "❚❚";
  return true;
}

export function ligarControlesRadio() {
  $("radioPausar").onclick = pausarOuRetomar;
  $("radioProxima").onclick = proxima;
  $("radioParar").onclick = desligarRadio;
  player.addEventListener("play", () => radio.ativo && ($("radioPausar").textContent = "❚❚"));
  player.addEventListener("pause", () => radio.ativo && ($("radioPausar").textContent = "▶"));
}
