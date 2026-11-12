// Processo principal do Electron: janela, configuração, cache e ligação com Spotify e Last.fm.
const { app, BrowserWindow, ipcMain, shell, safeStorage } = require("electron");
const path = require("path");
const fs = require("fs");
const lastfm = require("./lastfm");
const spotify = require("./spotify");
const recomendar = require("./recomendar");

// Client ID do Spotify que já vem no app. Vazio = cada pessoa informa o seu em Configurações.
// O Client ID não é segredo (o login usa PKCE), mas o Spotify limita cada um a 5 usuários.
const SPOTIFY_CLIENT_ID_PADRAO = "";

// Pasta fixa para config e cache, igual no modo de desenvolvimento e no app instalado.
app.setPath("userData", path.join(app.getPath("appData"), "garimpo"));

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
  return { apiKey: "", usuario: "", spotifyClientId: "", spotify: null, manual: [], ...lerJson(arquivo("config.json"), {}) };
}

function salvarConfig(config) {
  salvarJson(arquivo("config.json"), config);
}

// O token de renovação do Spotify é guardado cifrado pelo Windows (DPAPI), quando disponível.
function guardarSegredo(texto) {
  return safeStorage.isEncryptionAvailable()
    ? { enc: safeStorage.encryptString(texto).toString("base64") }
    : { txt: texto };
}

function lerSegredo(guardado) {
  if (!guardado) return "";
  if (guardado.enc) {
    try {
      return safeStorage.decryptString(Buffer.from(guardado.enc, "base64"));
    } catch {
      return "";
    }
  }
  return guardado.txt || "";
}

function clientIdDe(config) {
  return config.spotifyClientId || SPOTIFY_CLIENT_ID_PADRAO;
}

// O que a interface pode ver: nunca a chave nem os tokens.
function publico(config = lerConfig()) {
  return {
    usuario: config.usuario,
    temChave: Boolean(config.apiKey),
    spotifyClientId: config.spotifyClientId,
    temClientIdPadrao: Boolean(SPOTIFY_CLIENT_ID_PADRAO),
    spotifyConectado: Boolean(config.spotify?.refresh),
    spotifyNome: config.spotify?.nome || "",
    spotifyRedirect: spotify.REDIRECT,
    manual: config.manual,
  };
}

// Devolve um token de acesso válido do Spotify, renovando se preciso. null se não conectado.
async function tokenSpotify() {
  const config = lerConfig();
  const sp = config.spotify;
  if (!sp?.refresh) return null;
  if (sp.access && sp.expira > Date.now() + 60_000) return sp.access;
  try {
    const novo = await spotify.renovar(clientIdDe(config), lerSegredo(sp.refresh));
    config.spotify = {
      ...sp,
      access: novo.access,
      expira: novo.expira,
      refresh: novo.refresh ? guardarSegredo(novo.refresh) : sp.refresh,
    };
    salvarConfig(config);
    return novo.access;
  } catch (e) {
    if (e.codigo === "invalid_grant") {
      config.spotify = null; // acesso revogado: precisa conectar de novo
      salvarConfig(config);
    }
    throw e;
  }
}

function criarJanela() {
  const win = new BrowserWindow({
    width: 1200,
    height: 820,
    minWidth: 720,
    minHeight: 500,
    backgroundColor: "#0f1115",
    title: "Garimpo",
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

const HOSTS_PERMITIDOS = [
  "open.spotify.com", "accounts.spotify.com", "developer.spotify.com",
  "www.last.fm", "last.fm", "www.deezer.com",
];

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

function limparLista(lista) {
  if (!Array.isArray(lista)) return null;
  const vistos = new Set();
  return lista
    .map((s) => String(s).trim().slice(0, 100))
    .filter((s) => s && !vistos.has(s.toLowerCase()) && vistos.add(s.toLowerCase()))
    .slice(0, 100);
}

// ---------- IPC ----------

ipcMain.handle("config:get", () => publico());

// Campos ausentes (undefined) ficam como estão. apiKey vazia mantém a chave atual.
ipcMain.handle("config:set", (_e, dados = {}) => {
  const config = lerConfig();
  if (typeof dados.usuario === "string") config.usuario = dados.usuario.trim();
  if (typeof dados.apiKey === "string" && dados.apiKey.trim()) config.apiKey = dados.apiKey.trim();
  if (typeof dados.spotifyClientId === "string") {
    const novo = dados.spotifyClientId.trim();
    if (novo !== config.spotifyClientId) config.spotify = null; // outro app do Spotify: login antigo não vale
    config.spotifyClientId = novo;
  }
  const manual = limparLista(dados.manual);
  if (manual) config.manual = manual;
  salvarConfig(config);
  return publico(config);
});

ipcMain.handle("lastfm:remover", () => {
  const config = lerConfig();
  config.apiKey = "";
  salvarConfig(config);
  return publico(config);
});

// Confere se a chave e o usuário funcionam antes de salvar.
ipcMain.handle("lastfm:testar", async (_e, { apiKey, usuario } = {}) => {
  const chave = String(apiKey || "").trim() || lerConfig().apiKey;
  const nome = String(usuario || "").trim();
  if (!chave) throw new Error("Cole a sua API key.");
  if (!nome) throw new Error("Informe o seu usuário do Last.fm.");
  await lastfm.topArtistas(chave, nome, "overall", 1);
  const config = lerConfig();
  config.apiKey = chave;
  config.usuario = nome;
  salvarConfig(config);
  return publico(config);
});

ipcMain.handle("spotify:conectar", async () => {
  const config = lerConfig();
  const clientId = clientIdDe(config);
  if (!clientId) throw new Error("Informe o Client ID do Spotify primeiro.");
  const tokens = await spotify.login(clientId, (url) => shell.openExternal(url));
  let nome = "";
  try {
    nome = await spotify.perfil(tokens.access);
  } catch {
    // sem nome: segue conectado mesmo assim
  }
  const atual = lerConfig();
  atual.spotify = { refresh: guardarSegredo(tokens.refresh), access: tokens.access, expira: tokens.expira, nome };
  salvarConfig(atual);
  return publico(atual);
});

ipcMain.handle("spotify:desconectar", () => {
  const config = lerConfig();
  config.spotify = null;
  salvarConfig(config);
  return publico(config);
});

ipcMain.handle("cache:get", () => lerJson(arquivo("cache.json"), null));

ipcMain.handle("recs:gerar", async (e, opcoes) => {
  const config = lerConfig();
  const avisos = [];
  let spotifyToken = null;
  try {
    spotifyToken = await tokenSpotify();
  } catch (erro) {
    avisos.push("Spotify: " + erro.message);
  }

  const escolhas = {
    periodo: opcoes?.periodo || "longo",
    sementes: Math.min(Math.max(Number(opcoes?.sementes) || 20, 1), 50),
  };
  const resultado = await recomendar.gerar({
    fontes: {
      spotifyToken,
      lastfm: config.apiKey && config.usuario ? { apiKey: config.apiKey, usuario: config.usuario } : null,
      manual: config.manual,
    },
    ...escolhas,
    progresso: (msg) => e.sender.send("recs:progresso", msg),
  });
  const cache = { ...resultado, opcoes: escolhas, avisos: [...avisos, ...resultado.avisos], geradoEm: new Date().toISOString() };
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
