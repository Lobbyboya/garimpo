// Processo principal do Electron: janela, configuração, cache e chamadas ao Last.fm.
const { app, BrowserWindow, ipcMain, shell } = require("electron");
const path = require("path");
const fs = require("fs");
const lastfm = require("./lastfm");

const USUARIO_PADRAO = ""; // cada pessoa informa o próprio usuário em Configurações

// Pasta fixa para config e cache, igual no modo de desenvolvimento e no app instalado
// (senão o app instalado usaria o nome "Recomendador de bandas" e perderia a chave salva).
app.setPath("userData", path.join(app.getPath("appData"), "recomendador-de-bandas"));

// Ícone da janela no modo de desenvolvimento (o app instalado usa o ícone do .exe).
const ICONE_DEV = path.join(__dirname, "..", "build", "icon.png");

function arquivo(nome) {
  return path.join(app.getPath("userData"), nome);
}

function lerJson(caminho, padrao) {
  try {
    return JSON.parse(fs.readFileSync(caminho, "utf8"));
  } catch {
    return padrao;
  }
}

function salvarJson(caminho, dados) {
  fs.mkdirSync(path.dirname(caminho), { recursive: true });
  fs.writeFileSync(caminho, JSON.stringify(dados, null, 2));
}

function lerConfig() {
  return { apiKey: "", usuario: USUARIO_PADRAO, ...lerJson(arquivo("config.json"), {}) };
}

function criarJanela() {
  const win = new BrowserWindow({
    width: 1200,
    height: 820,
    minWidth: 720,
    minHeight: 500,
    backgroundColor: "#0f1115",
    title: "Recomendador de bandas",
    autoHideMenuBar: true,
    ...(fs.existsSync(ICONE_DEV) ? { icon: ICONE_DEV } : {}),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  // Links externos abrem no navegador padrão, nunca dentro do app.
  win.webContents.setWindowOpenHandler(({ url }) => {
    abrirExterno(url);
    return { action: "deny" };
  });
  win.webContents.on("will-navigate", (e, url) => {
    if (!url.startsWith("file://")) {
      e.preventDefault();
      abrirExterno(url);
    }
  });

  win.loadFile(path.join(__dirname, "renderer", "index.html"));
}

const HOSTS_PERMITIDOS = ["open.spotify.com", "www.last.fm", "last.fm"];

function abrirExterno(url) {
  try {
    const u = new URL(url);
    if (u.protocol === "https:" && HOSTS_PERMITIDOS.includes(u.hostname)) {
      shell.openExternal(url);
    }
  } catch {
    // URL inválida: ignora
  }
}

// ---------- IPC ----------

ipcMain.handle("config:get", () => {
  const c = lerConfig();
  return { usuario: c.usuario, temChave: Boolean(c.apiKey) };
});

ipcMain.handle("config:set", (_e, { apiKey, usuario }) => {
  const atual = lerConfig();
  const nova = {
    apiKey: typeof apiKey === "string" && apiKey.trim() ? apiKey.trim() : atual.apiKey,
    usuario: typeof usuario === "string" && usuario.trim() ? usuario.trim() : atual.usuario,
  };
  salvarJson(arquivo("config.json"), nova);
  return { usuario: nova.usuario, temChave: Boolean(nova.apiKey) };
});

ipcMain.handle("curadas:get", () => {
  return JSON.parse(fs.readFileSync(path.join(__dirname, "dados.json"), "utf8"));
});

ipcMain.handle("cache:get", () => lerJson(arquivo("cache.json"), null));

ipcMain.handle("lastfm:gerar", async (e, opcoes) => {
  const { apiKey, usuario } = lerConfig();
  if (!apiKey) throw new Error("Configure sua chave de API do Last.fm primeiro.");
  if (!usuario) throw new Error("Informe seu usuário do Last.fm em Configurações.");

  const progresso = (msg) => e.sender.send("lastfm:progresso", msg);
  const resultado = await lastfm.gerarRecomendacoes({
    apiKey,
    usuario,
    periodo: opcoes?.periodo || "overall",
    sementes: Number(opcoes?.sementes) || 20,
    progresso,
  });
  const cache = { ...resultado, usuario, geradoEm: new Date().toISOString() };
  salvarJson(arquivo("cache.json"), cache);
  return cache;
});

ipcMain.on("abrir-link", (_e, url) => abrirExterno(url));

app.whenReady().then(() => {
  criarJanela();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) criarJanela();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
