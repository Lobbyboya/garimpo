// Aviso de versão nova (banner no topo) e o botão "Verificar atualizações".
import { $, msg, limparErro } from "./util.js";

let info = null;
let pronta = false; // versão nova já baixada (atualização automática): o botão reinicia o app

function mostrarBanner(novidade) {
  if (pronta) return; // "pronta para instalar" vale mais que "há versão nova"
  info = novidade;
  $("versaoNovaTexto").textContent = `v${novidade.novaVersao}`;
  $("btnBaixarAtualizacao").textContent = "Ver atualização";
  $("bannerAtualizacao").hidden = false;
}

// A versão nova já foi baixada em segundo plano.
function mostrarPronta(versao) {
  pronta = true;
  $("bannerTexto").textContent = `A versão ${versao} foi baixada.`;
  $("btnBaixarAtualizacao").textContent = "Reiniciar e atualizar";
  $("btnFecharBanner").textContent = "Depois";
  $("bannerAtualizacao").hidden = false;
}

async function verificar() {
  const botao = $("btnChecarUpdate");
  try {
    botao.disabled = true;
    msg("updMsg", "Consultando GitHub por novas versões...");
    const resposta = await window.api.checarAtualizacao();
    if (resposta.pronta) {
      msg("updMsg", `A versão ${resposta.pronta} já foi baixada. Reinicie para atualizar.`, "ok");
      mostrarPronta(resposta.pronta);
    } else if (resposta.temNova && resposta.automatica) {
      msg("updMsg", `A versão ${resposta.novaVersao} está sendo baixada. Avisamos quando estiver pronta.`, "ok");
    } else if (resposta.temNova) {
      msg("updMsg", `Nova versão disponível: v${resposta.novaVersao}!`, "ok");
      mostrarBanner(resposta);
    } else {
      msg("updMsg", resposta.mensagem || "Você já está na versão mais recente.", "ok");
    }
  } catch (e) {
    msg("updMsg", limparErro(e), "erro");
  } finally {
    botao.disabled = false;
  }
}

export function ligarAtualizacoes() {
  $("btnBaixarAtualizacao").onclick = () => {
    if (pronta) return window.api.instalarAtualizacao();
    const link = info?.downloadUrl || info?.url;
    if (link) window.api.abrirLink(link);
  };
  $("btnFecharBanner").onclick = () => ($("bannerAtualizacao").hidden = true);
  $("btnChecarUpdate").onclick = verificar;
  window.api.aoNovaVersao(mostrarBanner); // checagem em segundo plano feita pelo processo principal
  window.api.aoAtualizacaoPronta(({ versao }) => mostrarPronta(versao)); // atualização automática
}
