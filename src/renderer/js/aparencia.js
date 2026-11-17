// Aparência: modo (Sistema, Claro, Escuro) e tema de cores. As paletas ficam em temas.css,
// geradas por scripts/gerar-temas.py; aqui só os nomes que aparecem na tela.
import { $ } from "./util.js";
import { estado } from "./estado.js";

export const TEMAS = [
  { id: "garimpo", nome: "Garimpo" },
  { id: "tokyo-night", nome: "Tokyo Night" },
  { id: "dracula", nome: "Dracula" },
  { id: "catppuccin", nome: "Catppuccin" },
  { id: "nord", nome: "Nord" },
  { id: "gruvbox", nome: "Gruvbox" },
  { id: "solarized", nome: "Solarized" },
  { id: "rose-pine", nome: "Rosé Pine" },
  { id: "one", nome: "One Dark / Light" },
];

const MODOS = [
  ["sistema", "Sistema"],
  ["claro", "Claro"],
  ["escuro", "Escuro"],
];

const temaValido = (id) => (TEMAS.some((t) => t.id === id) ? id : "garimpo");

// Troca as cores da página e lembra para a próxima abertura (ver tema-inicial.js).
export function aplicarTema(id) {
  const tema = temaValido(id);
  document.documentElement.dataset.tema = tema;
  try {
    localStorage.setItem("garimpo-tema", tema);
  } catch {
    // sem localStorage: só pisca o padrão ao abrir
  }
}

async function salvar(mudanca) {
  estado.config = await window.api.salvarConfig({ aparencia: mudanca });
  aplicarTema(estado.config.aparencia.tema);
  pintarAparencia();
}

function botaoModo([valor, texto]) {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "chip";
  b.textContent = texto;
  b.dataset.modo = valor;
  b.setAttribute("role", "radio");
  b.onclick = () => salvar({ modo: valor });
  return b;
}

// Amostra com as cores reais do tema (o CSS do tema vale para qualquer elemento com data-tema).
function amostra(tema) {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "amostra";
  b.dataset.tema = tema.id;
  b.setAttribute("role", "radio");
  b.title = tema.nome;
  b.innerHTML = `
    <span class="amostra-tela">
      <span class="amostra-lateral"></span>
      <span class="amostra-cartao"><span class="amostra-linha"></span><span class="amostra-ponto"></span></span>
    </span>
    <span class="amostra-nome"></span>`;
  b.querySelector(".amostra-nome").textContent = tema.nome;
  b.onclick = () => salvar({ tema: tema.id });
  return b;
}

export function pintarAparencia() {
  const { modo, tema } = estado.config.aparencia || { modo: "sistema", tema: "garimpo" };
  for (const b of $("modosAparencia").children) {
    b.classList.toggle("active", b.dataset.modo === modo);
    b.setAttribute("aria-checked", String(b.dataset.modo === modo));
  }
  for (const b of $("temasAparencia").children) {
    b.classList.toggle("ativa", b.dataset.tema === temaValido(tema));
    b.setAttribute("aria-checked", String(b.dataset.tema === temaValido(tema)));
  }
}

export function ligarAparencia() {
  $("modosAparencia").replaceChildren(...MODOS.map(botaoModo));
  $("temasAparencia").replaceChildren(...TEMAS.map(amostra));
}
