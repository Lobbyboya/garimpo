// Aba "Para você" (ranking geral) e o botão Garimpar.
import { $, combina, limparErro, status, termoBusca } from "./util.js";
import { estado, acoes, PERIODOS, POUCO_CONHECIDO, temFonte } from "./estado.js";
import { visiveis } from "./dispensados.js";
import { ligarRadio, radioLigado, desligarRadio } from "./previas.js";
import { cartao } from "./cartao.js";
import { atualizarFontes } from "./config.js";
import { montarFiltrosCuradoria } from "./curadoria.js";

let gerando = false;
export const estaGerando = () => gerando;

const FILTROS = {
  todos: { nome: "Todos", aceita: () => true },
  novos: { nome: "Novos", aceita: (r) => r.novo, dica: "Nunca recomendados antes" },
  "pouco-conhecidos": {
    nome: "Pouco conhecidos",
    aceita: (r) => Number.isFinite(r.fas) && r.fas < POUCO_CONHECIDO,
    dica: `Menos de ${POUCO_CONHECIDO.toLocaleString("pt-BR")} fãs no Deezer: garimpo profundo`,
  },
};

// O que está na tela agora (filtro + busca): é o que o rádio toca.
let naTela = [];

// Chips com a contagem de cada filtro (escondidos quando não há recomendações) e o botão do rádio.
function montarFiltros(recs) {
  const box = $("filtrosVoce");
  box.innerHTML = "";
  if (!recs.length) return;
  const radio = document.createElement("button");
  radio.className = "chip chip-radio";
  radio.textContent = radioLigado() ? "■ Parar sequência" : "▶ Ouvir em sequência";
  radio.title = "Toca 30 segundos de cada artista da lista, um depois do outro";
  radio.onclick = () => {
    if (radioLigado()) desligarRadio();
    else ligarRadio(naTela);
    montarFiltros(visiveis(estado.auto.recs));
  };
  for (const [id, f] of Object.entries(FILTROS)) {
    const n = recs.filter(f.aceita).length;
    if (id !== "todos" && n === 0 && estado.filtroVoce !== id) continue;
    const b = document.createElement("button");
    b.className = "chip" + (estado.filtroVoce === id ? " active" : "");
    b.textContent = id === "todos" ? f.nome : `${f.nome} (${n})`;
    if (f.dica) b.title = f.dica;
    b.onclick = () => {
      estado.filtroVoce = id;
      acoes.render();
    };
    box.appendChild(b);
  }
  box.appendChild(radio);
}

export function renderParaVoce() {
  const grid = $("grid-voce");
  grid.innerHTML = "";
  if (!estado.auto) return 0;
  const recs = visiveis(estado.auto.recs);
  montarFiltros(recs);
  const termo = termoBusca();
  const filtro = FILTROS[estado.filtroVoce] || FILTROS.todos;
  const lista = recs.filter((r) => filtro.aceita(r) && combina(r, termo));
  naTela = lista;
  const maior = recs[0]?.pontos || 1;
  for (const r of lista) grid.appendChild(cartao(r, "ranking", maior));
  return lista.length;
}

// Resumo do último resultado na linha de status, e avisos das fontes que falharam.
export function descreverResultado() {
  const a = estado.auto;
  if (!a) return;
  const quando = new Date(a.geradoEm).toLocaleString("pt-BR");
  const de = a.fontes?.length ? ` (${a.fontes.join(" + ")})` : "";
  const motor = a.motor ? `, parecidos via ${a.motor}` : "";
  const artistas = a.sementes.length === 1 ? "1 artista seu" : `${a.sementes.length} artistas seus`;
  const novos = a.recs.filter((r) => r.novo).length;
  const comNovos = novos ? ` (${novos} ${novos === 1 ? "nova" : "novas"})` : "";
  status(`${a.recs.length} recomendações${comNovos} a partir de ${artistas}${de}, ${PERIODOS[a.periodo] || "longo prazo"}${motor}. Geradas em ${quando}.`);
  $("avisos").textContent = (a.avisos || []).join(" ");
}

// Barra de progresso: com fração conhecida mostra a porcentagem; sem, fica "andando".
export function mostrarProgresso({ texto, fracao } = {}) {
  if (texto) status(texto);
  const barra = $("progresso");
  barra.hidden = !gerando;
  barra.classList.toggle("indeterminado", !Number.isFinite(fracao));
  if (Number.isFinite(fracao)) barra.firstElementChild.style.width = Math.round(fracao * 100) + "%";
}

// Cartões "fantasma" enquanto o primeiro resultado não chega.
function mostrarFantasmas() {
  const grid = $("grid-voce");
  if (estado.auto?.recs?.length || estado.aba !== "voce") return;
  grid.replaceChildren(...Array.from({ length: 6 }, () => {
    const c = document.createElement("div");
    c.className = "card fantasma";
    c.innerHTML = '<div class="head"><span class="f-foto"></span><span class="f-linhas"><span></span><span></span></span></div><span class="f-linha"></span><span class="f-linha curta"></span>';
    return c;
  }));
}

// Avisa pelo sistema quando o Garimpar termina com o app em segundo plano.
function notificar(a) {
  if (document.hasFocus() || typeof Notification === "undefined") return;
  const novos = a.recs.filter((r) => r.novo).length;
  const corpo = novos
    ? `${novos} ${novos === 1 ? "artista novo" : "artistas novos"} para você.`
    : `${a.recs.length} recomendações prontas.`;
  try {
    new Notification("Garimpo", { body: corpo, silent: true });
  } catch {
    // sem notificações no sistema: tudo bem
  }
}

export async function gerar() {
  if (gerando) return;
  if (!temFonte()) {
    acoes.abrirConfig();
    return;
  }
  gerando = true;
  const botao = $("gerar");
  botao.disabled = true;
  $("avisos").textContent = "";
  mostrarProgresso({ texto: "Garimpando...", fracao: 0 });
  mostrarFantasmas();
  try {
    estado.auto = await window.api.gerar({ periodo: $("periodo").value, sementes: $("sementes").value });
    descreverResultado();
    notificar(estado.auto);
    // O login do Spotify pode ter caído durante a geração.
    estado.config = await window.api.lerConfig();
    atualizarFontes();
  } catch (e) {
    status(limparErro(e), true);
  } finally {
    gerando = false;
    mostrarProgresso();
    botao.disabled = false;
    montarFiltrosCuradoria();
    acoes.render();
  }
}
