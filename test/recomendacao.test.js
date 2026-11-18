const { test } = require("node:test");
const assert = require("node:assert/strict");
const { instalarFetch, apisMusicais } = require("./ajuda/fetch-falso");
const { gerar, agrupar } = require("../src/recomendacao");

test("gerar (Deezer): pontua parecidos e não recomenda quem a pessoa já ouve", async () => {
  instalarFetch(apisMusicais);
  const r = await gerar({ fontes: { manual: ["Radiohead", "Bjork", "Air"] }, periodo: "longo", sementes: 20 });
  assert.equal(r.motor, "Deezer");
  assert.deepEqual(r.fontes, ["sua lista"]);
  assert.ok(r.recs.length > 0);
  const nomes = r.recs.map((x) => x.nome.toLowerCase());
  for (const seu of ["radiohead", "bjork", "air"]) assert.ok(!nomes.includes(seu));
  const pontos = r.recs.map((x) => x.pontos);
  assert.deepEqual(pontos, [...pontos].sort((a, b) => b - a), "do mais ao menos parecido");
  assert.ok(r.recs.every((x) => x.img?.startsWith("https://")));
});

test("gerar (Last.fm): usa scrobbles como peso, exclui quem a pessoa já ouve e monta grupos", async () => {
  instalarFetch(apisMusicais);
  const r = await gerar({ fontes: { lastfm: { apiKey: "k", usuario: "u" }, manual: [] }, periodo: "medio", sementes: 10 });
  assert.equal(r.motor, "Last.fm");
  assert.ok(!r.recs.some((x) => x.nome === "A2"), "A2 é ouvido pela pessoa");
  // SA1: 0,9 × peso 1 = 0,9; Comum: 0,5 × (1 + 0,5 + 0,1) = 0,8
  assert.deepEqual(r.recs.slice(0, 2).map((x) => x.nome), ["SA1", "Comum"]);
  assert.deepEqual(r.recs[1].sementes, ["A1", "A2", "A3"], "Comum lista as três sementes, da que mais puxou à que menos");
  assert.ok(r.grupos.length >= 1);
});

test("gerar: sem nenhuma fonte, explica o que fazer", async () => {
  await assert.rejects(gerar({ fontes: {}, periodo: "longo", sementes: 5 }), /Nenhum artista encontrado/);
});

test("gerar: sem internet, falha com aviso em vez de devolver lista vazia", async () => {
  instalarFetch(() => "sem-conexao");
  await assert.rejects(gerar({ fontes: { manual: ["Radiohead"] }, periodo: "longo", sementes: 5 }), /Confira a sua conexão/);
});

test("agrupar: junta por gênero mais forte e manda o resto para Outros", () => {
  const grupos = agrupar([
    { nome: "a", peso: 1, tags: ["rock", "indie"] },
    { nome: "b", peso: 0.6, tags: ["indie"] },
    { nome: "c", peso: 0.4, tags: ["jazz"] },
    { nome: "d", peso: 0.2, tags: [] },
  ]);
  assert.deepEqual(grupos.map((g) => g.nome), ["Indie", "Outros"]);
  assert.deepEqual(grupos[1].artistas, ["c", "d"]);
});
