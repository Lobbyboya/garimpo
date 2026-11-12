// Ponte segura entre a interface e o processo principal.
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("api", {
  lerConfig: () => ipcRenderer.invoke("config:get"),
  salvarConfig: (dados) => ipcRenderer.invoke("config:set", dados),
  lerCuradas: () => ipcRenderer.invoke("curadas:get"),
  lerCache: () => ipcRenderer.invoke("cache:get"),
  gerar: (opcoes) => ipcRenderer.invoke("lastfm:gerar", opcoes),
  aoProgresso: (fn) => {
    const ouvinte = (_e, msg) => fn(msg);
    ipcRenderer.on("lastfm:progresso", ouvinte);
    return () => ipcRenderer.removeListener("lastfm:progresso", ouvinte);
  },
  abrirLink: (url) => ipcRenderer.send("abrir-link", url),
});
