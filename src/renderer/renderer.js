// Interface do Garimpo. Fala com o processo principal só via window.api (preload.js).
const $ = (id) => document.getElementById(id);

const estado = {
  aba: "voce",
  config: { usuario: "", temChave: false, spotifyConectado: false, spotifyNome: "", spotifyClientId: "", manual: [] },
  grupoAtivo: null,
  auto: null, // último resultado gerado (cache ou recém-gerado)
  salvos: [], // artistas guardados para ouvir depois (salvos.json)
  filtroSalvos: "todos", // todos | pendentes | ouvidos
};

// Título e descrição de cada aba.
const PAGINAS = {
  voce: { titulo: "Para você", descricao: "Artistas novos, do mais ao menos parecido com o que você ouve." },
  curadoria: { titulo: "Curadoria", descricao: "As mesmas recomendações, separadas pelos seus grupos de gosto." },
  salvos: { titulo: "Salvos", descricao: "Artistas que você guardou para ouvir depois. Eles ficam aqui mesmo quando saem das recomendações." },
};

const ICONE_SALVAR = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.5 3.5h11v17l-5.5-4-5.5 4z"/></svg>';

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
    ? "Garimpando a partir de " + fontes.join(", ") + "."
    : "Nenhuma fonte configurada ainda.";
}

// ---------- Cartão de artista (usado nas duas abas) ----------

// ---------- Salvos ----------

const chaveNome = (nome) => String(nome || "").trim().toLowerCase();

function ehSalvo(nome) {
  const k = chaveNome(nome);
  return estado.salvos.some((s) => chaveNome(s.nome) === k);
}

// O artista ainda aparece nas recomendações atuais?
function aindaRecomendado(nome) {
  const k = chaveNome(nome);
  return Boolean(estado.auto?.recs?.some((r) => chaveNome(r.nome) === k));
}

function atualizarContador() {
  const pendentes = estado.salvos.filter((s) => !s.ouvido).length;
  const el = $("contSalvos");
  el.textContent = String(pendentes);
  el.hidden = pendentes === 0;
  el.title = `${pendentes} para ouvir`;
}

function pintarBotaoSalvar(botao, nome) {
  const salvo = ehSalvo(nome);
  botao.classList.toggle("ativo", salvo);
  botao.title = salvo ? "Tirar dos salvos" : "Salvar para ouvir depois";
  botao.setAttribute("aria-label", botao.title);
}

async function alternarSalvo(r, botao) {
  try {
    estado.salvos = await window.api.alternarSalvo({ ...r, aba: estado.aba });
  } catch (e) {
    status(limparErro(e), true);
    return;
  }
  atualizarContador();
  // Fora da aba Salvos só o botão muda, para não fechar prévias abertas nem parar o som.
  if (estado.aba === "salvos") render();
  else pintarBotaoSalvar(botao, r.nome);
}

async function marcarOuvido(s) {
  estado.salvos = await window.api.marcarOuvido(s.nome, !s.ouvido);
  atualizarContador();
  render();
}

function cartao(r, modo, maior) {
  const c = document.createElement("div");
  c.className = "card" + (modo === "salvo" && r.ouvido ? " ouvido" : "");
  const extra = r.lastfm
    ? `<a class="listen fraco" href="${esc(r.lastfm)}" target="_blank">Last.fm</a>`
    : r.deezer ? `<a class="listen fraco" href="${esc(r.deezer)}" target="_blank">Deezer</a>` : "";
  const foto = r.img
    ? `<img src="${esc(r.img)}" alt="" loading="lazy">`
    : `<div class="semfoto">${esc(r.nome.trim().charAt(0).toUpperCase())}</div>`;
  const genero = r.genero ? `<span class="tag">${esc(r.genero)}</span>` : "";
  r = { ...r, sementes: r.sementes || [] };
  const mostrar = r.sementes.slice(0, 4);
  const resto = r.sementes.length - mostrar.length;
  const chips = `<div class="seeds">${mostrar.map((s) => `<span>${esc(s)}</span>`).join("")}${resto > 0 ? `<span>+${resto}</span>` : ""}</div>`;

  let meio;
  if (modo === "salvo") {
    const quando = new Date(r.salvoEm).toLocaleDateString("pt-BR", { day: "numeric", month: "short", year: "numeric" });
    const [a, b] = r.sementes || [];
    const origem = a ? ` Veio de ${esc(a)}${b ? " e " + esc(b) : ""}.` : "";
    const selo = r.ouvido
      ? '<span class="selo neutro">Já ouvido</span>'
      : aindaRecomendado(r.nome) ? '<span class="selo">Ainda recomendado</span>' : "";
    meio = `
      <div class="why">Salvo em ${esc(quando)}.${origem} ${selo}</div>
      <div class="acoes-salvo">
        <button class="botao secundario marcar" type="button">${r.ouvido ? "Marcar como não ouvido" : "Já ouvi"}</button>
        <button class="botao secundario remover" type="button">Remover</button>
      </div>`;
  } else if (modo === "curadoria") {
    const [a, b] = r.sementes;
    meio = `<div class="why">Na linha de ${esc(a)}${b ? " e " + esc(b) : ""}, que você ouve${r.sementes.length > 2 ? `, e de mais ${r.sementes.length - 2}` : ""}.</div>`;
  } else {
    meio = `
      <div class="barra"><div></div></div>
      <div class="why">Parecido com ${r.sementes.length} ${r.sementes.length === 1 ? "artista seu" : "artistas seus"}:</div>
      ${chips}`;
  }

  c.innerHTML = `
    <button class="salvar" type="button">${ICONE_SALVAR}</button>
    <div class="head">
      ${foto}
      <div>
        <h3>${esc(r.nome)}</h3>
        ${genero}
      </div>
    </div>
    ${meio}
    <div class="links">
      <a class="listen" href="${esc(r.spotify || "https://open.spotify.com/search/" + encodeURIComponent(r.nome))}" target="_blank">${r.spotifyDireto ? "Ouvir no Spotify →" : "Buscar no Spotify →"}</a>
      ${extra}
      <button class="textual previas" type="button">♪ Prévias</button>
    </div>
    <ol class="faixas" hidden></ol>`;
  c.querySelector(".previas").onclick = () => alternarFaixas(c, r);
  const salvar = c.querySelector(".salvar");
  pintarBotaoSalvar(salvar, r.nome);
  salvar.onclick = () => alternarSalvo(r, salvar);
  if (modo === "salvo") {
    c.querySelector(".marcar").onclick = () => marcarOuvido(r);
    c.querySelector(".remover").onclick = () => alternarSalvo(r, salvar);
  }
  const barra = c.querySelector(".barra > div");
  if (barra) {
    const pct = Math.max(4, Math.round((r.pontos / maior) * 100));
    barra.style.width = pct + "%"; // via CSSOM: a CSP bloqueia atributos style inline
    barra.parentElement.title = `Afinidade ${pct}%`;
  }
  return c;
}

// ---------- Prévias de 30 s (Deezer) ----------

const player = new Audio();
let tocando = null; // botão da faixa que está tocando
const faixasCache = new Map(); // nome do artista -> faixas (ou a promessa em andamento)

function pararPrevia() {
  player.pause();
  if (tocando) tocando.textContent = "▶";
  tocando = null;
}
player.addEventListener("ended", pararPrevia);
player.addEventListener("error", () => {
  if (tocando) tocando.title = "Não foi possível tocar esta prévia.";
  pararPrevia();
});

// O id do Deezer vem no link da recomendação (https://www.deezer.com/artist/123).
function deezerIdDe(r) {
  return String(r.deezer || "").match(/\/artist\/(\d+)/)?.[1] || null;
}

function carregarFaixas(r) {
  if (!faixasCache.has(r.nome)) {
    const promessa = window.api.topFaixas({ nome: r.nome, deezerId: deezerIdDe(r) }).catch(() => {
      faixasCache.delete(r.nome); // falhou: tenta de novo no próximo clique
      return null;
    });
    faixasCache.set(r.nome, promessa);
  }
  return faixasCache.get(r.nome);
}

async function alternarFaixas(c, r) {
  const lista = c.querySelector(".faixas");
  if (!lista.hidden) {
    lista.hidden = true;
    if (tocando && lista.contains(tocando)) pararPrevia();
    return;
  }
  lista.hidden = false;
  lista.innerHTML = '<li class="carregando">Carregando...</li>';
  const faixas = await carregarFaixas(r);
  lista.innerHTML = "";
  if (!faixas?.length) {
    lista.innerHTML = `<li class="carregando">${faixas ? "Nenhuma música encontrada no Deezer." : "Não foi possível falar com o Deezer."}</li>`;
    return;
  }
  for (const f of faixas) {
    const li = document.createElement("li");
    const tocar = document.createElement("button");
    tocar.className = "tocar";
    tocar.type = "button";
    tocar.textContent = "▶";
    tocar.disabled = !f.preview;
    tocar.title = f.preview ? "Ouvir 30 segundos" : "Sem prévia disponível";
    tocar.onclick = () => {
      if (tocando === tocar) return pararPrevia();
      pararPrevia();
      player.src = f.preview;
      player.play().then(() => {
        window.api.registrarEvento("previa_tocada");
        tocando = tocar;
        tocar.textContent = "❚❚";
      }).catch(() => (tocar.title = "Não foi possível tocar esta prévia."));
    };
    const nome = document.createElement(f.link ? "a" : "span");
    nome.className = "titulo";
    nome.textContent = f.titulo;
    if (f.link) {
      nome.href = f.link;
      nome.target = "_blank";
      nome.title = "Abrir no Deezer";
    }
    li.append(tocar, nome);
    lista.appendChild(li);
  }
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

// ---------- Aba "Salvos" ----------

const FILTROS_SALVOS = [
  ["todos", "Todos"],
  ["pendentes", "Para ouvir"],
  ["ouvidos", "Já ouvidos"],
];

function montarFiltrosSalvos() {
  const box = $("filtrosSalvos");
  box.innerHTML = "";
  if (!estado.salvos.length) return;
  for (const [valor, texto] of FILTROS_SALVOS) {
    const b = document.createElement("button");
    b.className = "chip" + (estado.filtroSalvos === valor ? " active" : "");
    b.textContent = texto;
    b.onclick = () => { estado.filtroSalvos = valor; render(); };
    box.appendChild(b);
  }
}

function renderSalvos() {
  const grid = $("grid-salvos");
  grid.innerHTML = "";
  montarFiltrosSalvos();
  const termo = termoBusca();
  const lista = estado.salvos
    .filter((s) => estado.filtroSalvos === "todos" || (estado.filtroSalvos === "ouvidos") === Boolean(s.ouvido))
    .filter((s) => combina({ ...s, sementes: s.sementes || [] }, termo));
  for (const s of lista) grid.appendChild(cartao(s, "salvo"));
  return lista.length;
}

// ---------- Geral ----------

function render() {
  pararPrevia();
  const n = estado.aba === "voce" ? renderAuto() : estado.aba === "curadoria" ? renderCuradoria() : renderSalvos();
  const vazio = $("empty");
  if (estado.aba === "salvos") {
    vazio.textContent = estado.salvos.length
      ? "Nada encontrado com esse filtro."
      : "Nenhum artista salvo ainda. Toque no marcador de um cartão para guardá-lo aqui.";
    vazio.style.display = n === 0 ? "block" : "none";
  } else {
    vazio.textContent = "Nada encontrado com esse filtro.";
    vazio.style.display = estado.auto && n === 0 ? "block" : "none";
  }
  if (!estado.auto && !gerando && !temFonte()) status("Abra Configurações e escolha de onde o Garimpo tira o seu gosto musical.");
}

function trocarAba(aba) {
  if (aba !== estado.aba) window.api.registrarEvento("aba_aberta", { aba });
  estado.aba = aba;
  document.querySelectorAll(".aba").forEach((b) => b.classList.toggle("ativa", b.dataset.aba === aba));
  $("painel-voce").hidden = aba !== "voce";
  $("painel-curadoria").hidden = aba !== "curadoria";
  $("painel-salvos").hidden = aba !== "salvos";
  // Garimpar não muda os salvos: os controles só aparecem nas abas de recomendação.
  $("controlesGerar").hidden = aba === "salvos";
  $("status").hidden = aba === "salvos";
  $("avisos").hidden = aba === "salvos";
  $("tituloPagina").textContent = PAGINAS[aba].titulo;
  $("descricaoPagina").textContent = PAGINAS[aba].descricao;
  $("busca").placeholder = aba === "salvos" ? "Buscar nos salvos..." : "Buscar por nome, gênero ou artista seu...";
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
  if (!conectando) $("spConectar").textContent = c.spotifyConectado ? "Conectar outra conta" : "Conectar ao Spotify";
  $("spSair").hidden = !c.spotifyConectado;

  const lf = $("lfEstado");
  lf.textContent = temLastfm()
    ? `Configurado para o usuário ${c.usuario}.`
    : "Não configurado. Sem ele, os artistas parecidos vêm do Deezer.";
  lf.classList.toggle("ok", temLastfm());
  $("lfGuia").textContent = temLastfm() ? "Trocar usuário ou chave" : "Configurar passo a passo";
  $("lfRemover").hidden = !c.temChave;

  const upd = $("updEstado");
  if (upd) {
    upd.textContent = `Garimpo v${c.versao || "1.0.0"}`;
  }
}

// ---------- Estatísticas de uso (opt-in) ----------

let telemetria = { disponivel: false, escolha: null };

function pintarTelemetria() {
  $("blocoTelemetria").hidden = !telemetria.disponivel;
  $("cfgTelemetria").checked = telemetria.escolha === true;
}

async function escolherTelemetria(sim) {
  telemetria = await window.api.telemetriaEscolher(sim);
  pintarTelemetria();
}

$("cfgTelemetria").onchange = async (e) => {
  await escolherTelemetria(e.target.checked);
  msg("telMsg", e.target.checked ? "Obrigado! As estatísticas serão enviadas." : "Desligado. Nada mais será enviado.", "ok");
};
$("telApagar").onclick = async () => {
  msg("telMsg", "Apagando...");
  try {
    await window.api.telemetriaApagar();
    msg("telMsg", "Pronto: o que esta instalação já enviou foi apagado.", "ok");
  } catch (e) {
    msg("telMsg", limparErro(e), "erro");
  }
};
$("telSim").onclick = async () => {
  await escolherTelemetria(true);
  $("perguntaTelemetria").close();
};
$("telNao").onclick = async () => {
  await escolherTelemetria(false);
  $("perguntaTelemetria").close();
};
// Fechar com Esc conta como "agora não" só nesta sessão: pergunta de novo na próxima abertura.

function abrirConfig() {
  $("cfgClientId").value = estado.config.spotifyClientId;
  $("cfgClientId").placeholder = estado.config.temClientIdPadrao ? "Opcional: usar o seu próprio" : "32 letras e números";
  $("cfgManual").value = estado.config.manual.join("\n");
  msg("telMsg", "");
  pintarTelemetria();
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
$("cfgCancelar").onclick = () => {
  if (conectando) window.api.cancelarSpotify();
  $("config").close();
};

$("config").addEventListener("close", () => {
  if (conectando) window.api.cancelarSpotify();
});

let conectando = false;

$("spConectar").onclick = async () => {
  // Durante o login o mesmo botão cancela, para ninguém ficar preso esperando o prazo de 5 minutos.
  if (conectando) {
    await window.api.cancelarSpotify();
    return;
  }
  const botao = $("spConectar");
  try {
    await salvarCampos();
    if (!estado.config.spotifyClientId && !estado.config.temClientIdPadrao) {
      msg("spMsg", "Cole o Client ID primeiro. Veja \"Como conseguir um Client ID\".", "erro");
      return;
    }
    conectando = true;
    botao.textContent = "Cancelar login";
    msg("spMsg", "Abrimos o Spotify no seu navegador. Autorize lá e volte para cá.");
    estado.config = await window.api.conectarSpotify();
    msg("spMsg", "Spotify conectado.", "ok");
  } catch (e) {
    msg("spMsg", limparErro(e), "erro");
  } finally {
    conectando = false;
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

// ---------- Atualizador ----------

let infoAtualizacao = null;

function exibirBannerAtualizacao(info) {
  infoAtualizacao = info;
  $("versaoNovaTexto").textContent = `v${info.novaVersao}`;
  $("bannerAtualizacao").hidden = false;
}

$("btnBaixarAtualizacao").onclick = () => {
  const link = infoAtualizacao?.downloadUrl || infoAtualizacao?.url;
  if (link) window.api.abrirLink(link);
};

$("btnFecharBanner").onclick = () => {
  $("bannerAtualizacao").hidden = true;
};

$("btnChecarUpdate").onclick = async () => {
  const botao = $("btnChecarUpdate");
  try {
    botao.disabled = true;
    msg("updMsg", "Consultando GitHub por novas versões...");
    const info = await window.api.checarAtualizacao();
    if (info.temNova) {
      msg("updMsg", `Nova versão disponível: v${info.novaVersao}!`, "ok");
      exibirBannerAtualizacao(info);
    } else {
      msg("updMsg", info.mensagem || "Você já está na versão mais recente.", "ok");
    }
  } catch (e) {
    msg("updMsg", limparErro(e), "erro");
  } finally {
    botao.disabled = false;
  }
};

window.api.aoNovaVersao((info) => {
  exibirBannerAtualizacao(info);
});

const UM_DIA = 24 * 60 * 60 * 1000;

(async function iniciar() {
  const [config, cache, salvos, tel] = await Promise.all([
    window.api.lerConfig(), window.api.lerCache(), window.api.listarSalvos(), window.api.telemetriaSituacao(),
  ]);
  estado.config = config;
  telemetria = tel;
  estado.salvos = salvos || [];
  atualizarContador();
  $("descricaoPagina").textContent = PAGINAS.voce.descricao;
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
  // Pergunta sobre as estatísticas uma vez, depois que a pessoa já configurou o app.
  if (telemetria.disponivel && telemetria.escolha === null) $("perguntaTelemetria").showModal();
  // Curadoria dinâmica: refaz sozinha se o último resultado tem mais de um dia (ou é de uma versão antiga).
  const idade = cache?.geradoEm ? Date.now() - new Date(cache.geradoEm).getTime() : Infinity;
  if (!cache?.recs || !cache.grupos || idade > UM_DIA) gerar();
})();
