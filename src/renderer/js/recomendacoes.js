// Aba "Para você" (ranking geral) e o botão Garimpar.
import { $, combina, limparErro, status, termoBusca } from "./util.js";
import { estado, acoes, PERIODOS, POUCO_CONHECIDO, temFonte } from "./estado.js";
import { visiveis } from "./dispensados.js";
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

// Chips com a contagem de cada filtro (escondidos quando não há recomendações).
function montarFiltros(recs) {
  const box = $("filtrosVoce");
  box.innerHTML = "";
  if (!recs.length) return;
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
  try {
    estado.auto = await window.api.gerar({ periodo: $("periodo").value, sementes: $("sementes").value });
    descreverResultado();
    // O login do Spotify pode ter caído durante a geração.
    estado.config = await window.api.lerConfig();
    atualizarFontes();
  } catch (e) {
    status(limparErro(e), true);
  } finally {
    gerando = false;
    botao.disabled = false;
    montarFiltrosCuradoria();
    acoes.render();
  }
}
