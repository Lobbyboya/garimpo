// Verificador de atualizações no GitHub Releases / Repositório para o Garimpo.
const REPO = "Lobbyboya/garimpo";
const TIMEOUT_MS = 10000;

function parseVersao(v) {
  if (!v || typeof v !== "string") return [0, 0, 0];
  const limpo = v.trim().replace(/^v/i, "").split("-")[0];
  const partes = limpo.split(".").map((n) => parseInt(n, 10) || 0);
  while (partes.length < 3) partes.push(0);
  return partes.slice(0, 3);
}

function compararVersoes(v1, v2) {
  const [maj1, min1, pat1] = parseVersao(v1);
  const [maj2, min2, pat2] = parseVersao(v2);

  if (maj1 !== maj2) return maj1 > maj2 ? 1 : -1;
  if (min1 !== min2) return min1 > min2 ? 1 : -1;
  if (pat1 !== pat2) return pat1 > pat2 ? 1 : -1;
  return 0;
}

async function fetchJson(url, versaoAtual) {
  const resp = await fetch(url, {
    headers: {
      "User-Agent": `Garimpo/${versaoAtual || "1.0.0"}`,
      Accept: "application/vnd.github.v3+json",
    },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!resp.ok) {
    const erro = new Error(`HTTP ${resp.status}`);
    erro.status = resp.status;
    throw erro;
  }
  return resp.json();
}

async function checarAtualizacao({ versaoAtual, repo = REPO } = {}) {
  const versao = versaoAtual || "1.0.0";
  let release = null;

  // 1. Tenta obter o último release oficial do GitHub
  try {
    release = await fetchJson(`https://api.github.com/repos/${repo}/releases/latest`, versao);
  } catch (e) {
    // 404 = nenhum release publicado ainda; outros erros = rede / rate-limit
    if (e.status !== 404) {
      // Tenta consultar diretamente o package.json na branch main como fallback
      try {
        const pkg = await fetchJson(`https://raw.githubusercontent.com/${repo}/main/package.json`, versao);
        if (pkg?.version && compararVersoes(pkg.version, versao) > 0) {
          return {
            temNova: true,
            versaoAtual: versao,
            novaVersao: pkg.version,
            titulo: `Garimpo v${pkg.version}`,
            notas: "Nova versão detectada no repositório.",
            url: `https://github.com/${repo}`,
            downloadUrl: null,
          };
        }
      } catch {
        // Falha no fallback, segue para o erro original
      }
      throw new Error(
        e.name === "TimeoutError" || e.name === "AbortError"
          ? "Tempo limite esgotado ao buscar atualizações."
          : `Não foi possível consultar atualizações no GitHub (${e.message}).`
      );
    }
  }

  // 2. Se não encontrou release oficial (404), tenta tags mais recentes
  if (!release) {
    try {
      const tags = await fetchJson(`https://api.github.com/repos/${repo}/tags`, versao);
      if (Array.isArray(tags) && tags.length > 0) {
        const tagMaisNova = tags[0].name;
        if (compararVersoes(tagMaisNova, versao) > 0) {
          return {
            temNova: true,
            versaoAtual: versao,
            novaVersao: tagMaisNova.replace(/^v/i, ""),
            titulo: `Garimpo ${tagMaisNova}`,
            notas: "Nova versão disponível no repositório.",
            url: `https://github.com/${repo}/releases/tag/${tagMaisNova}`,
            downloadUrl: null,
          };
        }
      }
    } catch {
      // Ignora erro nas tags
    }

    return {
      temNova: false,
      versaoAtual: versao,
      mensagem: "Você está usando a versão mais recente.",
    };
  }

  // 3. Avalia o release retornado
  const tagRelease = release.tag_name || release.name || "";
  const versaoRemota = tagRelease.replace(/^v/i, "");

  if (compararVersoes(versaoRemota, versao) > 0) {
    const assets = Array.isArray(release.assets) ? release.assets : [];
    const instalador = assets.find((a) => {
      const nome = (a.name || "").toLowerCase();
      return (
        nome.endsWith(".exe") ||
        nome.endsWith(".appimage") ||
        nome.endsWith(".deb") ||
        nome.endsWith(".rpm") ||
        nome.endsWith(".zip")
      );
    });

    return {
      temNova: true,
      versaoAtual: versao,
      novaVersao: versaoRemota,
      titulo: release.name || `Garimpo v${versaoRemota}`,
      notas: release.body || "",
      url: release.html_url || `https://github.com/${repo}/releases/latest`,
      publicadoEm: release.published_at || null,
      downloadUrl: instalador ? instalador.browser_download_url : null,
      instaladorNome: instalador ? instalador.name : null,
    };
  }

  return {
    temNova: false,
    versaoAtual: versao,
    mensagem: "Você está usando a versão mais recente.",
  };
}

module.exports = { checarAtualizacao, compararVersoes };
