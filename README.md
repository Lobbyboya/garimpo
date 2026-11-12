# Recomendador de bandas

App de desktop (Electron) que sugere bandas e artistas novos com base nos seus top artistas
do Last.fm.

## Como rodar

Precisa do Node.js instalado. Na primeira vez, dentro desta pasta:

```bash
npm install
```

Depois, para abrir o app:

```bash
npm start
```

Na primeira abertura o app pede o seu **usuário do Last.fm** e a **chave de API**. A chave é grátis e você cria em
https://www.last.fm/api/account/create. A chave fica salva só neste PC, em
`%APPDATA%\recomendador-de-bandas\config.json`, fora da pasta do projeto.

## Instalador e ícone

- `npm run instalador`: gera `dist/Recomendador de bandas Setup 1.0.0.exe`. Ele instala o app em
  `%LOCALAPPDATA%\Programs\recomendador-de-bandas` e cria atalhos na Área de Trabalho e no menu Iniciar.
  O instalador não é assinado, então o Windows pode mostrar um aviso do SmartScreen em outros PCs.
- `npm run icone`: regenera `build/icon.png` e `build/icon.ico` a partir de `build/icon.svg`.
- `build/identidade-visual.html`: ícone, cores e tipografia do app.
- Depois de mudar o código, rode `npm run instalador` e instale de novo para atualizar o app instalado.

## Como funciona

- **Aba "Do Last.fm"**: lê seus top artistas (`user.getTopArtists`) no período escolhido e
  busca os similares (`artist.getSimilar`) dos N primeiros. Cada similar ganha pontos:
  `match × (scrobbles da semente ÷ scrobbles do seu artista nº 1)`, somados entre as
  sementes. Artistas que já estão no seu top 500 são removidos. As fotos vêm da busca
  pública do Deezer (a API do Last.fm não devolve mais fotos de artistas); quem não tem
  foto com nome idêntico lá aparece com a inicial do nome. O último resultado fica em
  cache (`%APPDATA%\recomendador-de-bandas\cache.json`) e aparece ao abrir o app.
- **Aba "Curadas"**: a lista escrita à mão, em `src/dados.json`, com links diretos e fotos
  do Spotify.

## Estrutura

- `src/main.js`: janela, configuração, cache e IPC.
- `src/lastfm.js`: chamadas ao Last.fm e cálculo das recomendações.
- `src/preload.js`: ponte segura entre a interface e o processo principal.
- `src/renderer/`: interface (HTML, CSS, JS).
- `src/dados.json`: grupos de gosto (`clusters`) e recomendações curadas (`recs`).
- `recomendador.html`: versão antiga em página única, sem o Last.fm ao vivo. Pode ser apagada.

## Grupos de gosto usados no recomendador

- Jazz e hip hop instrumental (Nujabes, Casiopea, Tsutchie, Jazz Liberatorz, Uyama Hiroto, Yussef Dayes, Jazzbois)
- Rock pesado e metal (Turnstile, Deftones, Linkin Park, Korn, Trivium, Pantera, Alice in Chains, Metallica)
- Trap e rap latino/brasileiro (Matuê, Ca7riel & Paco Amoroso, Nitsua, LJONES)
- Hip hop clássico e alternativo (The Pharcyde, Pete Rock, Tyler, The Creator)

## Limitações conhecidas

- O Spotify não foi lido: as ferramentas de busca só devolveram playlists geradas pela plataforma, não os top artistas da conta. Cruzar com os dados do Spotify é um próximo passo.
- As recomendações (`recs` em `src/dados.json`) foram escritas a partir de conhecimento geral, não de um algoritmo de similaridade.
- Em 12/11/2026 todas as 26 recomendações foram conferidas no catálogo do Spotify. Cada uma tem o ID do artista (`spotify`) e a foto (`img`), e o link abre direto `open.spotify.com/artist/<id>`. Sem `spotify`, o card volta a usar a busca pelo nome.
- Bad Omens, Vince Staples e Digable Planets aparecem no Spotify como não tocáveis nesta conta (restrição de licença, `restrito: true`). O card mostra um aviso.
- Alguns nomes têm perfis duplicados no Spotify (Tomppabeats, Spiritbox, Glassjaw, Filipe Ret, Trueno, A Tribe Called Quest, Vince Staples, Unknown Mortal Orchestra). Foi usado o perfil principal, o que tem foto de artista.

## Ideias para a próxima etapa

- Ler os top artistas do Spotify e recalcular os grupos com os dois perfis.
- Trocar os links de busca do Spotify das recomendações automáticas por links diretos.
