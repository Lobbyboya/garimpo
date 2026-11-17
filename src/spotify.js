// Login do Spotify (Authorization Code com PKCE, sem client secret) e leitura dos top artistas.
// Cada pessoa entra com a própria conta. O app só pede a permissão "user-top-read".
const http = require("http");
const crypto = require("crypto");

const PORTA = 48721;
const REDIRECT = `http://127.0.0.1:${PORTA}/callback`;
const ESCOPO = "user-top-read";
const CONTAS = "https://accounts.spotify.com";
const API = "https://api.spotify.com/v1";

const b64url = (buf) => buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

function pagina(titulo, texto) {
  return `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><title>Garimpo</title>
<body style="margin:0;height:100vh;display:flex;align-items:center;justify-content:center;background:#0f1115;color:#e8eaf0;font-family:system-ui,Segoe UI,sans-serif;text-align:center">
<div><h1 style="font-size:1.4rem">${titulo}</h1><p style="color:#9aa0ad">${texto}</p></div></body></html>`;
}

let loginAtual = null; // servidor do login em andamento, para cancelar se a pessoa clicar de novo

// Abre o navegador na tela de autorização e espera o Spotify chamar http://127.0.0.1:PORTA/callback.
function esperarCodigo(clientId, abrirNavegador) {
  cancelarLogin();
  const verificador = b64url(crypto.randomBytes(64));
  const desafio = b64url(crypto.createHash("sha256").update(verificador).digest());
  const estado = b64url(crypto.randomBytes(16));

  return new Promise((ok, erro) => {
    let prazo;
    const servidor = http.createServer((req, res) => {
      const u = new URL(req.url, REDIRECT);
      if (u.pathname !== "/callback") {
        res.writeHead(404).end();
        return;
      }
      const falha = u.searchParams.get("error");
      const codigo = u.searchParams.get("code");
      const valido = !falha && codigo && u.searchParams.get("state") === estado;
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(valido
        ? pagina("Spotify conectado", "Pode fechar esta aba e voltar para o Garimpo.")
        : pagina("Não deu certo", "A autorização foi cancelada ou é inválida. Volte ao Garimpo e tente de novo."));
      finalizar();
      if (valido) ok({ codigo, verificador });
      else erro(new Error(falha === "access_denied" ? "Você cancelou a autorização no Spotify." : "A autorização do Spotify falhou."));
    });

    function finalizar() {
      servidor.close();
      servidor.closeAllConnections(); // o navegador pode manter a conexão aberta (keep-alive)
    }

    // Fechar o servidor por qualquer motivo (sucesso, erro, prazo ou cancelamento) limpa tudo.
    // Se a promessa já foi resolvida, o erro abaixo é ignorado.
    servidor.on("close", () => {
      clearTimeout(prazo);
      if (loginAtual === servidor) loginAtual = null;
      erro(new Error("Login cancelado."));
    });
    servidor.on("error", (e) => {
      finalizar();
      erro(new Error(e.code === "EADDRINUSE"
        ? `A porta ${PORTA} está em uso por outro programa. Feche-o e tente de novo.`
        : "Não foi possível iniciar o login do Spotify."));
    });
    servidor.listen(PORTA, "127.0.0.1", () => {
      loginAtual = servidor;
      prazo = setTimeout(() => {
        finalizar();
        erro(new Error("O login do Spotify expirou. Tente de novo."));
      }, 5 * 60 * 1000);
      const url = new URL(CONTAS + "/authorize");
      url.search = new URLSearchParams({
        client_id: clientId,
        response_type: "code",
        redirect_uri: REDIRECT,
        scope: ESCOPO,
        state: estado,
        code_challenge_method: "S256",
        code_challenge: desafio,
      }).toString();
      abrirNavegador(url.toString());
    });
  });
}

// Cancela o login em andamento, se houver.
function cancelarLogin() {
  if (loginAtual) {
    loginAtual.close();
    loginAtual.closeAllConnections();
  }
}

const TEMPO_LIMITE = 15000;

// fetch com tempo limite, para uma resposta que nunca chega não travar o app.
async function buscar(url, opcoes = {}) {
  try {
    return await fetch(url, { ...opcoes, signal: AbortSignal.timeout(TEMPO_LIMITE) });
  } catch (e) {
    throw new Error(e.name === "TimeoutError"
      ? "O Spotify demorou demais para responder. Tente de novo."
      : "Não foi possível falar com o Spotify. Confira a sua conexão.");
  }
}

async function pedirToken(params) {
  const resp = await buscar(CONTAS + "/api/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params),
  });
  const dados = await resp.json().catch(() => ({}));
  if (!resp.ok || !dados.access_token) {
    const e = new Error(
      dados.error === "invalid_client" ? "Client ID do Spotify inválido."
      : dados.error === "invalid_grant" ? "A conexão com o Spotify expirou. Conecte de novo em Configurações."
      : `O Spotify recusou o login (${dados.error_description || dados.error || resp.status}).`);
    e.codigo = dados.error;
    throw e;
  }
  return {
    access: dados.access_token,
    refresh: dados.refresh_token || null,
    expira: Date.now() + (Number(dados.expires_in) || 3600) * 1000,
  };
}

async function login(clientId, abrirNavegador) {
  const { codigo, verificador } = await esperarCodigo(clientId, abrirNavegador);
  return pedirToken({
    grant_type: "authorization_code",
    code: codigo,
    redirect_uri: REDIRECT,
    client_id: clientId,
    code_verifier: verificador,
  });
}

function renovar(clientId, refresh) {
  return pedirToken({ grant_type: "refresh_token", refresh_token: refresh, client_id: clientId });
}

async function chamar(token, caminho) {
  const resp = await buscar(API + caminho, { headers: { Authorization: "Bearer " + token } });
  if (resp.status === 403) {
    throw new Error("O Spotify recusou o acesso. A conta precisa estar na lista de usuários do app (User Management) no painel de desenvolvedor.");
  }
  if (!resp.ok) {
    const e = new Error(resp.status === 429 ? "O Spotify pediu para ir mais devagar." : `Erro ${resp.status} ao falar com o Spotify.`);
    e.codigo = resp.status;
    throw e;
  }
  return resp.json();
}

async function perfil(token) {
  const eu = await chamar(token, "/me");
  return eu.display_name || eu.id || "";
}

// time_range: short_term (~4 semanas), medium_term (~6 meses) ou long_term (~1 ano).
async function topArtistas(token, timeRange) {
  const dados = await chamar(token, `/me/top/artists?limit=50&time_range=${timeRange}`);
  return (dados.items || []).map((a) => ({ nome: a.name, generos: a.genres || [] }));
}

// Procura o artista pelo nome exato. Devolve o link direto, a foto e os gêneros, ou null.
async function buscarArtista(token, nome) {
  const dados = await chamar(token, "/search?type=artist&limit=5&q=" + encodeURIComponent(nome));
  const alvo = nome.trim().toLowerCase();
  const a = (dados.artists?.items || []).find((x) => x?.name?.trim().toLowerCase() === alvo);
  if (!a) return null;
  return {
    id: a.id,
    link: a.external_urls?.spotify || null,
    img: a.images?.[1]?.url || a.images?.[0]?.url || null,
    generos: a.genres || [],
  };
}

// Top músicas do artista no Spotify
async function topFaixas(token, artistId, mercado = "BR") {
  if (!artistId) return [];
  try {
    const dados = await chamar(token, `/artists/${artistId}/top-tracks?market=${mercado}`);
    return (dados.tracks || []).slice(0, 3).map((t) => ({
      id: t.id,
      titulo: t.name,
      preview: t.preview_url || null,
      link: t.external_urls?.spotify || null,
      duracao: Math.round(t.duration_ms / 1000),
    }));
  } catch {
    return [];
  }
}

module.exports = { REDIRECT, login, cancelarLogin, renovar, perfil, topArtistas, buscarArtista, topFaixas };
