# roteiro futuro

Ideias que a Lívia pediu para registrar, mas que não entram no código agora. Quem
pegar uma dessas para executar começa lendo o item inteiro antes de tocar em
qualquer arquivo — o "por quê" importa tanto quanto o "o quê".

## integração de dados com o sistema da fábrica

Registrado em 2026-10-14, a partir de uma conversa sobre pontualidade da entrega.

**O que existe hoje:** a data e a hora previstas de chegada de uma viagem são
digitadas uma a uma na tela de Registrar, ou importadas em lote por um CSV (menu
"Mais ações" → "Importar pontualidade da entrega", em
`apps/web/src/telas/registrar.tsx`). O CSV é a ponte enquanto não existe outra.

**O que a Lívia quer no futuro:** integração direta entre este sistema e o sistema
interno da fábrica (o que hoje planeja as entregas e provavelmente já tem a data
prevista de cada pedido). Em vez de alguém exportar uma planilha do sistema da
fábrica e importar aqui, os dois sistemas trocariam essa informação sozinhos.

**Por que não entra agora:** a Lívia descreveu isto como "teórico" e "no futuro" —
não há ainda clareza sobre qual é o sistema da fábrica, se ele tem API, qual
formato de dado ele expõe, nem se o projeto tem acesso de rede até lá. É uma
integração nova (`packages/db/src/consultas/integracoes.ts` e
`apps/web/src/telas/integracoes.tsx` já existem para esse tipo de coisa — API
externa com token, formato próprio — e seriam o ponto de partida natural).

**Antes de começar, perguntar à Lívia:**
- Qual é o sistema da fábrica (nome, se é um ERP, ONVIO, SAP, planilha
  compartilhada, etc.) e se ele expõe algum jeito de ler dados de fora (API, export
  automático, banco acessível).
- Que dado exatamente ele tem sobre entrega planejada — só a data, ou também
  placa/motorista/rota para casar com a viagem certa.
- Se a integração deve ler de lá para cá (o caminho que resolve a pontualidade da
  entrega) ou também escrever daqui para lá.

**Como isto se conecta ao que já existe:** a viagem já guarda `data_prevista` e
`hora_prevista` como colunas próprias (`packages/db/src/schema/registro.ts`), a
causa raiz do atraso em dias que motivou tudo isto — ver `atrasoDaEntregaDe` em
`registrar.tsx`. Uma integração futura só precisaria preencher essas duas colunas
pelo mesmo caminho que o CSV usa hoje (`PUT /registros/:id`), trocando "pessoa lê
o CSV e importa" por "sistema escreve direto".
