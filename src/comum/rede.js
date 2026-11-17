// fetch com tempo limite e mensagem de erro em português, para uma resposta que nunca
// chega não travar o app.

async function buscar(url, { servico = "servidor", tempo = 15000, ...opcoes } = {}) {
  try {
    return await fetch(url, { ...opcoes, signal: AbortSignal.timeout(tempo) });
  } catch (e) {
    const esgotado = e?.name === "TimeoutError";
    const erro = new Error(esgotado
      ? `O ${servico} demorou demais para responder. Tente de novo.`
      : `Não foi possível falar com o ${servico}. Confira a sua conexão.`);
    erro.tempoEsgotado = esgotado;
    erro.semConexao = true; // não chegou resposta (diferente de "o serviço respondeu com erro")
    throw erro;
  }
}

module.exports = { buscar };
