// Leitura e gravação de arquivos JSON locais, sem risco de perder o arquivo.
const fs = require("fs");
const path = require("path");

// Devolve `padrao` se o arquivo não existe ou está corrompido.
function lerJson(caminho, padrao) {
  try {
    return JSON.parse(fs.readFileSync(caminho, "utf8"));
  } catch {
    return padrao;
  }
}

/**
 * Lê um arquivo importante (como a config). Se ele existe mas está corrompido, tenta a cópia de
 * segurança (.bak) e guarda o corrompido como .corrompido-<data>, para nada se perder.
 * Devolve { dados, origem }: origem = "arquivo", "backup" ou "novo".
 */
function lerJsonProtegido(caminho, padrao) {
  if (!fs.existsSync(caminho)) {
    const bak = lerJson(caminho + ".bak", undefined);
    return bak === undefined ? { dados: padrao, origem: "novo" } : { dados: bak, origem: "backup" };
  }
  try {
    return { dados: JSON.parse(fs.readFileSync(caminho, "utf8")), origem: "arquivo" };
  } catch {
    try {
      fs.renameSync(caminho, `${caminho}.corrompido-${Date.now()}`);
    } catch {
      // sem permissão para renomear: o backup ainda resolve
    }
    const bak = lerJson(caminho + ".bak", undefined);
    return bak === undefined ? { dados: padrao, origem: "novo" } : { dados: bak, origem: "backup" };
  }
}

/**
 * Grava de forma atômica: escreve num arquivo temporário e troca de uma vez. Se o app fechar
 * no meio, fica o arquivo antigo inteiro, nunca um pela metade.
 * Com `backup`, a versão anterior (se estiver íntegra) vira <arquivo>.bak antes da troca.
 */
function salvarJson(caminho, dados, { compacto = false, backup = false } = {}) {
  fs.mkdirSync(path.dirname(caminho), { recursive: true });
  const texto = compacto ? JSON.stringify(dados) : JSON.stringify(dados, null, 2);
  const temporario = `${caminho}.tmp-${process.pid}`;
  const fd = fs.openSync(temporario, "w", 0o600); // só o próprio usuário lê: há chaves aqui
  try {
    fs.writeFileSync(fd, texto);
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
  if (backup && lerJson(caminho, undefined) !== undefined) fs.copyFileSync(caminho, caminho + ".bak");
  fs.renameSync(temporario, caminho);
}

module.exports = { lerJson, lerJsonProtegido, salvarJson };
