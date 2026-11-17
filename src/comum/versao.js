// Números de versão no formato 1.2.3 (aceita "v" na frente e ignora sufixos como -beta).

function lerVersao(v) {
  if (!v || typeof v !== "string") return [0, 0, 0];
  const limpo = v.trim().replace(/^v/i, "").split("-")[0];
  const partes = limpo.split(".").map((n) => parseInt(n, 10) || 0);
  while (partes.length < 3) partes.push(0);
  return partes.slice(0, 3);
}

// 1 se a > b, -1 se a < b, 0 se iguais.
function compararVersoes(a, b) {
  const va = lerVersao(a);
  const vb = lerVersao(b);
  for (let i = 0; i < 3; i++) {
    if (va[i] !== vb[i]) return va[i] > vb[i] ? 1 : -1;
  }
  return 0;
}

// A tag tem cara de versão (v1.2.3)?
const ehVersao = (nome) => /^v?\d+(\.\d+)*$/i.test(String(nome || ""));

module.exports = { lerVersao, compararVersoes, ehVersao };
