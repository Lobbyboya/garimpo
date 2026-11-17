// Aba "Salvos": artistas guardados para ouvir depois.
import { $, chaveNome, combina, limparErro, status, termoBusca } from "./util.js";
import { estado, acoes } from "./estado.js";

const FILTROS = [
  ["todos", "Todos"],
  ["pendentes", "Para ouvir"],
  ["ouvidos", "Já ouvidos"],
];

export function ehSalvo(nome) {
  const k = chaveNome(nome);
  return estado.salvos.some((s) => chaveNome(s.nome) === k);
}

// O artista ainda aparece nas recomendações atuais?
export function aindaRecomendado(nome) {
  const k = chaveNome(nome);
  return Boolean(estado.auto?.recs?.some((r) => chaveNome(r.nome) === k));
}

// Número de salvos ainda não ouvidos, ao lado da aba.
export function atualizarContador() {
  const pendentes = estado.salvos.filter((s) => !s.ouvido).length;
  const el = $("contSalvos");
  el.textContent = String(pendentes);
  el.hidden = pendentes === 0;
  el.title = `${pendentes} para ouvir`;
}

export function pintarBotaoSalvar(botao, nome) {
  const salvo = ehSalvo(nome);
  botao.classList.toggle("ativo", salvo);
  botao.title = salvo ? "Tirar dos salvos" : "Salvar para ouvir depois";
  botao.setAttribute("aria-label", botao.title);
}

export async function alternarSalvo(r, botao) {
  try {
    estado.salvos = await window.api.alternarSalvo({ ...r, aba: estado.aba });
  } catch (e) {
    status(limparErro(e), true);
    return;
  }
  atualizarContador();
  // Fora da aba Salvos só o botão muda, para não fechar prévias abertas nem parar o som.
  if (estado.aba === "salvos") acoes.render();
  else pintarBotaoSalvar(botao, r.nome);
}

export async function marcarOuvido(s) {
  estado.salvos = await window.api.marcarOuvido(s.nome, !s.ouvido);
  atualizarContador();
  acoes.render();
}

function montarFiltros() {
  const box = $("filtrosSalvos");
  box.innerHTML = "";
  if (!estado.salvos.length) return;
  for (const [valor, texto] of FILTROS) {
    const b = document.createElement("button");
    b.className = "chip" + (estado.filtroSalvos === valor ? " active" : "");
    b.textContent = texto;
    b.onclick = () => {
      estado.filtroSalvos = valor;
      acoes.render();
    };
    box.appendChild(b);
  }
}

// Desenha a aba com `cartao` (recebido para não importar cartao.js, que importa este módulo).
export function renderSalvos(cartao) {
  const grid = $("grid-salvos");
  grid.innerHTML = "";
  montarFiltros();
  const termo = termoBusca();
  const lista = estado.salvos
    .filter((s) => estado.filtroSalvos === "todos" || (estado.filtroSalvos === "ouvidos") === Boolean(s.ouvido))
    .filter((s) => combina(s, termo));
  for (const s of lista) grid.appendChild(cartao(s, "salvo"));
  return lista.length;
}
