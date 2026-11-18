const { test } = require("node:test");
const assert = require("node:assert/strict");
const { instalarFetch } = require("./ajuda/fetch-falso");
const deezer = require("../src/servicos/deezer");
const lastfm = require("../src/servicos/lastfm");

test("deezer: entre homônimos escolhe o de mais fãs, e não aceita nome que só contém o buscado", async () => {
  instalarFetch((u) => ({
    corpo: {
      data: [
        { id: 1, name: "Air & Tur", nb_fan: 40 },
        { id: 2, name: "Air", nb_fan: 31 },
        { id: 3, name: "Air", nb_fan: 344162 },
        { id: 4, name: "Air Supply", nb_fan: 900000 },
      ].filter((a) => a.name.toLowerCase().includes(u.searchParams.get("q").toLowerCase().split(" ")[0])),
    },
  }));
  assert.equal((await deezer.buscarArtista("Air")).id, 3);
  assert.equal(await deezer.buscarArtista("Ai"), null);
});

test("deezer: ignora acento e um 'The' no começo", async () => {
  instalarFetch(() => ({ corpo: { data: [{ id: 7, name: "The Smiths", nb_fan: 10 }, { id: 8, name: "Sigur Rós", nb_fan: 10 }] } }));
  assert.equal((await deezer.buscarArtista("Smiths")).id, 7);
  assert.equal((await deezer.buscarArtista("sigur ros")).id, 8);
});

test("deezer: sem conexão o erro sobe (não vira 'artista não encontrado')", async () => {
  instalarFetch(() => "sem-conexao");
  await assert.rejects(deezer.buscarArtista("Air"), { semConexao: true });
});

test("last.fm: erros da API viram mensagens em português", async () => {
  instalarFetch(() => ({ corpo: { error: 10, message: "Invalid API key" } }));
  await assert.rejects(lastfm.topArtistas("chave", "renan", "overall"), /Chave de API do Last.fm inválida/);
});
