// Canais entre a interface (preload.js) e o processo principal. Aqui só se traduz a chamada:
// a lógica fica nos módulos de cada assunto.
const { app, ipcMain } = require("electron");
const config = require("../dados/config");
const salvos = require("../dados/salvos");
const dispensados = require("../dados/dispensados");
const { textoCurto } = require("../comum/texto");
const contas = require("./contas");
const recomendacoes = require("./recomendacoes");
const previas = require("./previas");
const atualizacoes = require("./atualizacoes");
const telemetria = require("./telemetria");
const { abrirExterno } = require("./links");
const { aplicarModo } = require("./aparencia");

// A interface só pode registrar estes eventos; o módulo de telemetria ainda confere os campos.
const EVENTOS_DA_INTERFACE = new Set(["aba_aberta", "previa_tocada"]);

function registrarCanais() {
  // Configuração e contas
  ipcMain.handle("config:get", () => config.publico());
  ipcMain.handle("config:set", (_e, dados) => {
    const publico = config.publico(config.atualizarCampos(dados));
    aplicarModo(publico.aparencia.modo);
    return publico;
  });
  ipcMain.handle("lastfm:testar", (_e, dados) => contas.testarLastfm(dados));
  ipcMain.handle("lastfm:remover", () => contas.removerLastfm());
  ipcMain.handle("spotify:conectar", () => contas.conectarSpotify());
  ipcMain.handle("spotify:cancelar", () => contas.cancelarLoginSpotify());
  ipcMain.handle("spotify:desconectar", () => contas.desconectarSpotify());

  // Recomendações
  ipcMain.handle("cache:get", () => recomendacoes.lerCache());
  ipcMain.handle("recs:gerar", (e, opcoes) =>
    recomendacoes.gerar(opcoes, (msg) => {
      if (!e.sender.isDestroyed()) e.sender.send("recs:progresso", msg); // a janela pode ter sido fechada
    }));
  ipcMain.handle("faixas:top", (_e, artista) => previas.topFaixas(artista));

  // Salvos
  ipcMain.handle("salvos:listar", () => salvos.listar());
  ipcMain.handle("salvos:alternar", (_e, artista) => {
    const { lista, adicionado } = salvos.alternar(artista);
    telemetria.registrar(adicionado ? "salvo_adicionado" : "salvo_removido", { aba: textoCurto(artista?.aba, 20) });
    return lista;
  });
  ipcMain.handle("salvos:ouvido", (_e, { nome, ouvido } = {}) => {
    const { lista, alterado } = salvos.marcarOuvido(nome, ouvido);
    if (alterado) telemetria.registrar("salvo_ouvido", { ouvido: Boolean(ouvido) });
    return lista;
  });

  // Dispensados ("Não curti")
  ipcMain.handle("dispensados:listar", () => dispensados.listar());
  ipcMain.handle("dispensados:alternar", (_e, { nome, aba } = {}) => {
    const { lista, dispensado } = dispensados.alternar(nome);
    if (dispensado) telemetria.registrar("artista_dispensado", { aba: textoCurto(aba, 20) });
    return lista;
  });

  // Atualizações e links
  ipcMain.handle("updater:checar", () => atualizacoes.checarAtualizacao({ versaoAtual: app.getVersion() }));
  ipcMain.on("abrir-link", (_e, url) => abrirExterno(url));

  // Estatísticas de uso (opcionais)
  ipcMain.handle("telemetria:situacao", () => telemetria.situacao());
  ipcMain.handle("telemetria:escolher", (_e, sim) => {
    const situacao = telemetria.escolher(sim === true);
    if (sim === true) telemetria.registrar("app_aberto");
    return situacao;
  });
  ipcMain.handle("telemetria:apagar", () => telemetria.apagarEnviados());
  ipcMain.on("telemetria:evento", (_e, evento, dados) => {
    if (EVENTOS_DA_INTERFACE.has(evento)) telemetria.registrar(evento, dados);
  });
}

module.exports = { registrarCanais };
