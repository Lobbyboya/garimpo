// Cartão de artista, usado nas três abas (modo: "ranking", "curadoria" ou "salvo").
import { esc } from "./util.js";
import { alternarFaixas } from "./previas.js";
import { aindaRecomendado, alternarSalvo, marcarOuvido, pintarBotaoSalvar } from "./salvos.js";
import { dispensar } from "./dispensados.js";

const ICONE_SALVAR = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.5 3.5h11v17l-5.5-4-5.5 4z"/></svg>';
const ICONE_DISPENSAR = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';

const compacto = new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 });

// Selo "Novo", gênero e fãs embaixo do nome.
function detalhes(r) {
  const partes = [];
  if (r.novo) partes.push('<span class="selo">Novo</span>');
  if (r.genero) partes.push(`<span class="tag">${esc(r.genero)}</span>`);
  if (Number.isFinite(r.fas)) partes.push(`<span class="fas" title="Fãs no Deezer">${esc(compacto.format(r.fas))} fãs</span>`);
  return partes.join(" ");
}

function foto(r) {
  return r.img
    ? `<img src="${esc(r.img)}" alt="" loading="lazy">`
    : `<div class="semfoto">${esc(r.nome.trim().charAt(0).toUpperCase())}</div>`;
}

// Link secundário: Last.fm se houver, senão Deezer.
function linkExtra(r) {
  if (r.lastfm) return `<a class="listen fraco" href="${esc(r.lastfm)}" target="_blank">Last.fm</a>`;
  if (r.deezer) return `<a class="listen fraco" href="${esc(r.deezer)}" target="_blank">Deezer</a>`;
  return "";
}

// "A" ou "A e B"
const umOuDois = ([a, b]) => esc(a) + (b ? " e " + esc(b) : "");

function meioRanking(r) {
  const mostrar = r.sementes.slice(0, 4);
  const resto = r.sementes.length - mostrar.length;
  const chips = mostrar.map((s) => `<span>${esc(s)}</span>`).join("") + (resto > 0 ? `<span>+${resto}</span>` : "");
  return `
      <div class="barra"><div></div></div>
      <div class="why">Parecido com ${r.sementes.length} ${r.sementes.length === 1 ? "artista seu" : "artistas seus"}:</div>
      <div class="seeds">${chips}</div>`;
}

function meioCuradoria(r) {
  const mais = r.sementes.length > 2 ? `, e de mais ${r.sementes.length - 2}` : "";
  return `<div class="why">Na linha de ${umOuDois(r.sementes)}, que você ouve${mais}.</div>`;
}

function meioSalvo(r) {
  const quando = new Date(r.salvoEm).toLocaleDateString("pt-BR", { day: "numeric", month: "short", year: "numeric" });
  const origem = r.sementes.length ? ` Veio de ${umOuDois(r.sementes)}.` : "";
  const selo = r.ouvido
    ? '<span class="selo neutro">Já ouvido</span>'
    : aindaRecomendado(r.nome) ? '<span class="selo">Ainda recomendado</span>' : "";
  return `
      <div class="why">Salvo em ${esc(quando)}.${origem} ${selo}</div>
      <div class="acoes-salvo">
        <button class="botao secundario marcar" type="button">${r.ouvido ? "Marcar como não ouvido" : "Já ouvi"}</button>
        <button class="botao secundario remover" type="button">Remover</button>
      </div>`;
}

const MEIOS = { ranking: meioRanking, curadoria: meioCuradoria, salvo: meioSalvo };

// `maior` = pontos da melhor recomendação, para a barra de afinidade do modo ranking.
export function cartao(artista, modo, maior) {
  const r = { ...artista, sementes: artista.sementes || [] };
  const c = document.createElement("div");
  c.className = "card" + (modo === "salvo" && r.ouvido ? " ouvido" : "");
  c.dataset.nome = r.nome; // para o rádio achar o cartão do artista que está tocando
  const linkSpotify = r.spotify || "https://open.spotify.com/search/" + encodeURIComponent(r.nome);

  const podeDispensar = modo !== "salvo";
  c.innerHTML = `
    <div class="acoes-cartao">
      ${podeDispensar ? `<button class="dispensar" type="button" title="Não curti: não mostrar mais" aria-label="Não curti">${ICONE_DISPENSAR}</button>` : ""}
      <button class="salvar" type="button">${ICONE_SALVAR}</button>
    </div>
    <div class="head">
      ${foto(r)}
      <div>
        <h3>${esc(r.nome)}</h3>
        <div class="detalhes">${detalhes(r)}</div>
      </div>
    </div>
    ${MEIOS[modo](r)}
    <div class="links">
      <a class="listen" href="${esc(linkSpotify)}" target="_blank">${r.spotifyDireto ? "Ouvir no Spotify →" : "Buscar no Spotify →"}</a>
      ${linkExtra(r)}
      <button class="textual previas" type="button">♪ Prévias</button>
    </div>
    <ol class="faixas" hidden></ol>`;

  c.querySelector(".previas").onclick = () => alternarFaixas(c, r);
  const salvar = c.querySelector(".salvar");
  pintarBotaoSalvar(salvar, r.nome);
  salvar.onclick = () => alternarSalvo(r, salvar);
  if (podeDispensar) c.querySelector(".dispensar").onclick = () => dispensar(r);
  if (modo === "salvo") {
    c.querySelector(".marcar").onclick = () => marcarOuvido(r);
    c.querySelector(".remover").onclick = () => alternarSalvo(r, salvar);
  }
  const barra = c.querySelector(".barra > div");
  if (barra) {
    const pct = Math.max(4, Math.round((r.pontos / maior) * 100));
    barra.style.width = pct + "%"; // via CSSOM: a CSP bloqueia atributos style inline
    barra.parentElement.title = `Afinidade ${pct}%`;
  }
  return c;
}
