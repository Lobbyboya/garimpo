// Aba "Curadoria": as recomendações organizadas pelos grupos de gosto da pessoa.
import { $, combina, termoBusca } from "./util.js";
import { estado, acoes } from "./estado.js";
import { cartao } from "./cartao.js";

const POR_GRUPO = 8;

const gruposAtuais = () => estado.auto?.grupos || [];

function listaCuradoria() {
  const recs = estado.auto.recs;
  if (estado.grupoAtivo) return recs.filter((r) => r.grupo === estado.grupoAtivo);
  // "Todos": os melhores de cada grupo, intercalados, para nenhum estilo dominar a tela.
  const filas = gruposAtuais().map((g) => recs.filter((r) => r.grupo === g.nome).slice(0, POR_GRUPO));
  const saida = [];
  for (let i = 0; i < POR_GRUPO; i++) for (const fila of filas) if (fila[i]) saida.push(fila[i]);
  return saida;
}

// Devolve quantos cartões desenhou, ou -1 quando não há grupos (a mensagem já explica).
export function renderCuradoria() {
  const grid = $("grid-curadoria");
  const info = $("curadoriaInfo");
  grid.innerHTML = "";
  if (!estado.auto) {
    info.textContent = "";
    return 0;
  }
  const grupos = gruposAtuais();
  if (!grupos.length) {
    info.textContent = estado.auto.grupos
      ? "Não deu para identificar os estilos dos seus artistas. Conecte o Spotify ou configure o Last.fm em Configurações e clique em Garimpar."
      : "Clique em Garimpar para montar a sua curadoria.";
    return -1;
  }
  info.textContent = `${grupos.length} grupos de gosto, montados a partir dos estilos dos artistas que você mais ouve. A curadoria se refaz sozinha uma vez por dia, ao abrir o app.`;
  const termo = termoBusca();
  const lista = listaCuradoria().filter((r) => combina(r, termo));
  for (const r of lista) grid.appendChild(cartao(r, "curadoria"));
  return lista.length;
}

// Chips "Todos" + um por grupo.
export function montarFiltrosCuradoria() {
  const box = $("clusters");
  box.innerHTML = "";
  const grupos = gruposAtuais();
  if (!grupos.some((g) => g.nome === estado.grupoAtivo)) estado.grupoAtivo = null;
  if (!grupos.length) return;
  const chip = (texto, valor, dica) => {
    const b = document.createElement("button");
    b.className = "chip" + (estado.grupoAtivo === valor ? " active" : "");
    b.textContent = texto;
    if (dica) b.title = dica;
    b.onclick = () => {
      estado.grupoAtivo = valor;
      montarFiltrosCuradoria();
      acoes.render();
    };
    box.appendChild(b);
  };
  chip("Todos", null);
  for (const g of grupos) chip(g.nome, g.nome, "Seus artistas: " + g.artistas.join(", "));
}
