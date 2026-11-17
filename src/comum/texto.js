// Utilitários de texto usados no app todo.

// Chave para comparar nomes de artista: sem espaços nas pontas e em minúsculas.
const normalizar = (nome) => String(nome ?? "").trim().toLowerCase();

// Como normalizar, mas também sem acentos ("Sigur Rós" = "sigur ros").
const semAcento = (nome) => normalizar(nome).normalize("NFD").replace(/[̀-ͯ]/g, "");

// Texto curto vindo de fora (interface, APIs): só string, aparado e com tamanho máximo.
function textoCurto(valor, max = 200) {
  return typeof valor === "string" ? valor.trim().slice(0, max) : "";
}

// Devolve o link se for https válido; senão null.
function linkHttps(valor) {
  try {
    const u = new URL(String(valor || ""));
    return u.protocol === "https:" ? u.toString() : null;
  } catch {
    return null;
  }
}

module.exports = { normalizar, semAcento, textoCurto, linkHttps };
