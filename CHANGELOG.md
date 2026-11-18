# Changelog

Todas as mudanças importantes do Garimpo. O formato segue o [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/)
e as versões seguem o [Versionamento Semântico](https://semver.org/lang/pt-BR/): `MAJOR.MINOR.PATCH`.

Ao publicar uma versão, o texto da seção dela vira as notas da release no GitHub.

## [Não lançado]

### Novidades
- Tela de boas-vindas: diga 3 artistas de que você gosta e receba recomendações na hora, sem conta.
- Last.fm só com o nome de usuário, quando o app vem com a chave de API embutida.
- Selo **Novo** nos artistas nunca recomendados antes, e filtro **Pouco conhecidos** (menos de
  50 mil fãs no Deezer) para garimpar fundo.
- Botão **Não curti**: o artista sai das recomendações de vez, com "Desfazer" e lista para restaurar.
- **Ouvir em sequência**: uma prévia de 30 segundos de cada artista da lista, uma depois da outra.
- Barra de progresso e cartões de carregamento no Garimpar, e notificação quando termina em segundo plano.
- Atalhos de teclado: `/` busca, `1`–`3` abas, `Espaço` pausa, `N` próximo, `Esc` limpa a busca.
- Atualização automática no Windows e no AppImage ("Reiniciar e atualizar").
- Pacote para o AUR (Arch Linux).

### Correções
- A Curadoria agora tem grupos também quando você usa só a lista de artistas.

### Por dentro
- 41 testes automáticos rodando no GitHub a cada envio; a release só sai se passarem.
- README em inglês e capturas de tela atualizadas.

## [1.3.0] - 2026-11-17

### Novidades
- Aparência: modo Sistema, Claro ou Escuro, e temas de cores (Garimpo, Tokyo Night, Dracula,
  Catppuccin, Nord, Gruvbox, Solarized, Rosé Pine e One Dark/Light), todos com versão clara e escura.
- Instalador para Linux (AppImage), além do de Windows.

### Correções
- As chaves e logins não se perdem mais: a configuração é gravada de forma segura, com cópia de
  segurança, e o login do Spotify não é apagado quando o chaveiro do sistema está bloqueado.
- Só uma janela do Garimpo abre por vez (duas cópias gravando a mesma configuração causavam perdas).
- Sem internet, o Garimpar avisa e mantém as recomendações anteriores, em vez de apagá-las.
- Artistas com o mesmo nome (como "Air") agora encontram o artista certo no Deezer.
- Arquivos arrastados para a janela não são mais abertos dentro do app.
- Mensagens de erro mais claras sem conexão.

### Por dentro
- Código reorganizado em camadas (`main`, `recomendacao`, `dados`, `servicos`, `comum`) e interface
  dividida em módulos.

## [1.2.0] - 2026-11-17

### Novidades
- Interface nova, com barra lateral, tons quentes e títulos com serifa.
- Aba **Salvos**: guarde artistas para ouvir depois, marque como "Já ouvi" e veja se ainda aparecem
  nas recomendações.
- Prévias de 30 segundos das músicas mais tocadas de cada artista (Deezer).
- Aviso de versão nova, com verificação manual em Configurações.
- Estatísticas de uso anônimas e opcionais, com opção de apagar o que já foi enviado.

### Correções
- Login do Spotify pode ser cancelado, e as chamadas de rede têm tempo limite.

## [1.0.0] - 2026-11-13

### Novidades
- Primeira versão: recomendações de artistas a partir do Spotify, do Last.fm ou de uma lista
  manual, com a aba Curadoria organizada pelos seus grupos de gosto.
- Instalador para Windows.

[1.3.0]: https://github.com/Lobbyboya/garimpo/compare/v1.2.0...v1.3.0
[1.2.0]: https://github.com/Lobbyboya/garimpo/compare/v1.0.0...v1.2.0
[1.0.0]: https://github.com/Lobbyboya/garimpo/releases/tag/v1.0.0
