const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
process.env.GARIMPO_SUPABASE_URL = "https://exemplo.supabase.co";
process.env.GARIMPO_SUPABASE_CHAVE = "sb_publishable_teste";
const { instalarFetch, chamadas } = require("./ajuda/fetch-falso");
const telemetria = require("../src/main/telemetria");

test("estatísticas: nada sai sem o sim; com o sim, só campos permitidos", async () => {
  const arquivo = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "garimpo-tel-")), "telemetria.json");
  instalarFetch(() => ({ status: 201 }));
  telemetria.iniciar({ caminho: arquivo, versaoApp: "1.3.0" });
  telemetria.registrar("app_aberto");
  await telemetria.enviar();
  assert.equal(chamadas.length, 0, "sem opt-in, nada é enviado");

  telemetria.escolher(true);
  telemetria.registrar("garimpo", { fontes: ["spotify"], recomendacoes: 40, usuario: "renan", artista: "Radiohead" });
  telemetria.registrar("evento_inventado", { x: 1 });
  await telemetria.enviar();
  const enviados = JSON.parse(chamadas[0].opcoes.body);
  assert.deepEqual(enviados.map((e) => e.evento), ["garimpo"]);
  assert.deepEqual(enviados[0].dados, { fontes: ["spotify"], recomendacoes: 40 });

  telemetria.escolher(false);
  telemetria.registrar("app_aberto");
  await telemetria.enviar();
  assert.equal(chamadas.length, 1, "desligado, nada mais sai");
});
