// Links externos: só https e só sites conhecidos, sempre no navegador padrão.
const { shell } = require("electron");
const telemetria = require("./telemetria");

const HOSTS_PERMITIDOS = [
  "open.spotify.com", "accounts.spotify.com", "developer.spotify.com",
  "www.last.fm", "last.fm", "www.deezer.com", "github.com",
];

function abrirExterno(url) {
  let u;
  try {
    u = new URL(url);
  } catch {
    return; // URL inválida: ignora
  }
  if (u.protocol !== "https:" || !HOSTS_PERMITIDOS.includes(u.hostname)) return;
  shell.openExternal(url);
  // Só o serviço (spotify, last, deezer...), nunca o endereço: ele diria qual artista foi aberto.
  telemetria.registrar("link_aberto", { destino: u.hostname.replace(/^(www|open|developer|accounts)\./, "").split(".")[0] });
}

module.exports = { abrirExterno };
