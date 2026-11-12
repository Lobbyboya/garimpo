// Junta o que a pessoa ouve (Spotify, Last.fm e/ou lista manual), pontua artistas parecidos
// e monta a curadoria: grupos de gosto e o gênero de cada recomendação.
const lastfm = require("./lastfm");
const spotify = require("./spotify");
const deezer = require("./deezer");

// Período escolhido na tela -> parâmetro de cada serviço.
const PERIODOS = {
  curto: { lastfm: "1month", spotify: "short_term" },
  medio: { lastfm: "6month", spotify: "medium_term" },
  longo: { lastfm: "overall", spotify: "long_term" },
};

const MAX_GRUPOS = 5;

const normalizar = (nome) => nome.trim().toLowerCase();
const linkSpotify = (nome) => "https://open.spotify.com/search/" + encodeURIComponent(nome);

// Tags do Last.fm que não são gênero.
const NAO_E_GENERO = /^(seen live|favou?rites?|favou?rite artists?|all|spotify|albums i own|under \d+ listeners|beautiful|awesome|love|cool|\d{2,4}s?|male vocalists?|female vocalists?)$/;

function limparTags(tags) {
  const vistos = new Set();
  return (tags || [])
    .map((t) => normalizar(String(t)).replace(/-/g, " "))
    .filter((t) => t && t.length <= 30 && !NAO_E_GENERO.test(t) && !vistos.has(t) && vistos.add(t));
}

const titulo = (tag) => tag.charAt(0).toUpperCase() + tag.slice(1);

// Executa fn em cada item com no máximo `limite` chamadas ao mesmo tempo.
async function emLotes(itens, limite, fn) {
  const saida = new Array(itens.length);
  let proximo = 0;
  async function trabalhador() {
    while (proximo < itens.length) {
      const i = proximo++;
      saida[i] = await fn(itens[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limite, itens.length) }, trabalhador));
  return saida;
}

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

/**
 * fontes: { lastfm: {apiKey, usuario} | null, spotifyToken: string | null, manual: string[] }
 *
 * Cada artista que a pessoa ouve vira uma "semente" com peso de 0 a 1:
 *  - Last.fm: scrobbles ÷ scrobbles do artista mais ouvido;
 *  - Spotify: posição no ranking (o 1º vale 1, o último perto de 0), pois o Spotify não informa contagens;
 *  - lista manual: 0,8.
 * Os similares das N sementes mais fortes ganham pontos = match × peso da semente, somados.
 * A similaridade vem do Last.fm quando há chave; sem chave, dos "relacionados" do Deezer.
 */
async function gerar({ fontes, periodo, sementes, progresso = () => {} }) {
  const p = PERIODOS[periodo] || PERIODOS.longo;
  const pesos = new Map(); // nome normalizado -> { nome, peso, tags }
  const usadas = [];
  const avisos = [];
  const chaveLastfm = fontes.lastfm?.apiKey || null;

  function somar(lista, origem) {
    if (!lista.length) return;
    usadas.push(origem);
    for (const { nome, peso, tags } of lista) {
      const chave = normalizar(nome);
      const atual = pesos.get(chave);
      const juntas = limparTags([...(atual?.tags || []), ...(tags || [])]);
      if (!atual || peso > atual.peso) pesos.set(chave, { nome, peso, tags: juntas });
      else atual.tags = juntas;
    }
  }

  if (fontes.spotifyToken) {
    progresso("Lendo seus top artistas no Spotify...");
    try {
      const top = await spotify.topArtistas(fontes.spotifyToken, p.spotify);
      somar(top.map((a, i) => ({ nome: a.nome, peso: (top.length - i) / top.length, tags: a.generos })), "Spotify");
    } catch (e) {
      avisos.push("Spotify: " + e.message);
    }
  }

  if (fontes.lastfm) {
    progresso("Lendo seus top artistas no Last.fm...");
    try {
      const top = await lastfm.topArtistas(fontes.lastfm.apiKey, fontes.lastfm.usuario, p.lastfm);
      const maior = top[0]?.scrobbles || 1;
      somar(top.map((a) => ({ nome: a.nome, peso: a.scrobbles / maior })), "Last.fm");
    } catch (e) {
      avisos.push("Last.fm: " + e.message);
    }
  }

  somar((fontes.manual || []).map((nome) => ({ nome, peso: 0.8 })), "sua lista");

  if (!pesos.size) {
    throw new Error(avisos.length
      ? avisos.join(" ")
      : "Nenhum artista encontrado. Conecte o Spotify, configure o Last.fm ou liste artistas em Configurações.");
  }

  const base = [...pesos.values()].sort((a, b) => b.peso - a.peso).slice(0, sementes);

  // Gêneros das sementes que o Spotify não informou: tags do Last.fm, se houver chave.
  const semTags = base.filter((s) => !s.tags.length);
  if (chaveLastfm && semTags.length) {
    progresso("Descobrindo os estilos dos seus artistas...");
    await emLotes(semTags, 4, async (s) => {
      try {
        s.tags = limparTags(await lastfm.tags(chaveLastfm, s.nome));
      } catch {
        // sem tags: a semente cai em "Outros"
      }
    });
  }
  const grupos = agrupar(base);
  const grupoDe = new Map(grupos.flatMap((g) => g.artistas.map((nome) => [nome, g.nome])));

  let feitos = 0;
  const similares = await emLotes(base, chaveLastfm ? 4 : 3, async (semente) => {
    try {
      if (chaveLastfm) return await lastfm.similares(chaveLastfm, semente.nome);
      const artista = await deezer.buscarArtista(semente.nome);
      if (!artista) return [];
      const rel = await deezer.relacionados(artista.id);
      // O Deezer só dá a ordem: o 1º relacionado vale 1 e o último 0,4.
      return rel.map((r, i) => ({ nome: r.nome, match: 1 - 0.6 * (i / rel.length), img: r.foto, deezer: r.link }));
    } catch {
      return []; // um artista sem similares não derruba o resto
    } finally {
      feitos++;
      progresso(`Buscando parecidos (${feitos}/${base.length}): ${semente.nome}`);
    }
  });

  const pontos = new Map();
  base.forEach((semente, i) => {
    for (const s of similares[i]) {
      const chave = normalizar(s.nome);
      if (pesos.has(chave)) continue; // a pessoa já ouve
      const contribuicao = s.match * semente.peso;
      const atual = pontos.get(chave) || { nome: s.nome, pontos: 0, sementes: [], img: null, lastfm: null, deezer: null };
      atual.pontos += contribuicao;
      atual.sementes.push({ nome: semente.nome, peso: contribuicao });
      atual.img = atual.img || s.img || null;
      atual.lastfm = atual.lastfm || s.lastfm || null;
      atual.deezer = atual.deezer || s.deezer || null;
      pontos.set(chave, atual);
    }
  });

  const recs = [...pontos.values()]
    .sort((a, b) => b.pontos - a.pontos)
    .slice(0, 60)
    .map((r) => {
      const ordenadas = r.sementes.sort((a, b) => b.peso - a.peso).map((s) => s.nome);
      return {
        nome: r.nome,
        pontos: Number(r.pontos.toFixed(3)),
        sementes: ordenadas,
        grupo: grupoDe.get(ordenadas[0]) || null, // grupo do artista seu que mais puxou a recomendação
        genero: null,
        img: r.img,
        spotify: linkSpotify(r.nome),
        spotifyDireto: false,
        lastfm: r.lastfm,
        deezer: r.deezer,
      };
    });

  // Com o Spotify conectado: link direto para a página do artista, foto e gênero.
  if (fontes.spotifyToken && recs.length) {
    progresso("Procurando os artistas no Spotify...");
    let parar = false;
    await emLotes(recs, 3, async (r) => {
      if (parar) return;
      try {
        const a = await spotify.buscarArtista(fontes.spotifyToken, r.nome);
        if (!a) return;
        if (a.link) {
          r.spotify = a.link;
          r.spotifyDireto = true;
        }
        r.img = r.img || a.img;
        r.genero = limparTags(a.generos)[0] || null;
      } catch (e) {
        if (e.codigo === 429 || e.codigo === 401 || e.codigo === 403) parar = true; // os demais ficam com o link de busca
      }
    });
  }

  const semGenero = recs.filter((r) => !r.genero);
  if (chaveLastfm && semGenero.length) {
    progresso("Descobrindo o estilo de cada recomendação...");
    await emLotes(semGenero, 4, async (r) => {
      try {
        r.genero = limparTags(await lastfm.tags(chaveLastfm, r.nome))[0] || null;
      } catch {
        // fica sem gênero
      }
    });
  }

  const semFoto = recs.filter((r) => !r.img);
  if (semFoto.length) {
    progresso("Buscando fotos dos artistas...");
    await emLotes(semFoto, 3, async (r) => {
      r.img = (await deezer.buscarArtista(r.nome))?.foto || null;
    });
  }

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
