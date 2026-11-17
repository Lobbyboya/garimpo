// Utilitários da interface.

export const $ = (id) => document.getElementById(id);

// Escapa texto para colocar dentro de HTML.
export function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// Linha de status no topo da página.
export function status(texto, erro = false) {
  $("status").textContent = texto || "";
  $("status").classList.toggle("erro", erro);
}

// Mensagem curta embaixo de um formulário (tipo: "", "ok" ou "erro").
export function msg(id, texto, tipo = "") {
  const el = $(id);
  el.textContent = texto || "";
  el.className = "msg" + (tipo ? " " + tipo : "");
}

// O Electron prefixa erros do IPC com "Error invoking remote method '...': Error: ".
export function limparErro(e) {
  return String(e?.message || e).replace(/^Error invoking remote method '[^']+': (Error: )?/, "");
}

export const chaveNome = (nome) => String(nome || "").trim().toLowerCase();

export const termoBusca = () => $("busca").value.trim().toLowerCase();

// O artista combina com o termo da busca? Procura no nome, gênero, grupo e artistas de origem.
export function combina(r, termo) {
  return !termo || [r.nome, r.genero, r.grupo, ...(r.sementes || [])].join(" ").toLowerCase().includes(termo);
}
