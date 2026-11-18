const { test, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const electron = require("electron");
const { instalarFetch, chamadas } = require("./ajuda/fetch-falso");
const config = require("../src/dados/config");
const segredos = require("../src/dados/segredos");
const contas = require("../src/main/contas");

function comLogin({ expira = 0 } = {}) {
  config.salvar({
    spotifyClientId: "cid",
    spotify: { refresh: segredos.guardar("refresh-1"), access: segredos.guardar("acesso-velho"), expira, nome: "Renan" },
  });
}

beforeEach(() => {
  fs.rmSync(electron.app.getPath("userData"), { recursive: true, force: true });
  electron.__cofre.disponivel = true;
});

test("token ainda válido: usa o guardado, sem chamar o Spotify", async () => {
  comLogin({ expira: Date.now() + 3600_000 });
  instalarFetch(() => assert.fail("não deveria chamar a rede"));
  assert.equal(await contas.tokenSpotify(), "acesso-velho");
});

test("token vencido: renova e guarda os tokens novos cifrados", async () => {
  comLogin();
  instalarFetch(() => ({ corpo: { access_token: "acesso-novo", refresh_token: "refresh-2", expires_in: 3600 } }));
  assert.equal(await contas.tokenSpotify(), "acesso-novo");
  const sp = config.ler().spotify;
  assert.equal(segredos.ler(sp.refresh), "refresh-2");
  assert.ok(!JSON.stringify(sp).includes("acesso-novo"), "nada em texto puro");
});

test("cofre fechado: avisa e MANTÉM o login guardado", async () => {
  comLogin();
  electron.__cofre.disponivel = false;
  instalarFetch(() => assert.fail("não deveria chamar a rede"));
  await assert.rejects(contas.tokenSpotify(), /continua salvo/);
  assert.ok(config.ler().spotify, "o login não foi apagado");
});

test("acesso revogado (invalid_grant): desconecta", async () => {
  comLogin();
  instalarFetch(() => ({ status: 400, corpo: { error: "invalid_grant" } }));
  await assert.rejects(contas.tokenSpotify());
  assert.equal(config.ler().spotify, null);
});

test("outro processo renovou antes: relê a config e tenta com o token novo", async () => {
  comLogin();
  let vez = 0;
  instalarFetch((u, opcoes) => {
    vez++;
    if (vez === 1) {
      // enquanto isso, outro processo trocou o refresh token
      config.alterar((c) => (c.spotify.refresh = segredos.guardar("refresh-do-outro")));
      return { status: 400, corpo: { error: "invalid_grant" } };
    }
    assert.match(String(opcoes.body), /refresh-do-outro/);
    return { corpo: { access_token: "acesso-ok", expires_in: 3600 } };
  });
  assert.equal(await contas.tokenSpotify(), "acesso-ok");
  assert.ok(config.ler().spotify, "continua conectado");
  assert.equal(chamadas.length, 2);
});
