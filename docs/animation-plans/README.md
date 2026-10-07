# Revisão de movimento

Base da revisão, commit 647be48. As mudanças foram autorizadas para implementação e publicação.

| Plano | Problema | Gravidade | Estado |
| --- | --- | --- | --- |
| 001 | Transição em toda troca de tela de operação | Média | Implementado |
| 002 | Curvas lentas no começo de janelas e avisos | Baixa | Implementado |
| 003 | Movimento no pressionamento com movimento reduzido | Média | Implementado |

A ordem de execução é 001, 002 e 003. Não há dependências externas.

## 001. Tornar a navegação instantânea

Em `apps/web/src/app/navegacao.tsx`, `trocar` usava `startViewTransition` em toda navegação. Em `geist.css`, `g-painel-entra` e `g-painel-sai` animavam posição e opacidade por 150 ms. Uma operação frequente não precisa esperar essa troca.

Remover a captura e as regras exclusivas da transição. Preservar History API, links, filtros e retorno ao topo. Não adicionar dependências. Verificar navegação por clique, teclado e voltar do navegador, sem imagens sobrepostas.

## 002. Acelerar a resposta visual das janelas

Em `apps/web/src/geist/geist.css`, janela, aviso e prévia usavam `ease` com 120 ou 150 ms. Usar o token `--g-ease-out: cubic-bezier(0.23, 1, 0.32, 1)`, com janela de 200 ms e avisos e prévia de 150 ms. Preservar deslocamentos de 4 e 8 px e o estado final sem transform na janela, necessário para as prévias fixas.

Não adicionar animação a listas, filtros ou menus usados repetidamente. Confirmar abertura e fechamento repetidos, sem bloquear interação, e estado final `transform: none`. Os keyframes ficam restritos à entrada montada, sem animar dimensões.

## 003. Reduzir movimento sem remover feedback

O botão tinha `scale(.97)` mesmo com movimento reduzido. Janelas e avisos removiam todo feedback de entrada. Em `geist.css`, sob `prefers-reduced-motion: reduce`, remover transform do pressionamento e usar somente opacidade em 150 ms na janela, aviso e prévia.

Verificar que não há deslocamento com a preferência ativa, que o foco segue visível e que o carregamento continua identificável. Build e tipos devem passar. As verificações completas usam `bun --env-file=.env.test.local run verificar`, nunca o banco de produção.
