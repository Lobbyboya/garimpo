const { test } = require("node:test");
const assert = require("node:assert/strict");
const { instalarFetch } = require("./ajuda/fetch-falso");
const { checarAtualizacao, escolherInstalador } = require("../src/main/atualizacoes");

const assets = [{ name: "Garimpo-Setup-1.4.0.exe", browser_download_url: "https://x/exe" }, { name: "Garimpo-1.4.0.AppImage", browser_download_url: "https://x/appimage" }];

test("instalador certo para cada sistema", () => {
  assert.equal(escolherInstalador(assets, "linux").name, "Garimpo-1.4.0.AppImage");
  assert.equal(escolherInstalador(assets, "win32").name, "Garimpo-Setup-1.4.0.exe");
  assert.equal(escolherInstalador([{ name: "a.exe" }], "linux"), null);
});

test("release mais nova: oferece o download", async () => {
  instalarFetch(() => ({ corpo: { tag_name: "v1.4.0", html_url: "https://github.com/x", assets } }));
  const info = await checarAtualizacao({ versaoAtual: "1.3.0" });
  assert.equal(info.temNova, true);
  assert.equal(info.novaVersao, "1.4.0");
  assert.ok(info.downloadUrl);
});

test("mesma versão: nada novo", async () => {
  instalarFetch(() => ({ corpo: { tag_name: "v1.3.0", assets } }));
  assert.equal((await checarAtualizacao({ versaoAtual: "1.3.0" })).temNova, false);
});

test("sem release: maior tag por número de versão", async () => {
  instalarFetch((u) => (u.pathname.endsWith("/latest") ? { status: 404 } : { corpo: [{ name: "v1.9.0" }, { name: "v1.10.0" }, { name: "nightly" }] }));
  assert.equal((await checarAtualizacao({ versaoAtual: "1.0.0" })).novaVersao, "1.10.0");
});

test("sem internet: mensagem simples", async () => {
  instalarFetch(() => "sem-conexao");
  await assert.rejects(checarAtualizacao({ versaoAtual: "1.0.0" }), /^Error: Não foi possível falar com o GitHub/);
});
