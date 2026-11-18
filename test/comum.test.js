const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { normalizar, semAcento, textoCurto, linkHttps } = require("../src/comum/texto");
const { compararVersoes, ehVersao } = require("../src/comum/versao");
const { emLotes } = require("../src/comum/lotes");
const { lerJson, lerJsonProtegido, salvarJson } = require("../src/comum/json");
const { buscar } = require("../src/comum/rede");
const { instalarFetch } = require("./ajuda/fetch-falso");

test("texto: normaliza nomes e aceita só links https", () => {
  assert.equal(normalizar("  Radiohead "), "radiohead");
  assert.equal(semAcento("Sigur Rós"), "sigur ros");
  assert.equal(textoCurto(42), "");
  assert.equal(textoCurto("  abcdef ", 3), "abc");
  assert.equal(linkHttps("https://open.spotify.com/x"), "https://open.spotify.com/x");
  assert.equal(linkHttps("javascript:alert(1)"), null);
  assert.equal(linkHttps("http://inseguro.com"), null);
});

test("versão: compara por número, não por texto", () => {
  assert.equal(compararVersoes("1.10.0", "1.9.0"), 1);
  assert.equal(compararVersoes("v1.2", "1.2.0"), 0);
  assert.equal(compararVersoes("2", "10"), -1);
  assert.ok(ehVersao("v1.3.0"));
  assert.ok(!ehVersao("nightly"));
});

test("lotes: mantém a ordem e respeita o limite de chamadas simultâneas", async () => {
  let simultaneas = 0;
  let pico = 0;
  const saida = await emLotes([5, 1, 3, 2], 2, async (n) => {
    pico = Math.max(pico, ++simultaneas);
    await new Promise((ok) => setTimeout(ok, n));
    simultaneas--;
    return n * 10;
  });
  assert.deepEqual(saida, [50, 10, 30, 20]);
  assert.equal(pico, 2);
});

test("json: grava sem deixar arquivo pela metade e recupera do backup se corromper", () => {
  const pasta = fs.mkdtempSync(path.join(os.tmpdir(), "garimpo-json-"));
  const arq = path.join(pasta, "config.json");
  salvarJson(arq, { versao: 1 }, { backup: true });
  salvarJson(arq, { versao: 2 }, { backup: true });
  assert.deepEqual(lerJson(arq), { versao: 2 });
  assert.deepEqual(lerJson(arq + ".bak"), { versao: 1 });
  assert.equal(fs.statSync(arq).mode & 0o777, 0o600, "só o próprio usuário lê");
  assert.deepEqual(fs.readdirSync(pasta).filter((f) => f.includes(".tmp-")), [], "não sobra temporário");

  fs.writeFileSync(arq, '{"versao": 3, "cor'); // gravação interrompida
  const lido = lerJsonProtegido(arq, {});
  assert.equal(lido.origem, "backup");
  assert.deepEqual(lido.dados, { versao: 1 });
  assert.ok(fs.readdirSync(pasta).some((f) => f.startsWith("config.json.corrompido-")), "o corrompido é guardado, não apagado");
  fs.rmSync(pasta, { recursive: true });
});

test("rede: sem conexão vira mensagem clara e marcada como semConexao", async () => {
  instalarFetch(() => "sem-conexao");
  await assert.rejects(buscar("https://api.deezer.com/x", { servico: "Deezer" }), (e) => {
    assert.match(e.message, /Não foi possível falar com o Deezer/);
    assert.equal(e.semConexao, true);
    return true;
  });
});
