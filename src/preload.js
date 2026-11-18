// Ponte segura entre a interface e o processo principal.
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("api", {
  lerConfig: () => ipcRenderer.invoke("config:get"),
  salvarConfig: (dados) => ipcRenderer.invoke("config:set", dados),
  testarLastfm: (dados) => ipcRenderer.invoke("lastfm:testar", dados),
  removerLastfm: () => ipcRenderer.invoke("lastfm:remover"),
  conectarSpotify: () => ipcRenderer.invoke("spotify:conectar"),
  cancelarSpotify: () => ipcRenderer.invoke("spotify:cancelar"),
  desconectarSpotify: () => ipcRenderer.invoke("spotify:desconectar"),
  lerCache: () => ipcRenderer.invoke("cache:get"),
  gerar: (opcoes) => ipcRenderer.invoke("recs:gerar", opcoes),
  aoProgresso: (fn) => {
    const ouvinte = (_e, msg) => fn(msg);
    ipcRenderer.on("recs:progresso", ouvinte);
    return () => ipcRenderer.removeListener("recs:progresso", ouvinte);
  },
  listarSalvos: () => ipcRenderer.invoke("salvos:listar"),
  alternarSalvo: (artista) => ipcRenderer.invoke("salvos:alternar", artista),
  listarDispensados: () => ipcRenderer.invoke("dispensados:listar"),
  alternarDispensado: (nome, aba) => ipcRenderer.invoke("dispensados:alternar", { nome, aba }),
  marcarOuvido: (nome, ouvido) => ipcRenderer.invoke("salvos:ouvido", { nome, ouvido }),
  telemetriaSituacao: () => ipcRenderer.invoke("telemetria:situacao"),
  telemetriaEscolher: (sim) => ipcRenderer.invoke("telemetria:escolher", sim),
  telemetriaApagar: () => ipcRenderer.invoke("telemetria:apagar"),
  registrarEvento: (evento, dados) => ipcRenderer.send("telemetria:evento", evento, dados),
  topFaixas: (artista) => ipcRenderer.invoke("faixas:top", artista),
  abrirLink: (url) => ipcRenderer.send("abrir-link", url),
  checarAtualizacao: () => ipcRenderer.invoke("updater:checar"),
  aoNovaVersao: (fn) => {
    const ouvinte = (_e, info) => fn(info);
    ipcRenderer.on("updater:nova-versao", ouvinte);
    return () => ipcRenderer.removeListener("updater:nova-versao", ouvinte);
  },
});
