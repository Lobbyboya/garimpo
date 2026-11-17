// Gera as recomendações: junta o que a pessoa ouve (Spotify, Last.fm e/ou lista manual),
// pontua artistas parecidos e monta a curadoria (grupos de gosto e gênero de cada um).
// Não depende do Electron: recebe as fontes e devolve o resultado.
const { coletarSementes, maisFortes, completarGeneros } = require("./sementes");
const { buscarSimilares, pontuar } = require("./similares");
const enriquecer = require("./enriquecer");
const { agrupar } = require("./agrupar");

/**
 * fontes: { lastfm: {apiKey, usuario} | null, spotifyToken: string | null, manual: string[] }
 * periodo: "curto" | "medio" | "longo"; sementes: quantas das mais fortes usar.
 */
async function gerar({ fontes, periodo, sementes, progresso = () => {} }) {
  const chaveLastfm = fontes.lastfm?.apiKey || null;

  const { pesos, usadas, avisos } = await coletarSementes(fontes, periodo, progresso);
  if (!pesos.size) {
    throw new Error(avisos.length
      ? avisos.join(" ")
      : "Nenhum artista encontrado. Conecte o Spotify, configure o Last.fm ou liste artistas em Configurações.");
  }

  const base = maisFortes(pesos, sementes);
  await completarGeneros(base, chaveLastfm, progresso);
  const grupos = agrupar(base);
  const grupoDe = new Map(grupos.flatMap((g) => g.artistas.map((nome) => [nome, g.nome])));

  const { listas, semConexao } = await buscarSimilares(base, chaveLastfm, progresso);
  // Nenhuma busca chegou ao serviço: é falta de internet, não "nada parecido". Para aqui, sem
  // devolver uma lista vazia que apagaria as recomendações anteriores.
  if (semConexao === base.length) {
    throw new Error(`Não foi possível falar com o ${chaveLastfm ? "Last.fm" : "Deezer"} para buscar artistas parecidos. Confira a sua conexão e tente de novo.`);
  }
  const recs = pontuar(base, listas, pesos);
  for (const r of recs) r.grupo = grupoDe.get(r.sementes[0]) || null; // grupo do artista seu que mais puxou

  await enriquecer.comSpotify(recs, fontes.spotifyToken, progresso);
  await enriquecer.generosLastfm(recs, chaveLastfm, progresso);
  await enriquecer.fotosDeezer(recs, progresso);

  if (!recs.length) avisos.push("Nenhum artista parecido foi encontrado para essas sementes.");
  progresso(`Pronto: ${recs.length} recomendações.`);
  return {
    periodo,
    fontes: usadas,
    motor: chaveLastfm ? "Last.fm" : "Deezer",
    sementes: base.map((a) => a.nome),
    grupos: grupos.filter((g) => recs.some((r) => r.grupo === g.nome)),
    avisos,
    recs,
  };
}

module.exports = { gerar, agrupar };
