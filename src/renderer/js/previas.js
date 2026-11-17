// Prévias de 30 s (Deezer) dentro do cartão. Um tocador só para o app todo.
import { esc } from "./util.js";

const player = new Audio();
let tocando = null; // botão da faixa que está tocando
const faixasCache = new Map(); // nome do artista -> faixas (ou a promessa em andamento)

export function pararPrevia() {
  player.pause();
  if (tocando) tocando.textContent = "▶";
  tocando = null;
}
player.addEventListener("ended", pararPrevia);
player.addEventListener("error", () => {
  if (tocando) tocando.title = "Não foi possível tocar esta prévia.";
  pararPrevia();
});

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

function botaoTocar(f) {
  const tocar = document.createElement("button");
  tocar.className = "tocar";
  tocar.type = "button";
  tocar.textContent = "▶";
  tocar.disabled = !f.preview;
  tocar.title = f.preview ? "Ouvir 30 segundos" : "Sem prévia disponível";
  tocar.onclick = () => {
    if (tocando === tocar) return pararPrevia();
    pararPrevia();
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
