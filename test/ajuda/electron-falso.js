// Carregado antes dos testes (node --require): faz require("electron") devolver um Electron
// falso, para testar os módulos do processo principal sem abrir o app.
const Module = require("module");
const fs = require("fs");
const os = require("os");
const path = require("path");

const pastaDados = fs.mkdtempSync(path.join(os.tmpdir(), "garimpo-teste-"));
const caminhos = { appData: pastaDados, userData: path.join(pastaDados, "garimpo") };

// Cofre de senhas falso. `cofre.disponivel = false` simula o chaveiro do sistema bloqueado.
const cofre = { disponivel: true };

const electron = {
  app: {
    getPath: (nome) => caminhos[nome],
    setPath: (nome, valor) => (caminhos[nome] = valor),
    getVersion: () => require("../../package.json").version,
    isPackaged: false,
  },
  safeStorage: {
    isEncryptionAvailable: () => cofre.disponivel,
    encryptString: (texto) => Buffer.from("cifrado:" + texto),
    decryptString: (buf) => {
      if (!cofre.disponivel) throw new Error("Decryption is not available.");
      return buf.toString().replace(/^cifrado:/, "");
    },
  },
  shell: { abertos: [], openExternal(url) { this.abertos.push(url); } },
  nativeTheme: { themeSource: "system", shouldUseDarkColors: false },
  ipcMain: { handle() {}, on() {} },
  __cofre: cofre,
  __pastaDados: pastaDados,
};

const resolverOriginal = Module._resolveFilename;
Module._resolveFilename = function (pedido, ...resto) {
  if (pedido === "electron") return "electron-falso";
  return resolverOriginal.call(this, pedido, ...resto);
};
require.cache["electron-falso"] = { id: "electron-falso", filename: "electron-falso", loaded: true, exports: electron };

process.on("exit", () => fs.rmSync(pastaDados, { recursive: true, force: true }));
