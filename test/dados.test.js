const { test, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const electron = require("electron");
const { caminho } = require("../src/dados/arquivos");
const config = require("../src/dados/config");
const salvos = require("../src/dados/salvos");
const segredos = require("../src/dados/segredos");

beforeEach(() => {
  fs.rmSync(electron.app.getPath("userData"), { recursive: true, force: true });
  electron.__cofre.disponivel = true;
});

test("config: atualiza só os campos enviados e nunca mostra chaves para a interface", () => {
  config.salvar({ apiKey: "segredo", usuario: "renan", manual: ["Air"] });
  const pub = config.publico(config.atualizarCampos({ manual: ["Bjork", " bjork ", ""], apiKey: "  " }));
  assert.deepEqual(pub.manual, ["Bjork"]);
  assert.equal(pub.temChave, true, "apiKey vazia mantém a atual");
  assert.ok(!JSON.stringify(pub).includes("segredo"));
});

test("config: trocar o Client ID desconecta o Spotify antigo", () => {
  config.salvar({ spotifyClientId: "a", spotify: { refresh: { txt: "r" } } });
  assert.equal(config.atualizarCampos({ spotifyClientId: "b" }).spotify, null);
});

test("config: arquivo corrompido é recuperado do backup, com as chaves", () => {
  config.salvar({ apiKey: "chave1", usuario: "renan" });
  config.salvar({ apiKey: "chave1", usuario: "renan", manual: ["Air"] });
  fs.writeFileSync(caminho("config.json"), '{"apiKey": "chave1", "usu');
  const lida = config.ler();
  assert.equal(lida.apiKey, "chave1");
  assert.equal(lida.usuario, "renan");
});

test("aparência: valores inválidos voltam para o padrão", () => {
  assert.deepEqual(config.limparAparencia({ modo: "neon", tema: "<script>" }), { modo: "sistema", tema: "garimpo" });
  config.salvar({});
  assert.deepEqual(config.atualizarCampos({ aparencia: { tema: "dracula" } }).aparencia, { modo: "sistema", tema: "dracula" });
});

test("segredos: cofre fechado lança erro próprio (para ninguém apagar o login)", () => {
  const guardado = segredos.guardar("token");
  assert.equal(segredos.ler(guardado), "token");
  electron.__cofre.disponivel = false;
  assert.throws(() => segredos.ler(guardado), (e) => e.cofreIndisponivel === true);
  assert.equal(segredos.ler(null), "");
});

test("salvos: salva, marca como ouvido e remove; links perigosos são descartados", () => {
  let r = salvos.alternar({ nome: " Air ", img: "javascript:alert(1)", spotify: "https://open.spotify.com/artist/1", sementes: ["Radiohead", 5] });
  assert.equal(r.adicionado, true);
  assert.equal(r.lista[0].nome, "Air");
  assert.equal(r.lista[0].img, null);
  assert.deepEqual(r.lista[0].sementes, ["Radiohead"]);
  assert.equal(salvos.marcarOuvido("AIR", true).lista[0].ouvido, true);
  r = salvos.alternar({ nome: "air" });
  assert.equal(r.adicionado, false);
  assert.deepEqual(r.lista, []);
  assert.throws(() => salvos.alternar({}), /sem nome/);
});

test("dispensados: dispensa, lista e restaura (sem diferenciar maiúsculas)", () => {
  const dispensados = require("../src/dados/dispensados");
  assert.equal(dispensados.alternar(" Air ").dispensado, true);
  assert.ok(dispensados.nomes().has("air"));
  const r = dispensados.alternar("AIR");
  assert.equal(r.dispensado, false);
  assert.deepEqual(r.lista, []);
});

test("histórico: primeira vez ninguém é 'novo'; depois, só quem nunca apareceu", () => {
  const historico = require("../src/dados/historico");
  const primeira = [{ nome: "A" }, { nome: "B" }];
  historico.marcarNovos(primeira);
  assert.deepEqual(primeira.map((r) => r.novo), [false, false]);
  const segunda = [{ nome: "b" }, { nome: "C" }];
  historico.marcarNovos(segunda);
  assert.deepEqual(segunda.map((r) => r.novo), [false, true]);
});
