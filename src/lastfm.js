// Gera recomendações a partir dos top artistas do Last.fm e do artist.getSimilar.
const API = "https://ws.audioscrobbler.com/2.0/";

const ERROS = {
  6: "Usuário ou artista não encontrado no Last.fm.",
  10: "Chave de API inválida. Confira nas configurações.",
  26: "Chave de API suspensa pelo Last.fm.",
  29: "Limite de requisições do Last.fm atingido. Espere um pouco e tente de novo.",
};

async function chamar(params, apiKey) {
  const url = new URL(API);
  for (const [k, v] of Object.entries({ ...params, api_key: apiKey, format: "json" })) {
    url.searchParams.set(k, v);
  }
  const resp = await fetch(url, { headers: { "User-Agent": "RecomendadorDeBandas/1.0" } });
  let dados;
  try {
    dados = await resp.json();
  } catch {
    throw new Error(`Resposta inválida do Last.fm (HTTP ${resp.status}).`);
  }
  if (dados.error) throw new Error(ERROS[dados.error] || dados.message || `Erro ${dados.error} do Last.fm.`);
  return dados;
}

function normalizar(nome) {
  return nome.trim().toLowerCase();
}

function linkSpotify(nome) {
  return "https://open.spotify.com/search/" + encodeURIComponent(nome);
}

// A API do Last.fm não devolve mais fotos de artistas (só uma estrela cinza), então a foto
// vem da busca pública do Deezer, que não exige chave. Só aceita nome idêntico, para não
// mostrar a foto de outro artista. Devolve null se não achar.
async function buscarFoto(nome) {
  try {
    const url = "https://api.deezer.com/search/artist?limit=5&q=" + encodeURIComponent(nome);
    const resp = await fetch(url, { signal: AbortSignal.timeout(8000) });
    const dados = await resp.json();
    const achado = (dados.data || []).find((a) => normalizar(a.name) === normalizar(nome));
    const foto = achado?.picture_medium;
    // Artista sem foto no Deezer vem com o caminho ".../artist//250x250..." (imagem padrão).
    if (!foto || foto.includes("/artist//")) return null;
    return foto;
  } catch {
    return null;
  }
}

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
 * Busca os top artistas, pega os similares dos `sementes` primeiros e soma uma pontuação:
 * pontos += match do similar × peso da semente (scrobbles da semente / scrobbles da maior).
 * Artistas que já estão no seu top (até 500) são removidos.
 */
async function gerarRecomendacoes({ apiKey, usuario, periodo, sementes, progresso = () => {} }) {
  progresso("Lendo seus top artistas...");
  const top = await chamar(
    { method: "user.gettopartists", user: usuario, period: periodo, limit: 500 },
    apiKey
  );
  const meus = (top.topartists?.artist || []).map((a) => ({
    nome: a.name,
    scrobbles: Number(a.playcount) || 0,
  }));
  if (!meus.length) throw new Error("Nenhum artista encontrado nesse período.");

  const conhecidos = new Set(meus.map((a) => normalizar(a.nome)));
  const base = meus.slice(0, sementes);
  const maior = base[0].scrobbles || 1;

  let feitos = 0;
  const similares = await emLotes(base, 4, async (semente) => {
    try {
      const r = await chamar(
        { method: "artist.getsimilar", artist: semente.nome, limit: 30, autocorrect: 1 },
        apiKey
      );
      return r.similarartists?.artist || [];
    } catch {
      return []; // um artista sem similares não derruba o resto
    } finally {
      feitos++;
      progresso(`Buscando similares (${feitos}/${base.length}): ${semente.nome}`);
    }
  });

  const pontos = new Map();
  base.forEach((semente, i) => {
    const peso = semente.scrobbles / maior;
    for (const s of similares[i]) {
      const chave = normalizar(s.name);
      if (conhecidos.has(chave)) continue;
      const contribuicao = (Number(s.match) || 0) * peso;
      const atual = pontos.get(chave) || { nome: s.name, url: s.url, pontos: 0, sementes: [] };
      atual.pontos += contribuicao;
      atual.sementes.push({ nome: semente.nome, peso: contribuicao });
      pontos.set(chave, atual);
    }
  });

  const recs = [...pontos.values()]
    .sort((a, b) => b.pontos - a.pontos)
    .slice(0, 60)
    .map((r) => ({
      nome: r.nome,
      pontos: Number(r.pontos.toFixed(3)),
      sementes: r.sementes.sort((a, b) => b.peso - a.peso).map((s) => s.nome),
      lastfm: r.url,
      spotify: linkSpotify(r.nome),
    }));

  progresso("Buscando fotos dos artistas...");
  await emLotes(recs, 6, async (r) => {
    r.img = await buscarFoto(r.nome);
  });

  progresso(`Pronto: ${recs.length} recomendações.`);
  return {
    periodo,
    sementes: base.map((a) => a.nome),
    totalTop: meus.length,
    recs,
  };
}

module.exports = { gerarRecomendacoes };
