// Com a chave do Last.fm que vem no app, a pessoa só informa o usuário.
const { test } = require("node:test");
const assert = require("node:assert/strict");
process.env.GARIMPO_LASTFM_CHAVE = "chave-do-app";
const { instalarFetch, chamadas } = require("./ajuda/fetch-falso");
const config = require("../src/dados/config");
const contas = require("../src/main/contas");

test("só com o usuário: testa com a chave do app e não a copia para a config", async () => {
  config.salvar({});
  assert.equal(config.publico().temChavePadraoLastfm, true);
  instalarFetch(() => ({ corpo: { topartists: { artist: [] } } }));
  const pub = await contas.testarLastfm({ usuario: "renan" });
  assert.equal(chamadas[0].url.searchParams.get("api_key"), "chave-do-app");
  assert.equal(pub.usuario, "renan");
  assert.equal(pub.temChave, true);
  assert.equal(pub.temChavePropria, false);
  assert.equal(config.ler().apiKey, "", "a chave do app não vai para o config.json");
});

test("chave própria tem prioridade sobre a do app", async () => {
  config.salvar({});
  instalarFetch(() => ({ corpo: { topartists: { artist: [] } } }));
  await contas.testarLastfm({ usuario: "renan", apiKey: "minha-chave" });
  assert.equal(chamadas[0].url.searchParams.get("api_key"), "minha-chave");
  assert.equal(config.chaveLastfm(config.ler()), "minha-chave");
});

test("desconectar tira o usuário e a chave própria", () => {
  config.salvar({ apiKey: "minha", usuario: "renan" });
  const pub = contas.removerLastfm();
  assert.equal(pub.usuario, "");
  assert.equal(pub.temChavePropria, false);
});
