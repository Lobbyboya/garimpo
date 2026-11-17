// Tokens guardados cifrados pelo sistema (DPAPI no Windows, chaveiro no Linux), quando disponível.
const { safeStorage } = require("electron");

function guardar(texto) {
  return safeStorage.isEncryptionAvailable()
    ? { enc: safeStorage.encryptString(texto).toString("base64") }
    : { txt: texto };
}

// Erro de "cofre fechado": o segredo existe, mas o sistema não deixou decifrar agora
// (ex.: chaveiro do GNOME ainda bloqueado). Quem chama NÃO deve apagar o segredo por causa disso.
class CofreIndisponivel extends Error {
  constructor() {
    super("Não foi possível abrir o cofre de senhas do sistema. Se o chaveiro estiver bloqueado, desbloqueie e tente de novo.");
    this.cofreIndisponivel = true;
  }
}

// "" se não há nada guardado. Lança CofreIndisponivel se há, mas não deu para decifrar.
function ler(guardado) {
  if (!guardado) return "";
  if (typeof guardado === "string") return guardado; // versões antigas guardavam em texto puro
  if (guardado.enc) {
    try {
      return safeStorage.decryptString(Buffer.from(guardado.enc, "base64"));
    } catch {
      throw new CofreIndisponivel();
    }
  }
  return guardado.txt || "";
}

module.exports = { guardar, ler, CofreIndisponivel };
