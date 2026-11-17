// Grupos de gosto da Curadoria, montados a partir dos gêneros das sementes.
const { titulo } = require("./tags");

const MAX_GRUPOS = 5;

/**
 * Agrupa as sementes por gênero, sem lista fixa de estilos: escolhe o gênero que mais pesa
 * entre as sementes ainda sem grupo (peso da semente × posição do gênero na lista dela),
 * junta quem tem esse gênero e repete, até MAX_GRUPOS. O resto vai para "Outros".
 * Devolve [{ nome, artistas: [nomes] }], ou [] se ninguém tem gênero conhecido.
 */
function agrupar(sementes) {
  let restantes = sementes.filter((s) => s.tags.length);
  const grupos = [];
  while (grupos.length < MAX_GRUPOS && restantes.length) {
    const forca = new Map();
    const quantos = new Map();
    for (const s of restantes) {
      s.tags.forEach((tag, pos) => {
        forca.set(tag, (forca.get(tag) || 0) + s.peso / (1 + pos));
        quantos.set(tag, (quantos.get(tag) || 0) + 1);
      });
    }
    // Grupo de um artista só não vale, a menos que seja o único jeito de ter algum grupo.
    const minimo = grupos.length ? 2 : 1;
    const candidatos = [...forca.entries()].filter(([tag]) => quantos.get(tag) >= minimo).sort((a, b) => b[1] - a[1]);
    if (!candidatos.length) break;
    const melhor = candidatos[0][0];
    const membros = restantes.filter((s) => s.tags.includes(melhor));
    grupos.push({ nome: titulo(melhor), artistas: membros.map((s) => s.nome) });
    restantes = restantes.filter((s) => !membros.includes(s));
  }
  if (!grupos.length) return [];
  const agrupados = new Set(grupos.flatMap((g) => g.artistas));
  const outros = sementes.filter((s) => !agrupados.has(s.nome)).map((s) => s.nome);
  if (outros.length) grupos.push({ nome: "Outros", artistas: outros });
  return grupos;
}

module.exports = { agrupar, MAX_GRUPOS };
