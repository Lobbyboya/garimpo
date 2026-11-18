const { test } = require("node:test");
const assert = require("node:assert/strict");
const electron = require("electron");
const autoatualizacao = require("../src/main/autoatualizacao");

test("atualização automática só no app instalado (Windows ou AppImage)", () => {
  const plataforma = Object.getOwnPropertyDescriptor(process, "platform");
  const appimage = process.env.APPIMAGE;
  try {
    electron.app.isPackaged = false;
    assert.equal(autoatualizacao.suportada(), false, "rodando pelo código");
    electron.app.isPackaged = true;
    Object.defineProperty(process, "platform", { value: "linux" });
    delete process.env.APPIMAGE;
    assert.equal(autoatualizacao.suportada(), false, "Linux sem AppImage (ex.: pacote do AUR)");
    process.env.APPIMAGE = "/tmp/Garimpo.AppImage";
    assert.equal(autoatualizacao.suportada(), true, "AppImage");
    Object.defineProperty(process, "platform", { value: "win32" });
    assert.equal(autoatualizacao.suportada(), true, "Windows");
  } finally {
    Object.defineProperty(process, "platform", plataforma);
    if (appimage === undefined) delete process.env.APPIMAGE;
    else process.env.APPIMAGE = appimage;
    electron.app.isPackaged = false;
  }
});

test("sem suporte, iniciar não faz nada (fica o aviso com link)", () => {
  electron.app.isPackaged = false;
  assert.equal(autoatualizacao.iniciar({}), false);
});
