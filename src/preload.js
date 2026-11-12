// Ponte segura entre a interface e o processo principal.
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("api", {
  lerConfig: () => ipcRenderer.invoke("config:get"),
  salvarConfig: (dados) => ipcRenderer.invoke("config:set", dados),
  testarLastfm: (dados) => ipcRenderer.invoke("lastfm:testar", dados),
  removerLastfm: () => ipcRenderer.invoke("lastfm:remover"),
  conectarSpotify: () => ipcRenderer.invoke("spotify:conectar"),
  desconectarSpotify: () => ipcRenderer.invoke("spotify:desconectar"),
  lerCache: () => ipcRenderer.invoke("cache:get"),
  gerar: (opcoes) => ipcRenderer.invoke("recs:gerar", opcoes),
  aoProgresso: (fn) => {
    const ouvinte = (_e, msg) => fn(msg);
    ipcRenderer.on("recs:progresso", ouvinte);
    return () => ipcRenderer.removeListener("recs:progresso", ouvinte);
  },
  abrirLink: (url) => ipcRenderer.send("abrir-link", url),
});
