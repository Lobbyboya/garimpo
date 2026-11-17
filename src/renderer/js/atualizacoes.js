// Aviso de versão nova (banner no topo) e o botão "Verificar atualizações".
import { $, msg, limparErro } from "./util.js";

let info = null;

function mostrarBanner(novidade) {
  info = novidade;
  $("versaoNovaTexto").textContent = `v${novidade.novaVersao}`;
  $("bannerAtualizacao").hidden = false;
}

async function verificar() {
  const botao = $("btnChecarUpdate");
  try {
    botao.disabled = true;
    msg("updMsg", "Consultando GitHub por novas versões...");
    const resposta = await window.api.checarAtualizacao();
    if (resposta.temNova) {
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
    const link = info?.downloadUrl || info?.url;
    if (link) window.api.abrirLink(link);
  };
  $("btnFecharBanner").onclick = () => ($("bannerAtualizacao").hidden = true);
  $("btnChecarUpdate").onclick = verificar;
  window.api.aoNovaVersao(mostrarBanner); // checagem em segundo plano feita pelo processo principal
}
