// Atualização automática (electron-updater): baixa a versão nova em segundo plano e oferece
// "Reiniciar e atualizar". Só no app instalado pelo instalador do Windows ou pelo AppImage;
// rodando pelo código ou por um pacote do sistema (AUR), fica o aviso com link de atualizacoes.js.
const { app } = require("electron");

let atualizador = null;
let pronta = null; // versão já baixada, esperando reinício

function suportada() {
  if (!app.isPackaged) return false;
  if (process.platform === "win32") return true;
  return process.platform === "linux" && Boolean(process.env.APPIMAGE);
}

// Começa a vigiar atualizações. Devolve false quando não se aplica (aí vale o aviso com link).
function iniciar(janela) {
  if (!suportada()) return false;
  ({ autoUpdater: atualizador } = require("electron-updater"));
  // Só para testes: aponta para um servidor local em vez das releases do GitHub.
  if (process.env.GARIMPO_ATUALIZACAO_URL) atualizador.setFeedURL({ provider: "generic", url: process.env.GARIMPO_ATUALIZACAO_URL });
  atualizador.autoDownload = true;
  atualizador.autoInstallOnAppQuit = true; // se a pessoa só fechar, instala ao sair
  atualizador.on("update-downloaded", (info) => {
    pronta = info.version;
    if (!janela.isDestroyed()) janela.webContents.send("updater:pronta", { versao: info.version });
  });
  atualizador.on("error", () => {
    // sem internet ou release sem arquivos de atualização: tenta na próxima abertura
  });
  setTimeout(() => atualizador.checkForUpdates().catch(() => {}), 5000);
  return true;
}

const versaoPronta = () => pronta;

function instalarAgora() {
  if (atualizador && pronta) atualizador.quitAndInstall();
}

module.exports = { iniciar, versaoPronta, instalarAgora, suportada };
