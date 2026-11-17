// Processo principal do Electron: janela, configuração, cache e ligação com Spotify e Last.fm.
const { app, BrowserWindow, ipcMain, shell, safeStorage, nativeTheme } = require("electron");
const path = require("path");
const fs = require("fs");
const lastfm = require("./lastfm");
const spotify = require("./spotify");
const recomendar = require("./recomendar");
const updater = require("./updater");
const deezer = require("./deezer");
const telemetria = require("./telemetria");

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

// Os tokens do Spotify são guardados cifrados pelo sistema (DPAPI no Windows, chaveiro no Linux), quando disponível.
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
    versao: app.getVersion(),
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
  // Versões antigas guardavam o token de acesso em texto puro (string).
  const acesso = typeof sp.access === "string" ? sp.access : lerSegredo(sp.access);
  if (acesso && sp.expira > Date.now() + 60_000) return acesso;
  const refresh = lerSegredo(sp.refresh);
  if (!refresh) {
    // Não deu para decifrar (ex.: o chaveiro do sistema foi trocado): o login guardado não serve mais.
    config.spotify = null;
    salvarConfig(config);
    throw new Error("O login guardado não pôde ser lido. Conecte o Spotify de novo em Configurações.");
  }
  try {
    const novo = await spotify.renovar(clientIdDe(config), refresh);
    config.spotify = {
      ...sp,
      access: guardarSegredo(novo.access),
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
    backgroundColor: nativeTheme.shouldUseDarkColors ? "#262624" : "#faf9f5", // igual ao fundo da interface, sem piscar ao abrir
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

  // Checa atualizações silenciosamente em segundo plano após inicialização
  setTimeout(async () => {
    try {
      const info = await updater.checarAtualizacao({ versaoAtual: app.getVersion() });
      if (info?.temNova && !win.isDestroyed()) {
        win.webContents.send("updater:nova-versao", info);
      }
    } catch {
      // Ignora erro em verificação de fundo
    }
  }, 4000);
}

const HOSTS_PERMITIDOS = [
  "open.spotify.com", "accounts.spotify.com", "developer.spotify.com",
  "www.last.fm", "last.fm", "www.deezer.com", "github.com",
];

function abrirExterno(url) {
  try {
    const u = new URL(url);
    if (u.protocol === "https:" && HOSTS_PERMITIDOS.includes(u.hostname)) {
      shell.openExternal(url);
      // Só o serviço (spotify, last, deezer...), nunca o endereço: ele diria qual artista foi aberto.
      telemetria.registrar("link_aberto", { destino: u.hostname.replace(/^(www|open|developer|accounts)\./, "").split(".")[0] });
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
  atual.spotify = { refresh: guardarSegredo(tokens.refresh), access: guardarSegredo(tokens.access), expira: tokens.expira, nome };
  salvarConfig(atual);
  return publico(atual);
});

ipcMain.handle("spotify:cancelar", () => spotify.cancelarLogin());

ipcMain.handle("spotify:desconectar", () => {
  const config = lerConfig();
  config.spotify = null;
  salvarConfig(config);
  return publico(config);
});

ipcMain.handle("cache:get", () => lerJson(arquivo("cache.json"), null));

ipcMain.handle("updater:checar", () => updater.checarAtualizacao({ versaoAtual: app.getVersion() }));

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
  const inicio = Date.now();
  const fontesUsadas = [
    spotifyToken && "spotify",
    config.apiKey && config.usuario && "lastfm",
    config.manual?.length && "manual",
  ].filter(Boolean);
  let resultado;
  try {
    resultado = await recomendar.gerar({
    fontes: {
      spotifyToken,
      lastfm: config.apiKey && config.usuario ? { apiKey: config.apiKey, usuario: config.usuario } : null,
      manual: config.manual,
    },
    ...escolhas,
    progresso: (msg) => {
      if (!e.sender.isDestroyed()) e.sender.send("recs:progresso", msg); // a janela pode ter sido fechada
    },
  });
  } catch (erro) {
    telemetria.registrar("garimpo", { fontes: fontesUsadas, ...escolhas, duracao_ms: Date.now() - inicio, erro: true });
    throw erro;
  }
  telemetria.registrar("garimpo", {
    fontes: fontesUsadas,
    motor: resultado.motor,
    ...escolhas,
    recomendacoes: resultado.recs.length,
    duracao_ms: Date.now() - inicio,
    erro: false,
  });
  const cache = { ...resultado, opcoes: escolhas, avisos: [...avisos, ...resultado.avisos], geradoEm: new Date().toISOString() };
  salvarJson(arquivo("cache.json"), cache);
  return cache;
});

// ---------- Salvos: artistas que a pessoa quer ouvir depois ----------
// Ficam em salvos.json, separados do cache: as recomendações mudam com o tempo, os salvos não.

const chaveArtista = (nome) => String(nome || "").trim().toLowerCase();

function lerSalvos() {
  const lista = lerJson(arquivo("salvos.json"), []);
  return Array.isArray(lista) ? lista : [];
}

// Só guarda texto curto e links https: o arquivo é lido de volta pela interface.
function texto(v, max = 200) {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}
function linkHttps(v) {
  try {
    const u = new URL(String(v || ""));
    return u.protocol === "https:" ? u.toString() : null;
  } catch {
    return null;
  }
}

function limparArtista(a = {}) {
  return {
    nome: texto(a.nome),
    genero: texto(a.genero, 60) || null,
    grupo: texto(a.grupo, 60) || null,
    img: linkHttps(a.img),
    spotify: linkHttps(a.spotify),
    spotifyDireto: Boolean(a.spotifyDireto),
    lastfm: linkHttps(a.lastfm),
    deezer: linkHttps(a.deezer),
    sementes: (Array.isArray(a.sementes) ? a.sementes : []).map((s) => texto(s, 100)).filter(Boolean).slice(0, 10),
  };
}

ipcMain.handle("salvos:listar", () => lerSalvos());

// Salva o artista (com uma foto do momento, já que ele pode sumir das recomendações) ou tira dos salvos.
ipcMain.handle("salvos:alternar", (_e, artista) => {
  const novo = limparArtista(artista);
  if (!novo.nome) throw new Error("Artista sem nome.");
  const lista = lerSalvos();
  const i = lista.findIndex((s) => chaveArtista(s.nome) === chaveArtista(novo.nome));
  if (i >= 0) lista.splice(i, 1);
  else lista.unshift({ ...novo, salvoEm: new Date().toISOString(), ouvido: false });
  telemetria.registrar(i >= 0 ? "salvo_removido" : "salvo_adicionado", { aba: texto(artista?.aba, 20) });
  salvarJson(arquivo("salvos.json"), lista.slice(0, 1000));
  return lista;
});

ipcMain.handle("salvos:ouvido", (_e, { nome, ouvido } = {}) => {
  const lista = lerSalvos();
  const item = lista.find((s) => chaveArtista(s.nome) === chaveArtista(nome));
  if (item) {
    item.ouvido = Boolean(ouvido);
    telemetria.registrar("salvo_ouvido", { ouvido: item.ouvido });
    salvarJson(arquivo("salvos.json"), lista);
  }
  return lista;
});

// Top músicas de um artista no Deezer, com prévia de 30 s. Com o id do Deezer (quando a
// recomendação veio de lá) não há risco de pegar outro artista com nome parecido.
ipcMain.handle("faixas:top", async (_e, { nome, deezerId } = {}) => {
  let id = /^\d{1,12}$/.test(String(deezerId || "")) ? String(deezerId) : null;
  if (!id) {
    const alvo = String(nome || "").trim().slice(0, 200);
    if (!alvo) return [];
    id = (await deezer.buscarArtista(alvo))?.id || null;
  }
  telemetria.registrar("previas_abertas");
  const faixas = await deezer.topFaixas(id, 3);
  // Só repassa áudio https do CDN do Deezer, que é o único liberado na CSP.
  const doDeezer = (url) => {
    try {
      const u = new URL(url);
      return u.protocol === "https:" && u.hostname.endsWith(".dzcdn.net");
    } catch {
      return false;
    }
  };
  return faixas.map((f) => ({
    titulo: String(f.titulo || ""),
    preview: doDeezer(f.preview) ? f.preview : null,
    link: f.link || null,
  }));
});

ipcMain.on("abrir-link", (_e, url) => abrirExterno(url));

// ---------- Estatísticas de uso (opcionais) ----------

ipcMain.handle("telemetria:situacao", () => telemetria.situacao());
ipcMain.handle("telemetria:escolher", (_e, sim) => {
  const s = telemetria.escolher(sim === true);
  if (sim === true) telemetria.registrar("app_aberto");
  return s;
});
ipcMain.handle("telemetria:apagar", () => telemetria.apagarEnviados());
// A interface só pode registrar estes eventos; o módulo ainda confere os campos.
const EVENTOS_DA_INTERFACE = new Set(["aba_aberta", "previa_tocada"]);
ipcMain.on("telemetria:evento", (_e, evento, dados) => {
  if (EVENTOS_DA_INTERFACE.has(evento)) telemetria.registrar(evento, dados);
});

app.whenReady().then(() => {
  telemetria.iniciar({ caminho: arquivo("telemetria.json"), versaoApp: app.getVersion() });
  telemetria.registrar("app_aberto");
  criarJanela();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) criarJanela();
  });
});

// Ao fechar, tenta mandar o que estiver na fila (no máximo 3 s); o que sobrar vai na próxima vez.
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
