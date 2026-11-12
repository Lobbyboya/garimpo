// Interface do recomendador. Fala com o processo principal só via window.api (preload.js).
const $ = (id) => document.getElementById(id);

const estado = {
  aba: "lastfm",
  config: { usuario: "", temChave: false },
  curadas: { clusters: {}, recs: [] },
  clusterAtivo: null,
  auto: null, // resultado do Last.fm (cache ou recém-gerado)
};

const PERIODOS = {
  overall: "desde sempre", "12month": "últimos 12 meses", "6month": "últimos 6 meses",
  "3month": "últimos 3 meses", "1month": "último mês", "7day": "últimos 7 dias",
};

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));
}

function termoBusca() {
  return $("busca").value.trim().toLowerCase();
}

function status(msg, erro = false) {
  $("status").textContent = msg || "";
  $("status").classList.toggle("erro", erro);
}

function atualizarSub() {
  const u = estado.config.usuario;
  $("sub").textContent = estado.config.temChave
    ? `Usuário do Last.fm: ${u}`
    : `Usuário do Last.fm: ${u} · falta configurar a chave de API`;
}

// ---------- Aba Last.fm ----------

function renderAuto() {
  const grid = $("grid-lastfm");
  grid.innerHTML = "";
  if (!estado.auto) {
    if (!estado.config.temChave) status("Abra Configurações e cole sua chave de API do Last.fm para gerar recomendações.");
    return 0;
  }
  const termo = termoBusca();
  const lista = estado.auto.recs.filter((r) =>
    !termo || (r.nome + " " + r.sementes.join(" ")).toLowerCase().includes(termo)
  );
  const maior = estado.auto.recs[0]?.pontos || 1;
  for (const r of lista) {
    const c = document.createElement("div");
    c.className = "card";
    const pct = Math.max(4, Math.round((r.pontos / maior) * 100));
    const mostrar = r.sementes.slice(0, 4);
    const resto = r.sementes.length - mostrar.length;
    c.innerHTML = `
      <div class="head">
        ${r.img ? `<img src="${esc(r.img)}" alt="" loading="lazy">` : `<div class="semfoto">${esc(r.nome.trim().charAt(0).toUpperCase())}</div>`}
        <h3>${esc(r.nome)}</h3>
      </div>
      <div class="barra" title="Pontuação ${r.pontos}"><div></div></div>
      <div class="why">Parecido com ${r.sementes.length} ${r.sementes.length === 1 ? "artista seu" : "artistas seus"}:</div>
      <div class="seeds">${mostrar.map((s) => `<span>${esc(s)}</span>`).join("")}${resto > 0 ? `<span>+${resto}</span>` : ""}</div>
      <div class="links">
        <a class="listen" href="${esc(r.spotify)}" target="_blank">Spotify →</a>
        <a class="listen fraco" href="${esc(r.lastfm)}" target="_blank">Last.fm</a>
      </div>`;
    // Largura via CSSOM: a CSP bloqueia atributos style inline.
    c.querySelector(".barra > div").style.width = pct + "%";
    grid.appendChild(c);
  }
  return lista.length;
}

function descreverAuto() {
  const a = estado.auto;
  if (!a) return;
  const quando = new Date(a.geradoEm).toLocaleString("pt-BR");
  status(`${a.recs.length} recomendações a partir dos seus top ${a.sementes.length} (${PERIODOS[a.periodo] || a.periodo}), geradas em ${quando}.`);
}

async function gerar() {
  if (!estado.config.temChave) {
    abrirConfig();
    return;
  }
  const botao = $("gerar");
  botao.disabled = true;
  try {
    estado.auto = await window.api.gerar({ periodo: $("periodo").value, sementes: $("sementes").value });
    descreverAuto();
  } catch (e) {
    status(limparErro(e), true);
  } finally {
    botao.disabled = false;
    render();
  }
}

function limparErro(e) {
  // O Electron prefixa erros do IPC com "Error invoking remote method '...': Error: "
  return String(e?.message || e).replace(/^Error invoking remote method '[^']+': (Error: )?/, "");
}

// ---------- Aba Curadas ----------

function renderCuradas() {
  const termo = termoBusca();
  const grid = $("grid-curadas");
  grid.innerHTML = "";
  const lista = estado.curadas.recs.filter((r) =>
    (!estado.clusterAtivo || r.cluster === estado.clusterAtivo) &&
    (!termo || (r.name + " " + r.genre + " " + r.cluster + " " + r.seeds.join(" ")).toLowerCase().includes(termo))
  );
  for (const r of lista) {
    const c = document.createElement("div");
    c.className = "card";
    const url = r.spotify
      ? "https://open.spotify.com/artist/" + r.spotify
      : "https://open.spotify.com/search/" + encodeURIComponent(r.name);
    c.innerHTML = `
      <div class="head">
        ${r.img ? `<img src="${esc(r.img)}" alt="" loading="lazy">` : ""}
        <div>
          <h3>${esc(r.name)}</h3>
          <span class="tag">${esc(r.genre)}</span>
        </div>
      </div>
      <div class="why">${esc(r.why)}</div>
      <div class="seeds">${r.seeds.map((s) => `<span>${esc(s)}</span>`).join("")}</div>
      <div class="links"><a class="listen" href="${esc(url)}" target="_blank">Ouvir no Spotify →</a></div>
      ${r.restrito ? `<div class="restrito">Pode não tocar na sua conta (restrição de licença no Spotify).</div>` : ""}`;
    grid.appendChild(c);
  }
  return lista.length;
}

function montarFiltros() {
  const box = $("clusters");
  box.innerHTML = "";
  const chip = (texto, valor, dica) => {
    const b = document.createElement("button");
    b.className = "chip" + (estado.clusterAtivo === valor ? " active" : "");
    b.textContent = texto;
    if (dica) b.title = dica;
    b.onclick = () => { estado.clusterAtivo = valor; montarFiltros(); render(); };
    box.appendChild(b);
  };
  chip("Todos", null);
  for (const [nome, dica] of Object.entries(estado.curadas.clusters)) chip(nome, nome, dica);
}

// ---------- Geral ----------

function render() {
  const n = estado.aba === "lastfm" ? renderAuto() : renderCuradas();
  const semDados = estado.aba === "lastfm" && !estado.auto;
  $("empty").style.display = !semDados && n === 0 ? "block" : "none";
}

function trocarAba(aba) {
  estado.aba = aba;
  document.querySelectorAll(".aba").forEach((b) => b.classList.toggle("ativa", b.dataset.aba === aba));
  $("painel-lastfm").hidden = aba !== "lastfm";
  $("painel-curadas").hidden = aba !== "curadas";
  render();
}

function abrirConfig() {
  $("cfgUsuario").value = estado.config.usuario;
  $("cfgChave").value = "";
  $("cfgChave").placeholder = estado.config.temChave ? "Deixe vazio para manter a atual" : "Cole aqui sua chave";
  $("config").showModal();
}

$("config").addEventListener("close", async () => {
  if ($("config").returnValue !== "salvar") return;
  estado.config = await window.api.salvarConfig({ usuario: $("cfgUsuario").value, apiKey: $("cfgChave").value });
  atualizarSub();
  if (estado.config.temChave && !estado.auto) status("Chave salva. Clique em Gerar recomendações.");
});

$("abrirConfig").onclick = abrirConfig;
$("gerar").onclick = gerar;
$("busca").addEventListener("input", render);
document.querySelectorAll(".aba").forEach((b) => (b.onclick = () => trocarAba(b.dataset.aba)));
window.api.aoProgresso((msg) => status(msg));

(async function iniciar() {
  const [config, curadas, cache] = await Promise.all([
    window.api.lerConfig(), window.api.lerCuradas(), window.api.lerCache(),
  ]);
  estado.config = config;
  estado.curadas = curadas;
  if (cache && cache.usuario === config.usuario) {
    estado.auto = cache;
    $("periodo").value = cache.periodo;
    descreverAuto();
  }
  atualizarSub();
  montarFiltros();
  render();
  if (!config.temChave) abrirConfig();
})();
