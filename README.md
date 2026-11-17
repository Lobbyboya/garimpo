# Garimpo

App de desktop (Electron) que garimpa artistas novos a partir do que você já ouve.
Cada pessoa usa as próprias contas; nada sai do seu computador além das consultas às APIs.

![Aba Para você do Garimpo, com cartões de artistas recomendados](docs/para-voce.png)

## De onde vem o seu gosto musical

Use pelo menos uma das três fontes, em **Configurações**:

- **Spotify**: você entra com a sua conta e o app lê os seus top artistas (permissão `user-top-read`).
- **Last.fm** (opcional): usuário e chave de API. O app tem um guia passo a passo que abre o site
  certo e explica o que preencher.
- **Lista manual** (opcional): digite alguns artistas de que você gosta.

Os artistas parecidos vêm do Last.fm quando há chave configurada. Sem chave, vêm dos
"artistas relacionados" do Deezer, que é público e não precisa de conta. As fotos vêm do Deezer.

### Regras do Spotify que você precisa conhecer

O login do Spotify exige um **Client ID**, registrado no painel de desenvolvedor do Spotify.
Desde 2026 o Spotify impõe, para apps em modo de desenvolvimento:

- quem registra o Client ID precisa ter **Spotify Premium**;
- cada Client ID aceita até **5 contas**, cadastradas em "User Management" no painel.

Por isso o app não traz um Client ID embutido: cada pessoa cria o seu (o guia dentro do app
explica), ou usa o de um amigo que a tenha adicionado. Quem não tem Premium ainda pode usar o
app com o Last.fm ou com a lista manual. O endereço de retorno a registrar é
`http://127.0.0.1:48721/callback`.

## Como rodar

Precisa do Node.js. Na primeira vez:

```bash
npm install
```

Para abrir o app:

```bash
npm start
```

## Instalador e ícone

- `npm run instalador`: gera `dist/Garimpo Setup 1.0.0.exe`, que instala o app e cria atalhos na
  Área de Trabalho e no menu Iniciar. O instalador não é assinado, então o Windows pode mostrar
  um aviso do SmartScreen.
- `npm run icone`: regenera `build/icon.png` e `build/icon.ico` a partir de `build/icon.svg`.
- `build/identidade-visual.html`: ícone, cores e tipografia do app.

## Como a recomendação é calculada

1. Cada artista que você ouve vira uma "semente" com peso de 0 a 1: no Last.fm, scrobbles ÷
   scrobbles do seu artista mais ouvido; no Spotify, a posição no ranking (ele não informa
   contagens); na lista manual, 0,8.
2. O app busca os parecidos das N sementes mais fortes.
3. Cada parecido soma `similaridade × peso da semente`. Quem você já ouve fica de fora.

## Curadoria dinâmica

A aba "Curadoria" organiza as recomendações pelos seus grupos de gosto. Nada é fixo:

- Os grupos saem dos gêneros dos artistas que você mais ouve (gêneros do Spotify; quando faltam,
  tags do Last.fm). O app pega o gênero que mais pesa entre os seus artistas, junta quem o tem e
  repete, até 5 grupos. O resto vai para "Outros".
- Cada recomendação entra no grupo do artista seu que mais a puxou e mostra o próprio gênero.
- Com o Spotify conectado, o link abre direto a página do artista. Sem ele, abre a busca.
- Ao abrir o app, se o último resultado tem mais de um dia, tudo é refeito sozinho. Assim os
  grupos e as recomendações acompanham o que você anda ouvindo.

## Salvos

Toque no marcador de um cartão para guardar o artista na aba **Salvos**. As recomendações mudam
conforme o que você ouve; os salvos não. Cada um mostra quando foi salvo, de qual artista seu
veio e se ainda aparece nas recomendações, e pode ser marcado como "Já ouvi".

## Estatísticas de uso (opcionais)

Na primeira abertura o app pergunta se a pessoa quer enviar estatísticas anônimas; a escolha pode
ser trocada em Configurações, onde também há "Apagar o que já foi enviado". Vai só o tipo de uso
(abrir o app, garimpar, salvar, prévias, abas), fontes ligadas, versão, sistema e um código
aleatório da instalação. Nunca nomes, e-mails, contas, chaves ou nomes de artistas.

Para receber as estatísticas (administrador):

1. Crie um projeto no [Supabase](https://supabase.com) e rode `supabase/telemetria.sql` no SQL Editor.
2. Em Project Settings > API, copie a URL do projeto e a chave **publishable** (ou a "anon").
   Nunca use a `secret`/`service_role`.
3. Cole as duas em `SUPABASE_URL` e `SUPABASE_CHAVE`, no topo de `src/telemetria.js`, e gere uma
   nova versão. Sem elas a opção nem aparece no app.
4. Veja os números no SQL Editor, por exemplo `select * from estatisticas.ativos_por_dia;`. Também
   há `ativos_por_semana`, `recursos_30_dias`, `fontes_e_motor`, `versoes` e `retencao`.

Para testar sem gerar versão: `GARIMPO_SUPABASE_URL=... GARIMPO_SUPABASE_CHAVE=... npm start`.

## Onde ficam os seus dados

Em `%APPDATA%\garimpo\` no Windows ou `~/.config/garimpo/` no Linux: `config.json` (usuário e
chave do Last.fm, Client ID e login do Spotify, lista manual), `cache.json` (último resultado) e
`salvos.json` (artistas salvos) e `telemetria.json` (sua escolha sobre estatísticas e a fila de envio). Os tokens do Spotify são guardados cifrados pelo sistema.
Nada disso fica na pasta do projeto.

## Estrutura

- `src/main.js`: janela, configuração, cache e IPC.
- `src/recomendar.js`: junta as fontes, calcula as recomendações e monta os grupos de gosto.
- `src/spotify.js`: login (PKCE), top artistas e busca de artistas no Spotify.
- `src/lastfm.js`: top artistas, similares e tags do Last.fm.
- `src/deezer.js`: fotos e artistas relacionados.
- `src/preload.js`: ponte segura entre a interface e o processo principal.
- `src/renderer/`: interface (HTML, CSS, JS).

## Limitações conhecidas

- A busca de artistas e os gêneros do Spotify ainda não foram testados com uma conta real.
- Sem Spotify e sem chave do Last.fm não há gêneros, então a Curadoria fica sem grupos.
- "Longo prazo" no Last.fm é o histórico inteiro, inclusive o que você ouvia anos atrás.

## Licença

[MIT](LICENSE)
