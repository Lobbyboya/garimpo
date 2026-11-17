// Consultas públicas ao GitHub do Garimpo: último release, tags e o package.json da main.
const { buscar } = require("../comum/rede");

const REPO = "Lobbyboya/garimpo";

async function obterJson(url, versaoApp) {
  const resp = await buscar(url, {
    servico: "GitHub",
    tempo: 10000,
    headers: { "User-Agent": `Garimpo/${versaoApp || "1.0.0"}`, Accept: "application/vnd.github.v3+json" },
  });
  if (!resp.ok) {
    const erro = new Error(`HTTP ${resp.status}`);
    erro.status = resp.status;
    throw erro;
  }
  return resp.json();
}

const ultimoRelease = (versaoApp, repo = REPO) => obterJson(`https://api.github.com/repos/${repo}/releases/latest`, versaoApp);
const tags = (versaoApp, repo = REPO) => obterJson(`https://api.github.com/repos/${repo}/tags`, versaoApp);
const packageJsonDaMain = (versaoApp, repo = REPO) => obterJson(`https://raw.githubusercontent.com/${repo}/main/package.json`, versaoApp);

module.exports = { REPO, ultimoRelease, tags, packageJsonDaMain };
