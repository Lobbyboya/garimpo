// Interface do Garimpo. Fala com o processo principal só via window.api (preload.js).
const $ = (id) => document.getElementById(id);

const estado = {
  aba: "voce",
  config: { usuario: "", temChave: false, spotifyConectado: false, spotifyNome: "", spotifyClientId: "", manual: [] },
  grupoAtivo: null,
  auto: null, // último resultado gerado (cache ou recém-gerado)
};

const PERIODOS = { longo: "longo prazo", medio: "últimos 6 meses", curto: "último mês" };
const URL_LASTFM = "https://www.last.fm/api/account/create";
const URL_SPOTIFY = "https://developer.spotify.com/dashboard";

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

function msg(id, texto, tipo = "") {
  const el = $(id);
  el.textContent = texto || "";
  el.className = "msg" + (tipo ? " " + tipo : "");
}

function limparErro(e) {
  // O Electron prefixa erros do IPC com "Error invoking remote method '...': Error: "
  return String(e?.message || e).replace(/^Error invoking remote method '[^']+': (Error: )?/, "");
}

function temLastfm() {
  return estado.config.temChave && Boolean(estado.config.usuario);
}

function temFonte() {
  const c = estado.config;
  return c.spotifyConectado || temLastfm() || c.manual.length > 0;
}

function atualizarSub() {
  const c = estado.config;
  const fontes = [];
  if (c.spotifyConectado) fontes.push("Spotify" + (c.spotifyNome ? ` (${c.spotifyNome})` : ""));
  if (temLastfm()) fontes.push(`Last.fm (${c.usuario})`);
  if (c.manual.length) fontes.push(`sua lista (${c.manual.length})`);
  $("sub").textContent = fontes.length
    ? "Garimpando a partir de: " + fontes.join(" · ")
    : "Descubra artistas novos a partir do que você já ouve.";
}

// ---------- Cartão de artista (usado nas duas abas) ----------

function cartao(r, modo, maior) {
  const c = document.createElement("div");
  c.className = "card";
  const extra = r.lastfm
    ? `<a class="listen fraco" href="${esc(r.lastfm)}" target="_blank">Last.fm</a>`
    : r.deezer ? `<a class="listen fraco" href="${esc(r.deezer)}" target="_blank">Deezer</a>` : "";
  const foto = r.img
    ? `<img src="${esc(r.img)}" alt="" loading="lazy">`
    : `<div class="semfoto">${esc(r.nome.trim().charAt(0).toUpperCase())}</div>`;
  const genero = r.genero ? `<span class="tag">${esc(r.genero)}</span>` : "";
  const mostrar = r.sementes.slice(0, 4);
  const resto = r.sementes.length - mostrar.length;
  const chips = `<div class="seeds">${mostrar.map((s) => `<span>${esc(s)}</span>`).join("")}${resto > 0 ? `<span>+${resto}</span>` : ""}</div>`;

  let meio;
  if (modo === "curadoria") {
    const [a, b] = r.sementes;
    meio = `<div class="why">Na linha de ${esc(a)}${b ? " e " + esc(b) : ""}, que você ouve${r.sementes.length > 2 ? `, e de mais ${r.sementes.length - 2}` : ""}.</div>`;
  } else {
    meio = `
      <div class="barra"><div></div></div>
      <div class="why">Parecido com ${r.sementes.length} ${r.sementes.length === 1 ? "artista seu" : "artistas seus"}:</div>
      ${chips}`;
  }

  c.innerHTML = `
    <div class="head">
      ${foto}
      <div>
        <h3>${esc(r.nome)}</h3>
        ${genero}
      </div>
    </div>
    ${meio}
    <div class="links">
      <a class="listen" href="${esc(r.spotify)}" target="_blank">${r.spotifyDireto ? "Ouvir no Spotify →" : "Buscar no Spotify →"}</a>
      ${extra}
    </div>`;
  const barra = c.querySelector(".barra > div");
  if (barra) {
    const pct = Math.max(4, Math.round((r.pontos / maior) * 100));
    barra.style.width = pct + "%"; // via CSSOM: a CSP bloqueia atributos style inline
    barra.parentElement.title = `Afinidade ${pct}%`;
  }
  return c;
}

function combina(r, termo) {
  return !termo || [r.nome, r.genero, r.grupo, ...r.sementes].join(" ").toLowerCase().includes(termo);
}

// ---------- Aba "Para você": ranking geral ----------

function renderAuto() {
  const grid = $("grid-voce");
  grid.innerHTML = "";
  if (!estado.auto) return 0;
  const termo = termoBusca();
  const lista = estado.auto.recs.filter((r) => combina(r, termo));
  const maior = estado.auto.recs[0]?.pontos || 1;
  for (const r of lista) grid.appendChild(cartao(r, "ranking", maior));
  return lista.length;
}

function descreverAuto() {
  const a = estado.auto;
  if (!a) return;
  const quando = new Date(a.geradoEm).toLocaleString("pt-BR");
  const de = a.fontes?.length ? ` (${a.fontes.join(" + ")})` : "";
  const motor = a.motor ? `, parecidos via ${a.motor}` : "";
  status(`${a.recs.length} recomendações a partir de ${a.sementes.length} artistas seus${de}, ${PERIODOS[a.periodo] || "longo prazo"}${motor}. Geradas em ${quando}.`);
  $("avisos").textContent = (a.avisos || []).join(" ");
}

let gerando = false;

async function gerar() {
  if (gerando) return;
  if (!temFonte()) {
    abrirConfig();
    return;
  }
  gerando = true;
  const botao = $("gerar");
  botao.disabled = true;
  $("avisos").textContent = "";
  try {
    estado.auto = await window.api.gerar({ periodo: $("periodo").value, sementes: $("sementes").value });
    descreverAuto();
    // O login do Spotify pode ter caído durante a geração.
    estado.config = await window.api.lerConfig();
    atualizarSub();
  } catch (e) {
    status(limparErro(e), true);
  } finally {
    gerando = false;
    botao.disabled = false;
    montarFiltros();
    render();
  }
}

// ---------- Aba "Curadoria": as recomendações organizadas pelos seus grupos de gosto ----------

const POR_GRUPO = 8;

function gruposAtuais() {
  return estado.auto?.grupos || [];
}

function listaCuradoria() {
  const recs = estado.auto.recs;
  if (estado.grupoAtivo) return recs.filter((r) => r.grupo === estado.grupoAtivo);
  // "Todos": os melhores de cada grupo, intercalados, para nenhum estilo dominar a tela.
  const filas = gruposAtuais().map((g) => recs.filter((r) => r.grupo === g.nome).slice(0, POR_GRUPO));
  const saida = [];
  for (let i = 0; i < POR_GRUPO; i++) for (const fila of filas) if (fila[i]) saida.push(fila[i]);
  return saida;
}

function renderCuradoria() {
  const grid = $("grid-curadoria");
  const info = $("curadoriaInfo");
  grid.innerHTML = "";
  if (!estado.auto) {
    info.textContent = "";
    return 0;
  }
  const grupos = gruposAtuais();
  if (!grupos.length) {
    info.textContent = estado.auto.grupos
      ? "Não deu para identificar os estilos dos seus artistas. Conecte o Spotify ou configure o Last.fm em Configurações e clique em Garimpar."
      : "Clique em Garimpar para montar a sua curadoria.";
    return -1;
  }
  info.textContent = `${grupos.length} grupos de gosto, montados a partir dos estilos dos artistas que você mais ouve. A curadoria se refaz sozinha uma vez por dia, ao abrir o app.`;
  const termo = termoBusca();
  const lista = listaCuradoria().filter((r) => combina(r, termo));
  for (const r of lista) grid.appendChild(cartao(r, "curadoria"));
  return lista.length;
}

function montarFiltros() {
  const box = $("clusters");
  box.innerHTML = "";
  const grupos = gruposAtuais();
  if (!grupos.some((g) => g.nome === estado.grupoAtivo)) estado.grupoAtivo = null;
  if (!grupos.length) return;
  const chip = (texto, valor, dica) => {
    const b = document.createElement("button");
    b.className = "chip" + (estado.grupoAtivo === valor ? " active" : "");
    b.textContent = texto;
    if (dica) b.title = dica;
    b.onclick = () => { estado.grupoAtivo = valor; montarFiltros(); render(); };
    box.appendChild(b);
  };
  chip("Todos", null);
  for (const g of grupos) chip(g.nome, g.nome, "Seus artistas: " + g.artistas.join(", "));
}

// ---------- Geral ----------

function render() {
  const n = estado.aba === "voce" ? renderAuto() : renderCuradoria();
  $("empty").style.display = estado.auto && n === 0 ? "block" : "none";
  if (!estado.auto && !gerando && !temFonte()) status("Abra Configurações e escolha de onde o Garimpo tira o seu gosto musical.");
}

function trocarAba(aba) {
  estado.aba = aba;
  document.querySelectorAll(".aba").forEach((b) => b.classList.toggle("ativa", b.dataset.aba === aba));
  $("painel-voce").hidden = aba !== "voce";
  $("painel-curadoria").hidden = aba !== "curadoria";
  render();
}

// ---------- Configurações ----------

function lerManual() {
  return $("cfgManual").value.split("\n").map((s) => s.trim()).filter(Boolean);
}

function pintarConfig() {
  const c = estado.config;
  const sp = $("spEstado");
  sp.textContent = c.spotifyConectado
    ? "Conectado" + (c.spotifyNome ? " como " + c.spotifyNome : "")
    : "Não conectado.";
  sp.classList.toggle("ok", c.spotifyConectado);
  $("spConectar").textContent = c.spotifyConectado ? "Conectar outra conta" : "Conectar ao Spotify";
  $("spSair").hidden = !c.spotifyConectado;

  const lf = $("lfEstado");
  lf.textContent = temLastfm()
    ? `Configurado para o usuário ${c.usuario}.`
    : "Não configurado. Sem ele, os artistas parecidos vêm do Deezer.";
  lf.classList.toggle("ok", temLastfm());
  $("lfGuia").textContent = temLastfm() ? "Trocar usuário ou chave" : "Configurar passo a passo";
  $("lfRemover").hidden = !c.temChave;
}

function abrirConfig() {
  $("cfgClientId").value = estado.config.spotifyClientId;
  $("cfgClientId").placeholder = estado.config.temClientIdPadrao ? "Opcional: usar o seu próprio" : "32 letras e números";
  $("cfgManual").value = estado.config.manual.join("\n");
  msg("spMsg", "");
  pintarConfig();
  if (!$("config").open) $("config").showModal();
}

async function salvarCampos() {
  estado.config = await window.api.salvarConfig({
    spotifyClientId: $("cfgClientId").value,
    manual: lerManual(),
  });
  atualizarSub();
  pintarConfig();
}

$("cfgSalvar").onclick = async () => {
  await salvarCampos();
  $("config").close();
  render();
  if (temFonte() && !estado.auto) gerar();
};
$("cfgCancelar").onclick = () => $("config").close();

$("spConectar").onclick = async () => {
  const botao = $("spConectar");
  try {
    await salvarCampos();
    if (!estado.config.spotifyClientId && !estado.config.temClientIdPadrao) {
      msg("spMsg", "Cole o Client ID primeiro. Veja \"Como conseguir um Client ID\".", "erro");
      return;
    }
    botao.disabled = true;
    msg("spMsg", "Abrimos o Spotify no seu navegador. Autorize lá e volte para cá.");
    estado.config = await window.api.conectarSpotify();
    msg("spMsg", "Spotify conectado.", "ok");
  } catch (e) {
    msg("spMsg", limparErro(e), "erro");
  } finally {
    botao.disabled = false;
    atualizarSub();
    pintarConfig();
  }
};

$("spSair").onclick = async () => {
  estado.config = await window.api.desconectarSpotify();
  msg("spMsg", "Spotify desconectado neste computador.");
  atualizarSub();
  pintarConfig();
};

// Guia do Spotify
$("spGuia").onclick = () => {
  $("spRedirect").textContent = estado.config.spotifyRedirect;
  $("guiaSpotify").showModal();
};
$("spAbrirSite").onclick = () => window.api.abrirLink(URL_SPOTIFY);
$("spCopiar").onclick = async () => {
  try {
    await navigator.clipboard.writeText(estado.config.spotifyRedirect);
    $("spCopiar").textContent = "Copiado";
  } catch {
    $("spCopiar").textContent = "Selecione e copie";
  }
  setTimeout(() => ($("spCopiar").textContent = "Copiar"), 1500);
};
$("spFecharGuia").onclick = () => $("guiaSpotify").close();

// Guia do Last.fm
$("lfGuia").onclick = () => {
  $("lfUsuario").value = estado.config.usuario;
  $("lfChave").value = "";
  $("lfChave").placeholder = estado.config.temChave ? "Deixe vazio para manter a chave atual" : "Cole a API key aqui";
  msg("lfMsg", "");
  $("guiaLastfm").showModal();
};
$("lfAbrirSite").onclick = () => window.api.abrirLink(URL_LASTFM);
$("lfFechar").onclick = () => $("guiaLastfm").close();
$("lfTestar").onclick = async () => {
  const chave = $("lfChave").value.trim();
  if (chave && !/^[0-9a-f]{32}$/i.test(chave)) {
    msg("lfMsg", "A API key tem 32 letras e números. Confira se copiou a API key inteira, e não o Shared secret pela metade.", "erro");
    return;
  }
  const botao = $("lfTestar");
  botao.disabled = true;
  msg("lfMsg", "Testando com o Last.fm...");
  try {
    estado.config = await window.api.testarLastfm({ apiKey: chave, usuario: $("lfUsuario").value });
    msg("lfMsg", "Funcionou. Chave e usuário salvos.", "ok");
    atualizarSub();
    pintarConfig();
    setTimeout(() => $("guiaLastfm").close(), 900);
  } catch (e) {
    msg("lfMsg", limparErro(e), "erro");
  } finally {
    botao.disabled = false;
  }
};
$("lfRemover").onclick = async () => {
  estado.config = await window.api.removerLastfm();
  atualizarSub();
  pintarConfig();
};

$("abrirConfig").onclick = abrirConfig;
$("gerar").onclick = gerar;
$("busca").addEventListener("input", render);
document.querySelectorAll(".aba").forEach((b) => (b.onclick = () => trocarAba(b.dataset.aba)));
window.api.aoProgresso((m) => status(m));

const UM_DIA = 24 * 60 * 60 * 1000;

(async function iniciar() {
  const [config, cache] = await Promise.all([window.api.lerConfig(), window.api.lerCache()]);
  estado.config = config;
  if (cache?.recs) {
    estado.auto = cache;
    if (PERIODOS[cache.opcoes?.periodo]) $("periodo").value = cache.opcoes.periodo;
    if (cache.opcoes?.sementes) $("sementes").value = String(cache.opcoes.sementes);
    descreverAuto();
  }
  atualizarSub();
  montarFiltros();
  render();
  if (!temFonte()) {
    abrirConfig();
    return;
  }
  // Curadoria dinâmica: refaz sozinha se o último resultado tem mais de um dia (ou é de uma versão antiga).
  const idade = cache?.geradoEm ? Date.now() - new Date(cache.geradoEm).getTime() : Infinity;
  if (!cache?.recs || !cache.grupos || idade > UM_DIA) gerar();
})();
