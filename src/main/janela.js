// A janela do Garimpo.
const { BrowserWindow } = require("electron");
const path = require("path");
const fs = require("fs");
const { abrirExterno } = require("./links");
const { fundoInicial } = require("./aparencia");

// Ícone da janela no modo de desenvolvimento (o app instalado usa o ícone do executável).
const ICONE_DEV = path.join(__dirname, "..", "..", "build", "icon.png");

function criarJanela() {
  const janela = new BrowserWindow({
    width: 1200,
    height: 820,
    minWidth: 720,
    minHeight: 500,
    backgroundColor: fundoInicial(),
    show: false, // só aparece depois de pintar, já com o tema escolhido (sem piscar outra cor)
    title: "Garimpo",
    autoHideMenuBar: true,
    ...(fs.existsSync(ICONE_DEV) ? { icon: ICONE_DEV } : {}),
    webPreferences: {
      preload: path.join(__dirname, "..", "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  // Links externos abrem no navegador padrão, nunca dentro do app.
  janela.webContents.setWindowOpenHandler(({ url }) => {
    abrirExterno(url);
    return { action: "deny" };
  });
  // A janela nunca sai da própria interface: links vão para o navegador e arquivos arrastados
  // para cima dela são ignorados (um .html solto teria acesso à ponte do app).
  janela.webContents.on("will-navigate", (e, url) => {
    e.preventDefault();
    if (/^https?:/i.test(url)) abrirExterno(url);
  });

  janela.once("ready-to-show", () => janela.show());
  janela.loadFile(path.join(__dirname, "..", "renderer", "index.html"));
  return janela;
}

module.exports = { criarJanela };
