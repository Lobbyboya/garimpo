// "Não curti": artistas dispensados somem da tela e não voltam nas próximas recomendações.
import { $, chaveNome, limparErro, status } from "./util.js";
import { estado, acoes } from "./estado.js";

let desfazer = null; // temporizador do aviso "Desfazer"

export function ehDispensado(nome) {
  const k = chaveNome(nome);
  return estado.dispensados.some((d) => chaveNome(d.nome) === k);
}

// As recomendações que a pessoa ainda quer ver.
export const visiveis = (recs) => (recs || []).filter((r) => !ehDispensado(r.nome));

function avisar(texto, aoDesfazer) {
  const aviso = $("avisoFlutuante");
  $("avisoTexto").textContent = texto;
  $("avisoDesfazer").onclick = async () => {
    aviso.hidden = true;
    await aoDesfazer();
  };
  aviso.hidden = false;
  clearTimeout(desfazer);
  desfazer = setTimeout(() => (aviso.hidden = true), 6000);
}

export async function alternarDispensado(nome) {
  try {
    estado.dispensados = await window.api.alternarDispensado(nome, estado.aba);
  } catch (e) {
    status(limparErro(e), true);
    return;
  }
  acoes.render();
  pintarDispensados();
}

// Dispensa a partir de um cartão, com "Desfazer" por alguns segundos.
export async function dispensar(r) {
  await alternarDispensado(r.nome);
  avisar(`${r.nome} não vai mais aparecer.`, () => alternarDispensado(r.nome));
}

// Lista nas Configurações, com "Restaurar".
export function pintarDispensados() {
  const lista = $("listaDispensados");
  $("contDispensados").textContent = estado.dispensados.length
    ? `${estado.dispensados.length} ${estado.dispensados.length === 1 ? "artista" : "artistas"} fora das suas recomendações.`
    : "Nenhum. Use o botão \"Não curti\" de um cartão para tirar um artista das recomendações.";
  lista.replaceChildren(...estado.dispensados.map((d) => {
    const li = document.createElement("li");
    const nome = document.createElement("span");
    nome.textContent = d.nome;
    const restaurar = document.createElement("button");
    restaurar.type = "button";
    restaurar.className = "textual";
    restaurar.textContent = "Restaurar";
    restaurar.onclick = () => alternarDispensado(d.nome);
    li.append(nome, restaurar);
    return li;
  }));
}
