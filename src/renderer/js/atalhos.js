// Atalhos de teclado. Não valem enquanto a pessoa digita num campo ou com uma janela aberta.
import { $ } from "./util.js";
import { trocarAba } from "./telas.js";
import { pausarOuRetomar, proxima, radioLigado } from "./previas.js";

const ABAS = { 1: "voce", 2: "curadoria", 3: "salvos" };

const digitando = (el) => el && (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName));

export function ligarAtalhos() {
  document.addEventListener("keydown", (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === "Escape" && document.activeElement === $("busca") && $("busca").value) {
      $("busca").value = "";
      $("busca").dispatchEvent(new Event("input"));
      return;
    }
    if (digitando(document.activeElement) || document.querySelector("dialog[open]")) return;
    if (e.key === "/") {
      e.preventDefault();
      $("busca").focus();
    } else if (ABAS[e.key]) {
      trocarAba(ABAS[e.key]);
    } else if (e.key === " " && pausarOuRetomar()) {
      e.preventDefault(); // não rola a página
    } else if (e.key.toLowerCase() === "n" && radioLigado()) {
      proxima();
    }
  });
}
