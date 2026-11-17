// Descobre se há uma versão nova do Garimpo no GitHub e qual instalador oferecer.
const github = require("../servicos/github");
const { compararVersoes, ehVersao } = require("../comum/versao");

// Extensões de instalador por sistema, na ordem de preferência.
const EXTENSOES = {
  win32: [".exe", ".msi", ".zip"],
  linux: [".appimage", ".pacman", ".deb", ".rpm", ".tar.gz"],
  darwin: [".dmg", ".zip"],
};

// Escolhe o instalador do sistema atual; null se o release não tem um (aí abre a página do release).
function escolherInstalador(assets, plataforma = process.platform) {
  for (const ext of EXTENSOES[plataforma] || []) {
    const achado = assets.find((a) => (a.name || "").toLowerCase().endsWith(ext));
    if (achado) return achado;
  }
  return null;
}

const semNovidade = (versao) => ({ temNova: false, versaoAtual: versao, mensagem: "Você está usando a versão mais recente." });

// Sem release publicado: a maior tag com cara de versão (a API não ordena por versão).
async function pelaTag(versao, repo) {
  try {
    const nomes = (await github.tags(versao, repo))
      .map((t) => t?.name || "")
      .filter(ehVersao)
      .sort((a, b) => compararVersoes(b, a));
    const maisNova = nomes[0];
    if (maisNova && compararVersoes(maisNova, versao) > 0) {
      return {
        temNova: true,
        versaoAtual: versao,
        novaVersao: maisNova.replace(/^v/i, ""),
        titulo: `Garimpo ${maisNova}`,
        notas: "Nova versão disponível no repositório.",
        url: `https://github.com/${repo}/releases/tag/${maisNova}`,
        downloadUrl: null,
      };
    }
  } catch {
    // sem tags: considera que não há novidade
  }
  return semNovidade(versao);
}

// API fora do ar ou no limite de uso: tenta o package.json da main antes de desistir.
async function pelaMain(versao, repo, erroOriginal) {
  try {
    const pkg = await github.packageJsonDaMain(versao, repo);
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
    // também falhou: vale o erro original
  }
  if (erroOriginal.semConexao) throw new Error(erroOriginal.message); // já diz "confira a sua conexão"
  throw new Error(`Não foi possível consultar atualizações no GitHub (${erroOriginal.message}).`);
}

function peloRelease(release, versao, repo) {
  const versaoRemota = (release.tag_name || release.name || "").replace(/^v/i, "");
  if (compararVersoes(versaoRemota, versao) <= 0) return semNovidade(versao);
  const instalador = escolherInstalador(Array.isArray(release.assets) ? release.assets : []);
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

async function checarAtualizacao({ versaoAtual, repo = github.REPO } = {}) {
  const versao = versaoAtual || "1.0.0";
  let release;
  try {
    release = await github.ultimoRelease(versao, repo);
  } catch (e) {
    // 404 = nenhum release publicado ainda; outros erros = rede ou limite de uso
    return e.status === 404 ? pelaTag(versao, repo) : pelaMain(versao, repo, e);
  }
  return release ? peloRelease(release, versao, repo) : pelaTag(versao, repo);
}

// Checa em segundo plano, pouco depois de abrir, e avisa a janela se houver versão nova.
function checarEmSegundoPlano(janela, versaoAtual) {
  setTimeout(async () => {
    try {
      const info = await checarAtualizacao({ versaoAtual });
      if (info?.temNova && !janela.isDestroyed()) janela.webContents.send("updater:nova-versao", info);
    } catch {
      // sem internet: tenta na próxima abertura
    }
  }, 4000);
}

module.exports = { checarAtualizacao, checarEmSegundoPlano, escolherInstalador };
