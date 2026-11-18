// Ponto de entrada da interface: liga os módulos e carrega o estado inicial.
// Fala com o processo principal só via window.api (preload.js).
import { $ } from "./util.js";
import { estado, acoes, PERIODOS, temFonte } from "./estado.js";
import { PAGINAS, render, trocarAba } from "./telas.js";
import { gerar, descreverResultado, mostrarProgresso } from "./recomendacoes.js";
import { montarFiltrosCuradoria } from "./curadoria.js";
import { atualizarContador } from "./salvos.js";
import { abrirConfig, atualizarFontes, ligarConfig } from "./config.js";
import { ligarContas } from "./contas.js";
import { definirSituacao, ligarTelemetria, perguntarSeNecessario } from "./telemetria.js";
import { ligarAtualizacoes } from "./atualizacoes.js";
import { aplicarTema, ligarAparencia } from "./aparencia.js";
import { ligarBoasVindas } from "./boasvindas.js";
import { ligarControlesRadio } from "./previas.js";
import { ligarAtalhos } from "./atalhos.js";

const UM_DIA = 24 * 60 * 60 * 1000;

Object.assign(acoes, { render, gerar, abrirConfig });

ligarConfig();
ligarContas();
ligarTelemetria();
ligarAtualizacoes();
ligarAparencia();
ligarBoasVindas();
ligarControlesRadio();
ligarAtalhos();
$("gerar").onclick = gerar;
$("busca").addEventListener("input", render);
document.querySelectorAll(".aba").forEach((b) => (b.onclick = () => trocarAba(b.dataset.aba)));
window.api.aoProgresso((m) => mostrarProgresso(typeof m === "string" ? { texto: m } : m));

// Mostra o último resultado guardado, com o período e a quantidade usados nele.
function restaurarCache(cache) {
  estado.auto = cache;
  if (PERIODOS[cache.opcoes?.periodo]) $("periodo").value = cache.opcoes.periodo;
  if (cache.opcoes?.sementes) $("sementes").value = String(cache.opcoes.sementes);
  descreverResultado();
}

(async function iniciar() {
  const [config, cache, salvos, telemetria, dispensados] = await Promise.all([
    window.api.lerConfig(), window.api.lerCache(), window.api.listarSalvos(), window.api.telemetriaSituacao(),
    window.api.listarDispensados(),
  ]);
  estado.dispensados = dispensados || [];
  estado.config = config;
  aplicarTema(config.aparencia?.tema);
  estado.salvos = salvos || [];
  definirSituacao(telemetria);
  atualizarContador();
  $("descricaoPagina").textContent = PAGINAS.voce.descricao;
  if (cache?.recs) restaurarCache(cache);
  atualizarFontes();
  montarFiltrosCuradoria();
  render();

  if (!temFonte()) return; // a tela de boas-vindas já aparece no lugar das recomendações
  perguntarSeNecessario();
  // Curadoria dinâmica: refaz sozinha se o último resultado tem mais de um dia (ou é de uma versão antiga).
  const idade = cache?.geradoEm ? Date.now() - new Date(cache.geradoEm).getTime() : Infinity;
  if (!cache?.recs || !cache.grupos || idade > UM_DIA) gerar();
})();
