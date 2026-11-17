#!/usr/bin/env python3
"""Gera src/renderer/temas.css a partir das paletas abaixo.

Uso: python3 scripts/gerar-temas.py
Cada tema tem versão clara e escura; a interface escolhe pelo modo (Sistema/Claro/Escuro).
Para adicionar um tema: acrescente aqui e em TEMAS de src/renderer/js/aparencia.js.
"""
from pathlib import Path

# Ordem dos campos: bg, lateral, card, linha, linha-forte, texto, suave, fraco,
#                   acento, acento-hover, acento-texto, acento-fundo, ok, aviso, erro
CAMPOS = ["bg", "lateral", "card", "linha", "linha-forte", "texto", "suave", "fraco",
          "acento", "acento-hover", "acento-texto", "acento-fundo", "ok", "aviso", "erro"]

TEMAS = {
    "garimpo": {
        "claro":  "#faf9f5 #f3f1ea #ffffff #e6e3da #d6d2c6 #1f1e1d #6b6962 #9a978e #b5573a #9f4a30 #ffffff #f6e6dd #4d7c4a #a8741a #b8483a",
        "escuro": "#262624 #1f1e1d #30302e #3e3e3a #4c4b46 #f0eee6 #b1ada1 #85827a #d97757 #e08a6d #1f1e1d #3d2e27 #8bb07f #d9a54a #e57f6f",
    },
    "tokyo-night": {  # Tokyo Night Day / Night
        "claro":  "#e1e2e7 #d0d5e3 #ecedf1 #c4c8da #a8aecb #3760bf #4f63a3 #848cb5 #2264c8 #1a56ad #ffffff #cdd8f2 #587539 #8c6c3e #f52a65",
        "escuro": "#1a1b26 #16161e #1f2335 #292e42 #3b4261 #c0caf5 #a9b1d6 #565f89 #7aa2f7 #89b4fa #1a1b26 #2a3150 #9ece6a #e0af68 #f7768e",
    },
    "dracula": {  # Alucard / Dracula
        "claro":  "#fffbeb #f4eed6 #fffdf5 #e6dfc2 #cfcfde #1f1f1f #4a4636 #6c664b #644ac9 #5539b3 #ffffff #e7e0f7 #14710a #a34d14 #cb3a2a",
        "escuro": "#282a36 #21222c #343746 #44475a #565970 #f8f8f2 #c5c8d6 #6272a4 #bd93f9 #caa9fa #282a36 #3b3456 #50fa7b #ffb86c #ff5555",
    },
    "catppuccin": {  # Latte / Mocha
        "claro":  "#eff1f5 #e6e9ef #f8f9fb #ccd0da #bcc0cc #4c4f69 #5c5f77 #8c8fa1 #8839ef #7527d9 #ffffff #e5d8fb #40a02b #c27a0e #d20f39",
        "escuro": "#1e1e2e #181825 #313244 #45475a #585b70 #cdd6f4 #bac2de #7f849c #cba6f7 #d6b8fa #1e1e2e #3b3452 #a6e3a1 #fab387 #f38ba8",
    },
    "nord": {
        "claro":  "#eceff4 #e5e9f0 #f8f9fb #d8dee9 #c2cad8 #2e3440 #4c566a #7b88a1 #4c6f99 #3f5f86 #ffffff #dbe5f0 #5f8a4b #a87b1c #bf616a",
        "escuro": "#2e3440 #292e39 #3b4252 #434c5e #4c566a #eceff4 #d8dee9 #7b88a1 #88c0d0 #8fbcbb #2e3440 #364556 #a3be8c #ebcb8b #e5848c",
    },
    "gruvbox": {
        "claro":  "#fbf1c7 #f2e5bc #f9f5d7 #ebdbb2 #d5c4a1 #3c3836 #504945 #7c6f64 #af3a03 #8f3002 #fbf1c7 #f2d6b8 #79740e #b57614 #9d0006",
        "escuro": "#282828 #1d2021 #32302f #3c3836 #504945 #ebdbb2 #d5c4a1 #928374 #fe8019 #fe9a4a #282828 #46322a #b8bb26 #fabd2f #fb4934",
    },
    "solarized": {
        "claro":  "#fdf6e3 #eee8d5 #fffcf4 #e4ddc8 #d3cbb7 #3f545b #586e75 #93a1a1 #1f6fa8 #185c8c #ffffff #dde9f0 #859900 #b58900 #dc322f",
        "escuro": "#002b36 #00212b #073642 #194652 #2a5a66 #eee8d5 #a7b3b3 #657b83 #4fa3e0 #6bb3e6 #002b36 #0d3d55 #a3b81a #d4a20f #f0605d",
    },
    "rose-pine": {  # Dawn / Main
        "claro":  "#faf4ed #f2e9e1 #fffaf3 #dfdad9 #cecacd #575279 #6a6688 #9893a5 #286983 #1f5a71 #ffffff #d6e6ec #3e7d88 #b8740f #b4637a",
        "escuro": "#191724 #16141f #1f1d2e #26233a #403d52 #e0def4 #908caa #6e6a86 #ebbcba #f2cfcd #191724 #3a2a35 #9ccfd8 #f6c177 #eb6f92",
    },
    "one": {  # One Light / One Dark
        "claro":  "#fafafa #f0f0f0 #ffffff #e5e5e6 #d4d4d4 #383a42 #696c77 #a0a1a7 #2f66e0 #2756bd #ffffff #dfe8fd #50a14f #c18401 #e45649",
        "escuro": "#282c34 #21252b #2c313a #3e4451 #4b5263 #d7dae0 #abb2bf #5c6370 #61afef #7cbdf3 #21252b #2b3a4d #98c379 #e5c07b #e06c75",
    },
}

def bloco(seletor, cores, recuo=""):
    valores = cores.split()
    assert len(valores) == len(CAMPOS), (seletor, len(valores))
    linhas = [f"{recuo}{seletor} {{"]
    linhas += [f"{recuo}  --{c}: {v};" for c, v in zip(CAMPOS, valores)]
    linhas.append(f"{recuo}}}")
    return "\n".join(linhas)

partes = ["""/* Gerado por scripts/gerar-temas.py: edite as paletas lá, não aqui.
   Cada tema vale para qualquer elemento com data-tema (a página inteira, no <html>, ou a amostra
   do tema nas Configurações). O modo claro/escuro vem do prefers-color-scheme, que o app controla. */

[data-tema] {
  --campo: var(--card);
  --card-hover: color-mix(in srgb, var(--card) 94%, var(--texto));
  --sombra: 0 1px 2px rgb(0 0 0 / .05), 0 2px 8px rgb(0 0 0 / .05);
}
@media (prefers-color-scheme: dark) {
  [data-tema] { --sombra: 0 1px 2px rgb(0 0 0 / .25); }
}
"""]
for nome, t in TEMAS.items():
    partes.append(bloco(f'[data-tema="{nome}"]', t["claro"]))
escuros = [bloco(f'[data-tema="{nome}"]', t["escuro"], "  ") for nome, t in TEMAS.items()]
partes.append("@media (prefers-color-scheme: dark) {\n" + "\n".join(escuros) + "\n}")

destino = Path(__file__).resolve().parent.parent / "src" / "renderer" / "temas.css"
destino.write_text("\n\n".join(partes) + "\n", encoding="utf-8")
print(f"{destino} gerado com {len(TEMAS)} temas.")
