# Revisão da interface de operação

A revisão usa craft-design-engineering, make-interfaces-feel-better, emil-design-eng, motion-dev-animations, review-animations, improve-animations e apple-design.

## Mudanças na interface

- Menus recebem foco ao abrir. Setas, Home e End percorrem opções. Escape fecha e devolve o foco. Tab segue para o próximo controle.
- Abas usam um único ponto de entrada no Tab e trocam com as setas, Home e End.
- Buscas têm nome acessível. Janelas têm título e descrição associados para leitores de tela.
- Campos numéricos aceitam decimais no navegador. Valores em dinheiro e números pedem teclado decimal no celular. As regras de validação da operação permanecem no envio.
- Erros ficam visíveis até a pessoa dispensá-los. Confirmações de sucesso permanecem por quatro segundos. Cada aviso tem botão para fechar.
- Com uma janela aberta, o aviso aparece junto às ações, fora do conteúdo rolável. Em janelas sobrepostas, somente a janela superior mostra os avisos.
- Os controles de toque têm altura mínima de 44 px. Abas e botões de ícone também têm largura mínima de 44 px. As entradas usam fonte de 16 px no celular.
- Menus da faixa superior respeitam a largura disponível no celular. Avisos quebram textos longos e não ultrapassam a janela.
- Nas atas, clicar no nome do participante marca a caixa. O nome também identifica a caixa para o leitor de tela.
- Visão geral, Viagens, Rotas e Frota distinguem carregamento inicial, falha de consulta e resultado vazio. Uma falha tem botão para tentar novamente. Se já houve consulta, os dados anteriores ficam visíveis com aviso de que não foram atualizados.
- Falha ao abrir uma tela preserva a navegação e oferece recarregar o aplicativo. Isso cobre a aba aberta que tenta buscar um arquivo da versão anterior após uma publicação.
- A troca frequente de telas é instantânea. Janelas usam entrada de 200 ms, avisos e prévias usam 150 ms, com a mesma curva de saída rápida. O pressionamento responde imediatamente e a soltura dura até 160 ms. Movimento reduzido remove deslocamentos e preserva uma entrada por opacidade.

## Verificação

O comando completo passou com 453 testes, nenhum erro, build, tipos, fronteiras e conferência dos arquivos públicos. O ícone compartilhado do login recebeu nome estável e liberação explícita, exigida pela conferência do build.

No navegador local, conferi menus com End, Escape e Tab, abas com ArrowRight, atributos dos campos decimais, janela de cadastro a 390 px, alerta persistente e sua dispensa. Simulei uma falha de consulta inicial e recuperei a tela com Tentar novamente. Removi temporariamente um arquivo gerado de Frota para reproduzir a falha de abertura. A mensagem e a navegação permaneceram visíveis; restaurei o arquivo e o botão de recarregar recuperou a tela.

As preferências de movimento reduzido foram conferidas nas regras CSS. Não houve teste em um aparelho físico. As simulações de falha ocorreram no ambiente local, sem escrever na produção.

## Critérios de movimento

| Antes | Depois | Motivo |
| --- | --- | --- |
| Transição em toda navegação | Troca instantânea | A navegação é frequente. [Hover restraint](https://craft.gustavofior.com/hover-restraint) aplica o mesmo critério de frequência. |
| Entradas com ease | Curva compartilhada de saída rápida | A resposta aparece logo no início da interação. |
| Movimento mesmo com preferência reduzida no pressionamento | Sem transform e com confirmação por opacidade | Preserva feedback sem deslocamento. |

A skill motion-dev-animations recomenda evitar uma biblioteca de movimento em formulários CRUD. Estas mudanças usam CSS e não adicionam uma dependência.
