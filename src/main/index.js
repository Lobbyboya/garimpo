// Ponto de entrada do processo principal: ciclo de vida do app.
const { app, BrowserWindow } = require("electron");
const arquivos = require("../dados/arquivos");
const { registrarCanais } = require("./ipc");
const { criarJanela } = require("./janela");
const atualizacoes = require("./atualizacoes");
const telemetria = require("./telemetria");
const config = require("../dados/config");
const { aplicarModo } = require("./aparencia");

arquivos.definirPasta(); // antes de qualquer leitura de config ou cache

let janela = null;

// Uma instância só: duas gravando a mesma config (e renovando o mesmo login do Spotify)
// sobrescrevem uma à outra. Abrir de novo só traz a janela que já existe para a frente.
const unica = app.requestSingleInstanceLock();
if (!unica) {
  app.quit();
} else {
  iniciar();
}

function abrirJanela() {
  janela = criarJanela();
  atualizacoes.checarEmSegundoPlano(janela, app.getVersion());
}

function iniciar() {
  registrarCanais();

  app.on("second-instance", () => {
    if (!janela || janela.isDestroyed()) return;
    if (janela.isMinimized()) janela.restore();
    janela.focus();
  });

  app.whenReady().then(() => {
    aplicarModo(config.publico().aparencia.modo); // antes da janela, para ela já abrir no modo certo
    telemetria.iniciar({ caminho: arquivos.caminho("telemetria.json"), versaoApp: app.getVersion() });
    telemetria.registrar("app_aberto");
    abrirJanela();
    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) abrirJanela();
    });
  });

  // Ao fechar, tenta mandar o que estiver na fila de estatísticas (no máximo 3 s); o resto vai na próxima vez.
  let saindo = false;
  app.on("before-quit", (e) => {
    if (saindo) return;
    saindo = true;
    e.preventDefault();
    Promise.race([telemetria.enviar(), new Promise((ok) => setTimeout(ok, 3000))]).finally(() => app.quit());
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });
}
