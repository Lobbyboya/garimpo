// dispensados.json: artistas que a pessoa marcou como "Não curti". Não aparecem na tela nem
// voltam nas próximas recomendações (até ela restaurar em Configurações).
const { caminho } = require("./arquivos");
const { lerJson, salvarJson } = require("../comum/json");
const { normalizar, textoCurto } = require("../comum/texto");

const MAX = 2000;
const arquivo = () => caminho("dispensados.json");

function listar() {
  const lista = lerJson(arquivo(), []);
  return Array.isArray(lista) ? lista : [];
}

const nomes = () => new Set(listar().map((d) => normalizar(d.nome)));

// Dispensa o artista, ou restaura se já estava dispensado. Devolve { lista, dispensado }.
function alternar(nome) {
  const limpo = textoCurto(nome);
  if (!limpo) throw new Error("Artista sem nome.");
  const lista = listar();
  const i = lista.findIndex((d) => normalizar(d.nome) === normalizar(limpo));
  if (i >= 0) lista.splice(i, 1);
  else lista.unshift({ nome: limpo, em: new Date().toISOString() });
  salvarJson(arquivo(), lista.slice(0, MAX));
  return { lista, dispensado: i < 0 };
}

module.exports = { listar, nomes, alternar };
