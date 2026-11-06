# Royal Óbidos Marshall

Aplicação web para consultar tempos e acompanhar o ritmo de jogo, com saídas do T1, T10 e Shotgun.

## Instalar no telemóvel

Abre a app por HTTPS e escolhe **☰ → Instalar app**.

- **Android:** confirma a instalação no Chrome. Se o pedido automático não aparecer, abre o menu **⋮ → Instalar app / Adicionar ao ecrã principal**.
- **iPhone:** abre no Safari e escolhe **Partilhar → Adicionar ao ecrã principal → Adicionar**.

A instalação cria um ícone Marshall e abre a app numa janela própria. Não é necessário instalar um APK nem publicar nas lojas.

## Utilização sem internet e atualizações

- A primeira visita precisa de internet para guardar os ficheiros no dispositivo. Aguarda que a página termine de carregar antes de testar sem rede.
- Depois, os cálculos, as imagens e os modos de saída funcionam offline. Se a fonte externa não estiver disponível, é usada a fonte alternativa do dispositivo.
- Quando houver uma atualização, a app apresenta **Atualizar agora**. Uma consulta em curso não é recarregada automaticamente.
- Atualizar ou fechar a app reinicia a consulta atual, tal como recarregar a página.
- Os dados/cache pertencem ao endereço usado na instalação. Uma pré-visualização do Netlify é uma instalação diferente do site principal; utiliza o endereço principal para a instalação definitiva.
- Limpar os dados do navegador ou do sistema pode remover a cópia offline. Nesse caso, volta a abrir com internet.

## Desenvolvimento

Site estático, sem dependências de compilação. Para testar localmente:

```sh
python -m http.server 8000
```

Abre `http://localhost:8000`. Service workers precisam de HTTPS ou localhost.

- `manifest.webmanifest`: identidade e apresentação da app instalada.
- `pwa.js` / `pwa.css`: instalação, instruções para iPhone, estado offline e atualização.
- `sw.js`: guarda apenas os ficheiros públicos conhecidos da app; pedidos externos não são guardados.
- `_headers`: evita que o navegador deixe de procurar atualizações no Netlify.
- `icons/`: ícones derivados do favicon existente, incluindo um ícone maskable e o ícone Apple.

**Ao alterar qualquer ficheiro da app, incrementa `CACHE_NAME` em `sw.js`.** Se adicionares um recurso necessário offline, inclui-o também em `SHELL_PATHS`. Mantém o `id`, o `start_url` e o `scope` do manifesto estáveis para preservar a identidade da instalação.

Antes de integrar uma alteração, verifica os três modos de saída, recarrega sem rede depois da primeira visita e testa a instalação/atualização. As branches com Pull Request podem ser revistas num Deploy Preview do Netlify antes da integração na `main`.
