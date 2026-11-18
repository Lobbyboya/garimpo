// Primeira vez: a pessoa digita alguns artistas e já recebe recomendações (pelo Deezer, sem conta).
import { $, limparErro, status } from "./util.js";
import { estado, acoes } from "./estado.js";
import { atualizarFontes } from "./config.js";

const MAX = 10;
const artistas = [];

function pintar() {
  const campo = $("campoArtistas");
  for (const chip of campo.querySelectorAll(".chip-artista")) chip.remove();
  for (const [i, nome] of artistas.entries()) {
    const chip = document.createElement("span");
    chip.className = "chip-artista";
    chip.textContent = nome;
    const tirar = document.createElement("button");
    tirar.type = "button";
    tirar.textContent = "×";
    tirar.title = `Tirar ${nome}`;
    tirar.onclick = () => {
      artistas.splice(i, 1);
      pintar();
    };
    chip.append(tirar);
    campo.insertBefore(chip, $("entradaArtista"));
  }
  $("entradaArtista").placeholder = artistas.length ? (artistas.length < 3 ? "Mais um..." : "Outro, se quiser") : "Ex.: Radiohead, depois Enter";
  $("garimparBoasVindas").disabled = !artistas.length && !$("entradaArtista").value.trim();
}

// Texto digitado vira chip (vírgula também separa).
function acrescentar(texto) {
  for (const nome of texto.split(",").map((s) => s.trim()).filter(Boolean)) {
    if (artistas.length < MAX && !artistas.some((a) => a.toLowerCase() === nome.toLowerCase())) artistas.push(nome);
  }
  $("entradaArtista").value = "";
  pintar();
}

async function comecar(e) {
  e.preventDefault();
  acrescentar($("entradaArtista").value);
  if (!artistas.length) return;
  $("garimparBoasVindas").disabled = true;
  try {
    estado.config = await window.api.salvarConfig({ manual: [...estado.config.manual, ...artistas] });
    atualizarFontes();
    acoes.render(); // já sai da tela de boas-vindas
    await acoes.gerar();
  } catch (erro) {
    status(limparErro(erro), true);
  } finally {
    pintar();
  }
}

export function ligarBoasVindas() {
  const entrada = $("entradaArtista");
  entrada.addEventListener("keydown", (e) => {
    if (e.key === "," || (e.key === "Enter" && entrada.value.trim())) {
      e.preventDefault();
      acrescentar(entrada.value);
    } else if (e.key === "Backspace" && !entrada.value && artistas.length) {
      artistas.pop();
      pintar();
    }
  });
  entrada.addEventListener("input", pintar);
  $("campoArtistas").addEventListener("click", () => entrada.focus());
  $("formBoasVindas").addEventListener("submit", comecar);
  for (const b of document.querySelectorAll("[data-abrir-config]")) b.onclick = () => acoes.abrirConfig();
}
