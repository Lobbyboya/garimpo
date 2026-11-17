// Modo claro/escuro escolhido pela pessoa. O Electron repassa para a interface pelo
// prefers-color-scheme, então o CSS, as barras de rolagem e os menus nativos seguem junto.
const { nativeTheme } = require("electron");

const FONTE = { sistema: "system", claro: "light", escuro: "dark" };

function aplicarModo(modo) {
  nativeTheme.themeSource = FONTE[modo] || "system";
}

// Cor de fundo da janela antes de a interface carregar (a do tema Garimpo, no modo atual).
const fundoInicial = () => (nativeTheme.shouldUseDarkColors ? "#262624" : "#faf9f5");

module.exports = { aplicarModo, fundoInicial };
