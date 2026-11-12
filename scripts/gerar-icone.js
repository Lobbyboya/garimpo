// Gera build/icon.png (512px) e build/icon.ico (16 a 256px) a partir de build/icon.svg.
// Uso: npm run icone   (roda dentro do Electron para desenhar o SVG num canvas)
const { app, BrowserWindow } = require("electron");
const fs = require("fs");
const path = require("path");

const pasta = path.join(__dirname, "..", "build");
const svg = fs.readFileSync(path.join(pasta, "icon.svg"), "utf8");
const TAMANHOS_ICO = [16, 24, 32, 48, 64, 128, 256];

app.disableHardwareAcceleration();

async function renderizar(win, tamanho) {
  const dataUrl = await win.webContents.executeJavaScript(`
    new Promise((ok, erro) => {
      const img = new Image();
      img.onload = () => {
        const c = document.createElement("canvas");
        c.width = c.height = ${tamanho};
        const ctx = c.getContext("2d");
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(img, 0, 0, ${tamanho}, ${tamanho});
        ok(c.toDataURL("image/png"));
      };
      img.onerror = () => erro(new Error("falha ao carregar o SVG"));
      img.src = "data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}";
    })`);
  return Buffer.from(dataUrl.split(",")[1], "base64");
}

// Monta um .ico com imagens PNG dentro (formato aceito pelo Windows Vista em diante).
function montarIco(pngs) {
  const cabecalho = Buffer.alloc(6);
  cabecalho.writeUInt16LE(0, 0);
  cabecalho.writeUInt16LE(1, 2);
  cabecalho.writeUInt16LE(pngs.length, 4);
  const entradas = [];
  let deslocamento = 6 + 16 * pngs.length;
  for (const { tamanho, dados } of pngs) {
    const e = Buffer.alloc(16);
    e.writeUInt8(tamanho >= 256 ? 0 : tamanho, 0);
    e.writeUInt8(tamanho >= 256 ? 0 : tamanho, 1);
    e.writeUInt8(0, 2);
    e.writeUInt8(0, 3);
    e.writeUInt16LE(1, 4);
    e.writeUInt16LE(32, 6);
    e.writeUInt32LE(dados.length, 8);
    e.writeUInt32LE(deslocamento, 12);
    deslocamento += dados.length;
    entradas.push(e);
  }
  return Buffer.concat([cabecalho, ...entradas, ...pngs.map((p) => p.dados)]);
}

app.whenReady().then(async () => {
  try {
    const win = new BrowserWindow({ show: false });
    await win.loadURL("about:blank");
    fs.writeFileSync(path.join(pasta, "icon.png"), await renderizar(win, 512));
    const pngs = [];
    for (const tamanho of TAMANHOS_ICO) pngs.push({ tamanho, dados: await renderizar(win, tamanho) });
    fs.writeFileSync(path.join(pasta, "icon.ico"), montarIco(pngs));
    console.log("Ícones gerados em build/");
  } catch (e) {
    console.error(e);
    process.exitCode = 1;
  }
  app.quit();
});
