// Onde ficam os arquivos do Garimpo: %APPDATA%\garimpo no Windows, ~/.config/garimpo no Linux.
const { app } = require("electron");
const path = require("path");

// Pasta fixa, igual no modo de desenvolvimento e no app instalado. Chamado uma vez, no início.
function definirPasta() {
  app.setPath("userData", path.join(app.getPath("appData"), "garimpo"));
}

const caminho = (nome) => path.join(app.getPath("userData"), nome);

module.exports = { definirPasta, caminho };
