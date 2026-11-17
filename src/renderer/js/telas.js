// Troca de abas e o desenho da aba atual.
import { $, status } from "./util.js";
import { estado, temFonte } from "./estado.js";
import { cartao } from "./cartao.js";
import { pararPrevia } from "./previas.js";
import { renderSalvos } from "./salvos.js";
import { renderParaVoce, estaGerando } from "./recomendacoes.js";
import { renderCuradoria } from "./curadoria.js";

// Título e descrição de cada aba.
export const PAGINAS = {
  voce: { titulo: "Para você", descricao: "Artistas novos, do mais ao menos parecido com o que você ouve." },
  curadoria: { titulo: "Curadoria", descricao: "As mesmas recomendações, separadas pelos seus grupos de gosto." },
  salvos: { titulo: "Salvos", descricao: "Artistas que você guardou para ouvir depois. Eles ficam aqui mesmo quando saem das recomendações." },
};

const DESENHAR = {
  voce: renderParaVoce,
  curadoria: renderCuradoria,
  salvos: () => renderSalvos(cartao),
};

function mostrarVazio(n) {
  const vazio = $("empty");
  if (estado.aba === "salvos") {
    vazio.textContent = estado.salvos.length
      ? "Nada encontrado com esse filtro."
      : "Nenhum artista salvo ainda. Toque no marcador de um cartão para guardá-lo aqui.";
    vazio.style.display = n === 0 ? "block" : "none";
  } else {
    vazio.textContent = "Nada encontrado com esse filtro.";
    vazio.style.display = estado.auto && n === 0 ? "block" : "none";
  }
}

// Redesenha a aba atual (a grade é refeita, então a prévia tocando para junto).
export function render() {
  pararPrevia();
  mostrarVazio(DESENHAR[estado.aba]());
  if (!estado.auto && !estaGerando() && !temFonte()) status("Abra Configurações e escolha de onde o Garimpo tira o seu gosto musical.");
}

export function trocarAba(aba) {
  if (aba !== estado.aba) window.api.registrarEvento("aba_aberta", { aba });
  estado.aba = aba;
  document.querySelectorAll(".aba").forEach((b) => b.classList.toggle("ativa", b.dataset.aba === aba));
  for (const nome of Object.keys(PAGINAS)) $("painel-" + nome).hidden = aba !== nome;
  // Garimpar não muda os salvos: os controles só aparecem nas abas de recomendação.
  const salvos = aba === "salvos";
  $("controlesGerar").hidden = salvos;
  $("status").hidden = salvos;
  $("avisos").hidden = salvos;
  $("tituloPagina").textContent = PAGINAS[aba].titulo;
  $("descricaoPagina").textContent = PAGINAS[aba].descricao;
  $("busca").placeholder = salvos ? "Buscar nos salvos..." : "Buscar por nome, gênero ou artista seu...";
  render();
}
