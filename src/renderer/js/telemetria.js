// Estatísticas de uso (opt-in): a pergunta da primeira vez e a opção nas Configurações.
import { $, msg, limparErro } from "./util.js";

let situacao = { disponivel: false, escolha: null };

export function definirSituacao(s) {
  situacao = s;
}

export function pintarTelemetria() {
  $("blocoTelemetria").hidden = !situacao.disponivel;
  $("cfgTelemetria").checked = situacao.escolha === true;
}

async function escolher(sim) {
  situacao = await window.api.telemetriaEscolher(sim);
  pintarTelemetria();
}

// Pergunta uma vez, depois que a pessoa já configurou o app. Fechar com Esc não conta como
// resposta: a pergunta volta na próxima abertura.
export function perguntarSeNecessario() {
  if (situacao.disponivel && situacao.escolha === null) $("perguntaTelemetria").showModal();
}

export function ligarTelemetria() {
  $("cfgTelemetria").onchange = async (e) => {
    await escolher(e.target.checked);
    msg("telMsg", e.target.checked ? "Obrigado! As estatísticas serão enviadas." : "Desligado. Nada mais será enviado.", "ok");
  };
  $("telApagar").onclick = async () => {
    msg("telMsg", "Apagando...");
    try {
      await window.api.telemetriaApagar();
      msg("telMsg", "Pronto: o que esta instalação já enviou foi apagado.", "ok");
    } catch (e) {
      msg("telMsg", limparErro(e), "erro");
    }
  };
  $("telSim").onclick = async () => {
    await escolher(true);
    $("perguntaTelemetria").close();
  };
  $("telNao").onclick = async () => {
    await escolher(false);
    $("perguntaTelemetria").close();
  };
}
