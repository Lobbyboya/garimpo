// Estado da interface e ações compartilhadas entre os módulos.

export const estado = {
  aba: "voce",
  config: { usuario: "", temChave: false, spotifyConectado: false, spotifyNome: "", spotifyClientId: "", manual: [] },
  grupoAtivo: null,
  auto: null, // último resultado gerado (cache ou recém-gerado)
  salvos: [], // artistas guardados para ouvir depois (salvos.json)
  filtroSalvos: "todos", // todos | pendentes | ouvidos
  conectandoSpotify: false, // login do Spotify em andamento no navegador
  dispensados: [], // "Não curti" (dispensados.json)
  filtroVoce: "todos", // todos | novos | pouco-conhecidos
};

// Até quantos fãs no Deezer o artista conta como "pouco conhecido" (garimpo profundo).
export const POUCO_CONHECIDO = 50_000;

// Ações que vários módulos precisam disparar. São preenchidas pelo app.js ao iniciar, para
// os módulos não dependerem uns dos outros em círculo (cartão -> salvar -> redesenhar -> cartão).
export const acoes = {
  render: () => {},
  gerar: () => {},
  abrirConfig: () => {},
};

export const PERIODOS = { longo: "longo prazo", medio: "últimos 6 meses", curto: "último mês" };

export const temLastfm = () => estado.config.temChave && Boolean(estado.config.usuario);

export function temFonte() {
  const c = estado.config;
  return c.spotifyConectado || temLastfm() || c.manual.length > 0;
}
