// Aba "Para você" (ranking geral) e o botão Garimpar.
import { $, combina, limparErro, status, termoBusca } from "./util.js";
import { estado, acoes, PERIODOS, temFonte } from "./estado.js";
import { cartao } from "./cartao.js";
import { atualizarFontes } from "./config.js";
import { montarFiltrosCuradoria } from "./curadoria.js";

let gerando = false;
export const estaGerando = () => gerando;

export function renderParaVoce() {
  const grid = $("grid-voce");
  grid.innerHTML = "";
  if (!estado.auto) return 0;
  const termo = termoBusca();
  const lista = estado.auto.recs.filter((r) => combina(r, termo));
  const maior = estado.auto.recs[0]?.pontos || 1;
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
  status(`${a.recs.length} recomendações a partir de ${artistas}${de}, ${PERIODOS[a.periodo] || "longo prazo"}${motor}. Geradas em ${quando}.`);
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
