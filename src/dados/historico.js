// historico.json: todo artista que o Garimpo já recomendou, para marcar os "Novos" (nunca
// recomendados antes). Só nomes normalizados, sem mais nada.
const { caminho } = require("./arquivos");
const { lerJson, salvarJson } = require("../comum/json");
const { normalizar } = require("../comum/texto");

const MAX = 10000;
const arquivo = () => caminho("historico.json");

/**
 * Marca r.novo nas recomendações e acrescenta todas ao histórico. Na primeira vez (histórico
 * vazio) ninguém é marcado: seria tudo "novo", o que não diz nada.
 */
function marcarNovos(recs) {
  const vistos = lerJson(arquivo(), []);
  const conhecidos = new Set(Array.isArray(vistos) ? vistos : []);
  const primeiraVez = conhecidos.size === 0;
  for (const r of recs) {
    const chave = normalizar(r.nome);
    r.novo = !primeiraVez && !conhecidos.has(chave);
    conhecidos.add(chave);
  }
  salvarJson(arquivo(), [...conhecidos].slice(-MAX), { compacto: true });
}

module.exports = { marcarNovos };
