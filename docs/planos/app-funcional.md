# de 7 HTMLs para um app com banco

Plano de várias etapas. Escrito em 2026-08-31 e revisado no mesmo dia contra os
fontes. Quem retomar isto começa pela seção "por onde começar".

> **Leia `arquitetura.md` junto com este arquivo.** Ele veio depois, do painel de
> arquitetura de 2026-08-31, e corrige seis pontos do schema aqui embaixo mais os
> três valores que estavam em aberto. Onde os dois divergirem, o `arquitetura.md`
> ganha. A tabela no fim deste arquivo diz em que fase a execução está.

## objetivo

A equipe de expedição lança viagem, abastecimento, manutenção e quebra numa tela que
grava num banco de verdade, e a Lívia abre o dashboard de qualquer máquina e vê o
mesmo número. Hoje cada navegador guarda a sua própria cópia e ninguém enxerga o dado
do outro.

## o que existe hoje

7 arquivos HTML soltos, 5.236 linhas, publicados como site estático no Netlify. Cada
um é autossuficiente, com o CSS e o JS inline. Sem build, sem dependência, sem
servidor. A única biblioteca externa do parque inteiro é o Chart.js 4.4.0 no
dashboard.

| arquivo | linhas | JS inline | onde guarda |
|---|---|---|---|
| formulario-registro.html | 1360 | 744 | `emvidros_indicadores`, `emvidros_sessao`, `emvidros_usuarios_config` |
| ata-reuniao.html | 838 | 434 | `emvidros_atas` |
| documentos-frota.html | 726 | 524 | `emvidros_documentos` |
| manutencao-frota.html | 713 | 441 | `emvidros_indicadores`, `emvidros_preventiva` |
| integracao-frota.html | 695 | 461 | `emvidros_integracoes` |
| dashboard-semanal.html | 698 | 416 | lê `emvidros_indicadores` |
| GUIA-CONFIGURACAO.html | 206 | 0 | nada |

São sete chaves de localStorage no total. Só `emvidros_indicadores` é compartilhada
entre telas; as outras seis são silos.

### os quatro problemas que motivam a migração

**O dado não sai do navegador.** As sete chaves são por máquina. Quem lança em
Imperatriz não vê o que Raposa lançou, e a Lívia só vê o que foi digitado no
computador dela.

**A sincronização que a tela anuncia não existe.** O formulário faz POST em
`https://script.google.com/macros/s/AKfycbw.../exec` com `mode: 'no-cors'`. Testei o
endpoint em 2026-08-31 e ele responde 404, título "Página não encontrada". Como
`no-cors` devolve resposta opaca e 404 não lança exceção de rede, o código marca
`syncOk = true` e a linha 962 escreve "Registrado e sincronizado com a planilha!".
Nada foi gravado. O dashboard tenta ler o mesmo endpoint por GET, cai no `catch` e
rotula o estado como "Dados locais (sem conexão)", que é errado por outro motivo:
há conexão, e há resposta. O que não há é endpoint.

**O login é decorativo, e cobre uma tela de sete.** Os 4 usuários estão no HTML
servido ao navegador, com a senha em base64 e um `atob()` ao lado. Só
`formulario-registro.html` tem o overlay. Dashboard, documentos, manutenção,
integração e ata não pedem nada. Os 11 MB de PDF em `docs/` (7 apólices somando 3,9
MB, 7 tacógrafos, 4 manuais somando 6,2 MB, o PGQ) são baixáveis por quem tiver o
endereço.

**O mesmo dado existe em formatos que não conversam.** Os arrays literais de placa
estão em três arquivos: `formulario-registro.html:1031`, `documentos-frota.html:228`
e `manutencao-frota.html:277`. A lista de pessoas está em quatro, e em três formatos
diferentes. `VEICULOS_INFO` tem 15 entradas num arquivo e 7 no outro. Trocar uma
placa hoje significa editar três arquivos e torcer.

### o que fica de fora

O webhook n8n `registro-indicadores` está declarado no formulário na linha 618 e
nunca é chamado. Os dois workflows JSON não rodam. O de registro grava em abas
`VIAGENS` / `ABASTECIMENTO` / `MANUTENÇÕES` / `QUEBRAS`, o de resumo semanal lê
`Viagens` / `Abastecimentos` / `Manutencoes` / `Quebras`, nomes que não batem, e o
segundo ainda está com `COLE_AQUI_O_ID_DA_PLANILHA`. O app novo substitui os dois.
Os arquivos saem do repositório na fase 5, junto com o guia.

## a restrição que manda no desenho

**O visual não muda.** Decisão da Lívia, registrada em 2026-08-31. O layout que ela
desenhou continua igual em todas as telas. Isso descarta reescrever em React com
shadcn, e descarta trocar o CSS por Tailwind nas telas que já existem.

Três fatos do código sustentam a escolha:

1. São 106 handlers `onclick=` inline no markup. Cada um vira uma prop se o markup
   virar JSX. É o trabalho mais caro e mais arriscado da conversão, e não entrega nada
   para quem usa a tela.
2. Não há framework para desmontar. É JS vanilla, e um `<script>` clássico inline
   continua funcionando dentro de um build do Vite sem tocar numa linha.
3. Os blocos `<style>` são autossuficientes. Copiar o arquivo inteiro para dentro do
   build preserva o visual por construção, não por revisão manual.

O front continua sendo os mesmos 7 HTMLs, servidos pelo Vite em modo multipágina, com
cada `.html` como ponto de entrada. Tailwind e Motion entram no projeto para tela
nova, não para reescrever tela existente.

Nota para quem executar: o Bun 1.4 tem servidor com import de HTML e bundling
embutido, que faria o mesmo trabalho sem Vite. Segui com Vite porque foi o pedido, e
porque o ecossistema de plugin é maior. A troca é reversível e custa umas 30 linhas.

## a stack

Bun 1.4 (o servidor tem 1.3.14 hoje, `bun upgrade` resolve), Vite 8 em modo MPA,
Hono no servidor, Postgres 17 em container próprio, Drizzle como ORM, better-auth
para sessão, Zod na fronteira, Tailwind 4 e Motion para o que for novo.

Hono é escolha minha, não veio do pedido. Ganha por causa do adapter pronto do
better-auth e do middleware de sessão. `Bun.serve` puro daria conta, com mais código
de cola.

A forma abaixo é a que a fase 0 criou. O porquê de cada pacote existir está no
`arquitetura.md`; o resumo é que cada um tem um segundo consumidor.

```
sistema-indicadoresexp/
├─ apps/
│  ├─ web/               # vite MPA, os 7 html na raiz de src/
│  │  ├─ src/*.html      # intocados no visual
│  │  ├─ src/js/         # o script inline extraído, um módulo por tela (fase 2)
│  │  └─ vite.config.ts  # rollupOptions.input com as 7 entradas
│  └─ server/            # hono, rotas da api, raiz de composição
├─ packages/
│  ├─ core/              # dominio/ puro, portas/, casos/
│  ├─ db/                # schema drizzle, migrations, seed
│  └─ auth/              # better-auth com adapter drizzle
├─ infra/
│  ├─ banco.sh           # postgres 17 em container rootless, idempotente
│  └─ extrair-constantes.ts   # lê os literais dos html para o seed
├─ verificar/
│  ├─ fronteiras.ts      # a cerca de import que faz o hexagonal existir
│  └─ fase-*.sh          # as provas de cada fase
├─ .env.example
└─ docs/planos/{app-funcional,arquitetura}.md
```

## as fases

### fase 0, a base

Só banco e sessão. Nenhuma tela.

Monorepo com workspaces do Bun. Postgres 17 num compose próprio, porta 5433, volume
nomeado, healthcheck. Não uso o `emvidros-postgres` central: misturar banco de projeto
com banco da casa cria dependência que ninguém quer na hora de restaurar backup. O
container a mais não pesa nesta máquina.

Seed com o que hoje está hardcoded no HTML. Nove conjuntos: 3 bases, 15 veículos, 31
colaboradores, 22 linhas de rota, 8 tipos de preventiva, 4 usuários, 4 metas de KPI, 2
programas de integração e as 47 atividades desses programas.

**Prova.** `verificar/fase-0.sh` consulta o banco e confere os nove conjuntos, um
`SELECT count(*)` por tabela, com os números acima escritos no script. Um `curl` no
endpoint de login do better-auth devolve cookie de sessão válido, e o mesmo `curl`
com senha errada devolve 401.

As 47 atividades são o item mais volumoso e o mais sujeito a erro de parsing, então
o script confere os códigos um a um. **Cuidado:** eu tinha escrito aqui que eles vão
de `m1a` a `m6c` sem buraco, e isso está errado. O extrator rodou em 2026-08-31 e a
semana 5 da trilha do motorista tem só `m5a` e `m5b`. Não existe `m5c` no HTML, o que
confirmei por grep em `integracao-frota.html`. São 23 atividades na trilha do
motorista e 24 na do ajudante. A prova compara contra a lista extraída, não contra um
intervalo, senão ela reprova dado correto.

### fase 1, as telas atrás de um login de verdade

Vite MPA com os 7 HTMLs como entradas. Hono serve o build e a API na mesma origem, o
que elimina CORS de vez. O overlay de login hardcoded do `formulario-registro.html`
sai e vira better-auth, com sessão em cookie httpOnly. As 7 páginas passam a exigir
sessão. Hoje seis delas não pedem nada.

As permissões por base e por tipo viram tabela e passam a ser aplicadas no servidor.
Atenção na migração: o objeto `USUARIOS` da linha 625 é só o valor inicial. O IIFE das
linhas 643 a 654 sobrescreve `bases` e `tipos` com o que estiver em
`emvidros_usuarios_config`, gravado por `salvarUsuarios()` na linha 1268. As duas
fontes precisam ser lidas, senão a permissão que o admin editou some.

Os PDFs de `docs/` saem do bundle público e passam a ser servidos por rota
autenticada. Continuam no repositório nesta fase; limpar o histórico do git é assunto
da fase 4.

O JS de dados não muda aqui. As telas continuam lendo e escrevendo em localStorage. É
intencional: quero login e servidor provados antes de mexer na persistência.

**Prova.** `verificar/fase-1.sh` compara o HTML renderizado das 7 telas antes e depois
do build, normalizando duas diferenças esperadas: o bloco de login e os `href` que
apontam para `docs/`. Esses `href` vêm de `DOCS_ESTATICOS`, `MANUAIS_RAPOSA` e
`PLANOS` em `documentos-frota.html` e mudam de caminho nesta fase por decisão, não por
acidente. Qualquer outra diferença reprova. Abrir qualquer URL sem sessão redireciona
para o login. O usuário `andreina` recebe 403 ao tentar lançar registro de Imperatriz,
e a recusa vem do servidor.

### fase 2, o banco vira a fonte de verdade

O localStorage morre como armazenamento e o Apps Script sai do código. Arquivo por
arquivo, o `<script>` inline sai para um módulo TypeScript em `apps/web/src/js/` e as
funções de persistência passam a chamar a API.

A ordem é ditada por quem compartilha chave, não por tamanho. `emvidros_indicadores` é
escrita por `formulario-registro` e por `manutencao-frota` (linha 669, no importador
de CSV), e lida por `manutencao-frota` em cinco pontos e pelo `dashboard-semanal`. As
três telas têm que virar juntas, num commit só, senão existe um intervalo em que uma
grava na API e a outra lê o localStorage, e o dashboard aparece zerado.

1. `integracao-frota`, silo puro
2. `ata-reuniao`, silo puro, mais o upload do PDF assinado
3. `documentos-frota`, upload de PDF, que sai do base64 para o volume
4. `formulario-registro` mais `manutencao-frota` mais `dashboard-semanal`, num commit

Os três primeiros são commits independentes, verificados antes do próximo. O quarto é
o maior e o mais arriscado, e é indivisível.

O JS extraído mantém as funções globais expostas em `window`, porque os 106
`onclick=` do markup dependem disso. Não é elegante, e é o preço direto de não tocar
no visual. Fica registrado como dívida com saída na fase 5.

Os KPIs do dashboard vão para o servidor, com as metas vindas de tabela. Hoje o
navegador baixa todos os registros e agrega em JavaScript, com limiares que divergem
dentro do mesmo arquivo.

**Prova.** Um script por tela migrada, não um só no fim. Para cada uma, o roteiro é o
mesmo: cria o registro por HTTP, apaga a chave correspondente do localStorage,
recarrega e confere que o conteúdo continua lá. Para `documentos-frota` isso inclui
subir um PDF e baixá-lo de volta com o mesmo sha256. Para `manutencao-frota` inclui
importar um CSV de 3 linhas e conferir as 3 na API. O commit 4 só fecha quando uma
viagem lançada numa sessão aparece no dashboard de outra.

### fase 3, apagar a duplicação

As listas de placa, motorista e rota somem dos três arquivos que as repetem e viram
uma chamada à API.

O CSS pede mais cuidado do que eu tinha escrito. Os sete blocos `:root` **não são
iguais**, e eu confirmei isso comparando o hash de cada um. As diferenças reais são
`--yellow` e `--yellow-soft`, que existem em dashboard, documentos e manutenção e não
nos outros; `--txt-side` e suas variantes, ausentes em documentos, integração e ata; e
um `--shadow` mais curto em integração e ata. O `GUIA-CONFIGURACAO.html` usa outro
vocabulário inteiro (`--bg`, `--card`, `--side`, `--txt`, `--dim`) e não tem sidebar.

Então a consolidação é união das variáveis, não escolha de uma delas, e o guia fica de
fora. Fazer a união errada muda cor na tela, que é exatamente o que a restrição
proíbe.

Tailwind entra aqui como camada de utilidade para o que for novo, sem reescrever regra
existente. Motion entra nas trocas de aba e de modal, que hoje são `display:none`
seco.

**Prova.** `verificar/fase-3.sh` roda duas checagens. A primeira compara o CSS
computado de cada elemento das 7 telas contra a fase 2 e falha em qualquer diferença
de cor, espaçamento ou sombra. A segunda confere que nenhum array literal de placa,
motorista ou rota sobrou no front. Essa segunda não pode ser um `grep` por `PTV0006`
solto: a placa continua aparecendo legitimamente nos nomes de arquivo
`docs/apolice-*.pdf` e no campo `placas` dos manuais. O grep é por declaração de
array, não por ocorrência de placa.

### fase 4, publicar e limpar

A importação de dado real saiu do escopo. O Henrique confirmou em 2026-08-31 que só
existe dado local de teste.

Um aviso para quem for avisar a equipe: não existe caminho de reimportação. O
`exportarDados()` da linha 1158 exporta só `emvidros_indicadores`, deixando atas,
documentos, integrações e configuração preventiva de fora, e não há nenhuma função de
importação em nenhum dos sete arquivos. Quem quiser guardar o que digitou copia o
JSON e redigita.

O que sobra nesta fase é a publicação e o passivo de segredo. Cinco itens saem do
código:

1. o ID de deployment do Apps Script `AKfycbwUXXAoZeuvTYm3s9Buj3ocnPH9vNitZ30XBcM696qp0r0wkiUE-Ubsr7uPde0X0l_spA`, repetido em quatro arquivos
2. as 4 senhas em base64 do objeto `USUARIOS`
3. o e-mail `livia.mcc97@gmail.com` no JSON do resumo semanal
4. o IP `170.247.31.241:9002` no formulário e no guia
5. o ID de planilha `1ZS-a8LRf6RL04JAxwfQTeRsPzfll2lNeaVkxnbctaxI`

Os 11 MB de PDF continuam no histórico do git mesmo depois de apagados dos arquivos.
Reescrever histórico é irreversível e passa pelo Henrique.

Onde publica ainda é decisão dele. O padrão da casa para app novo é Cloudflare Workers
com D1, e Postgres em Docker significa servidor próprio, com o Caddy e o Watchtower
que os outros projetos usam. Nenhuma fase anterior depende dessa escolha.

**Prova.** `verificar/fase-4.sh` roda o grep dos cinco itens sobre os arquivos de
código, com este documento excluído da varredura. Ele cita as cinco strings de
propósito, então incluí-lo faria a prova nunca passar. O app responde no domínio final
e o login funciona de fora da rede.

### fase 5, o andaime que sai

Uma coisa nasce condenada nesta migração, e escrevo agora para que não fique para
sempre. As funções globais em `window` que a fase 2 preserva por causa dos `onclick=`
inline saem quando e se o visual for aberto para mudança. Enquanto a restrição valer,
elas ficam, e isso é escolha, não esquecimento.

Saem também o `GUIA-CONFIGURACAO.html` e os dois workflows JSON, que documentam uma
configuração de n8n e Google Sheets que o app novo torna desnecessária.

## o schema

Vale mais detalhar isto do que qualquer outra parte, porque é o que trava se estiver
errado. Uma mudança de formato de dado no começo é uma linha de diff; no fim é
reescrita.

**Cadastro.** `base` (nome, ativo), `veiculo` (placa única, modelo, marca, ano,
base_id, ativo), `colaborador` (nome, cargo, funcao, admissao, base_id, ativo),
`rota` (nome, base_id, local). O campo `local` é o booleano que hoje é a lista
`ROTAS_LOCAIS`, usada para decidir se o toggle de viagem longa aparece.

O campo `intervalo_preventiva` do `VEICULOS_INFO` de `manutencao-frota` fica de fora
de propósito. Ele é redundante com `item_preventivo.intervalo_km`, e o próprio código
de hoje nunca o lê. Descartar, não migrar.

`colaborador` unifica motorista e ajudante, que hoje vivem em quatro arquivos e três
formatos. Contei a união: 17 nomes em `formulario-registro`, os mesmos 17 copiados em
`documentos-frota`, 19 em `integracao-frota` (como objetos com cargo e admissão), 22
em `ata-reuniao`. São 31 pessoas distintas. Adinaldo de Souza de Jesus aparece em
integração e ata, mas não no formulário nem em documentos. Andreina Santos Vilar,
Erika Sousa de Oliveira Reis e Luís Henrique Pereira Diniz só existem na ata. Os 8
motoristas de Imperatriz e o de Belém não aparecem nem na ata nem na integração, o que
parece falha de cadastro e não regra de negócio. Confirmar com a Lívia antes do seed.

**Sessão e permissão.** As tabelas do better-auth (`user`, `session`, `account`,
`verification`) mais duas de junção, `usuario_base` e `usuario_tipo`, que substituem
os arrays `bases[]` e `tipos[]`.

**Registro, quatro tabelas em vez de uma.** Os campos obrigatórios de viagem e de
quebra não têm interseção nenhuma. Uma tabela só com discriminador `tipo` espalharia
`if (tipo === 'viagem')` por todo o código, que é exatamente o que o front faz hoje, e
deixaria estado inválido representável.

- `viagem` (base_id, veiculo_id, motorista_id, rota_id, data_saida, hora_saida,
  data_chegada, hora_prevista, hora_chegada, pontualidade, km_saida, km_chegada,
  valor_carga, combustivel, diarias, m2, peso_kg, observacao, registrado_por,
  registrado_em)
- `abastecimento` (base_id, veiculo_id, rota_id, data, viagem_longa, registrado_por,
  registrado_em) mais `abastecimento_slot` (abastecimento_id, ordem 1 a 3, slot,
  litros, vl_litro, km, posto)
- `manutencao` (base_id, veiculo_id, tipo_manutencao, data_programada, data_entrada,
  hora_entrada, data_saida, hora_saida, servico, valor, km_odometro, fornecedor,
  status_documental, orcamento_arquivo_id, os_arquivo_id, registrado_por,
  registrado_em)
- `quebra` (base_id, data, m2_expedido, m2_quebrado, observacao, registrado_por,
  registrado_em)

Separar `abastecimento_slot` corrige um defeito concreto. Hoje, no modo viagem longa,
o front replica os agregados `total_litros_viagem`, `total_valor_viagem`,
`km_rodados_viagem` e `media_kmL` dentro de cada um dos até 3 itens enviados. Com a
tabela filha, o agregado é uma consulta.

**Campos derivados como coluna gerada do Postgres.** `viagem.km_rodados`,
`viagem.custo_viagem`, `viagem.pct_custo`, `abastecimento_slot.valor_total`,
`manutencao.dias_oficina`, `quebra.pct_quebra`, todos `GENERATED ALWAYS AS ... STORED`.

A justificativa é definição única, não correção de bug. Conferi a duplicação real:
`custo_viagem` é calculado em dois lugares (linhas 783 e 830 do formulário),
`km_rodados` em dois (linha 829 do formulário e o fallback da linha 467 do dashboard),
`valor_total` em dois ramos da mesma função. Os outros três aparecem uma vez só. A
divergência que existe hoje é de limiar de semáforo, não de valor, e quem resolve
aquela é a tabela `meta`.

**Documento e arquivo.** `arquivo` (nome_original, mime, tamanho, caminho, sha256,
enviado_por, enviado_em). `documento` (tipo, vencimento, arquivo_id, link_externo,
atualizado_em) mais os campos específicos por tipo.

Aqui o desenho ingênuo quebra, e vale explicar por quê. A tela de documentos trata
seis coisas como se fossem uma:

- apólice, CRLV e tacógrafo pertencem a **um** veículo
- CNH pertence a **um** colaborador, e carrega `numero` e `categoria` além do
  vencimento, que nenhum outro tipo tem
- manual de fabricante pertence a **vários** veículos (`MANUAIS_RAPOSA` tem um item
  com `placas: 'SM02J13, SMP6F86, SMW0B96, PTV0006'`)
- o plano PGQ pertence a todos os veículos de uma base

Um `CHECK` de "exatamente um dono" proibiria os dois últimos. O desenho que acomoda os
seis é `documento` com o dono opcional mais uma tabela de junção
`documento_veiculo` para os casos de vários. `cnh_numero` e `cnh_categoria` ficam como
colunas nulas em `documento`, porque uma tabela separada para dois campos não se paga.

`link_externo` também é obrigatório. A tela oferece link do Google Drive como
alternativa ao upload, e grava `seguro.link`, `tacografo.link` e `crlv.link` ao lado do
base64.

`politica_documento` (tipo, alerta_dias) tira da mão as janelas que hoje estão fixas
nas chamadas: tacógrafo 30 dias, seguro 60, CRLV 60, CNH 60.

O arquivo vai para volume, não para coluna do banco. O maior PDF de hoje é o
`manual-atego.pdf`, com 1,66 MB. O banco guarda metadado e caminho. Isso substitui o
base64 dentro do localStorage, que hoje tem dois tetos diferentes, 6 MB em
`documentos-frota` e 4 MB em `ata-reuniao`, e um `catch {}` que engole o estouro de
cota sem avisar ninguém. Escolher um teto na migração.

**Preventiva.** `tipo_preventivo` é o catálogo de 8 do front. `item_preventivo`
(veiculo_id, tipo, intervalo_km, alerta_km, ultimo_km, obs) é a configuração por
veículo. Atenção no seed: lavagem alerta em 200 km no catálogo e em 300 na
configuração padrão da Raposa. Escolher um.

**Ata.** `ata` (numero, titulo, data, horario, local, convocada, facilitadores,
participantes_geral, gestor1_nome, gestor1_cargo, gestor2_nome, gestor2_cargo,
pdf_arquivo_id, criada_por, criada_em, importada), com `ata_topico` (ordem, discussao,
conclusao, responsavel, prazo) e `ata_participante` (colaborador_id ou nome_externo,
presente).

Hoje `facilitadores`, `participantes_geral` e os quatro campos de gestor aparecem na
folha impressa e não são salvos, porque `coletarDados()`, na linha 573, simplesmente não
os coleta. Persistir os sete é ganho de graça na migração.

**Integração.** O programa de 6 semanas hoje é literal em JavaScript. Vira
`programa_integracao`, `programa_semana`, `programa_atividade` (com o código `m1a` a
`a6c`) e `programa_criterio`. Com isso, mudar uma atividade deixa de exigir deploy.

A ficha preenchida vira `integracao` (colaborador_id **nulo**, nome_livre, cargo,
admissao, programa_id, inicio, coord, gerente, rh) e `integracao_atividade` (feito,
data). O `colaborador_id` precisa ser nulo porque o select da tela oferece
explicitamente "— Selecione ou preencha manualmente —" nas linhas 199 e 263, e porque `cargo`
e `admissao` são inputs editáveis que podem divergir do cadastro. Uma FK obrigatória
quebraria o fluxo que a tela suporta hoje.

**Metas.** `meta` (chave, valor_meta, valor_alerta) para custo/carga, quebra,
manutenção/produção e atraso.

Cuidado ao semear: custo/carga tem hoje três valores de alerta diferentes no mesmo
sistema. É 9 no card de KPI (linha 394 do dashboard), 10 na tabela de rotas e na de
viagens (linhas 450 e 468), e `meta * 1.3`, ou seja 9,1, no texto do WhatsApp da linha
618 e no nó de código do workflow semanal. Escolher um antes de escrever o seed.

## decisões tomadas, e por quê

Postgres próprio em vez do central, para backup e restauração independentes.

Quatro tabelas de registro em vez de uma, porque os campos obrigatórios não têm
interseção.

Derivado como coluna gerada, para ter uma definição só de cada número.

`documento` com dono opcional mais junção, porque manual e plano pertencem a vários
veículos e um `CHECK` de dono único os proibiria.

Arquivo em volume, porque são PDFs de até 1,7 MB e o localStorage já estoura em
silêncio.

KPI no servidor, porque o mesmo número precisa valer no card, na tabela e no resumo
semanal, e hoje não vale.

Vite multipágina em vez de porte para React, consequência direta da restrição de
visual. Custa a dívida dos globais em `window`, nomeada na fase 5.

## pendências que travam a execução

**A do compose está resolvida, por outro caminho.** O `.claude/settings.json` desta
pasta nega `Bash(docker:*)` e nega escrita em `**/docker-compose*.yml`. Em vez de
usar a brecha do nome `compose.yaml`, que não casa com o glob, a fase 0 subiu o
Postgres 17 num container rootless de `podman`, por `infra/banco.sh`. Não há arquivo
de compose no repositório e não há daemon compartilhado envolvido. O script é
idempotente: rodar de novo com o banco de pé não faz nada.

**Os três valores estão decididos**, e dois deles nem eram conflito. O de custo por
carga ficou em 7 e 9, os do card do dashboard. O da lavagem ficou nos dois, 200 no
catálogo e 300 na configuração da Raposa, porque são níveis diferentes e não valores
concorrentes. O teto de upload ficou em 6 MB. O raciocínio de cada um está no
`arquitetura.md`, na seção "os valores que estavam em aberto".

Ficou uma decisão nova no lugar delas: a tolerância da pontualidade, semeada em 15
minutos e guardada na tabela `meta`, então muda sem publicar versão.

Onde o app publica continua em aberto. Não bloqueia nada até a fase 4.

## por onde começar

A fase 0 inteira, nesta ordem:

1. ~~`bun upgrade`~~ feito. A máquina está em 1.4.0.
2. ~~workspaces~~ feito. `apps/*` e `packages/*`, mais `tsconfig.base.json`.
3. ~~Postgres~~ feito. `./infra/banco.sh` sobe o 17.11 em 127.0.0.1:5433.
4. `packages/db` com o schema acima **corrigido pelo `arquitetura.md`**, na ordem
   cadastro, sessão, registro, documento, preventiva, ata, integração, meta. Gerar a
   migração com `drizzle-kit generate` e commitar o SQL.
5. Seed lendo os literais direto dos HTMLs de origem, para não redigitar. Onde está
   cada coisa:
   - veículos, motoristas e rotas: `formulario-registro.html` 1031 a 1085
   - usuários, com senha e permissão: `formulario-registro.html` 625 a 635, e as
     sobrescritas de `emvidros_usuarios_config` não vão para o seed, são dado de
     runtime
   - modelo, marca e ano dos veículos, mais apólice e tacógrafo:
     `documentos-frota.html`, `VEICULOS_INFO` e `DOCS_ESTATICOS`
   - manuais e plano: `documentos-frota.html`, `MANUAIS_RAPOSA` e `PLANOS`
   - preventiva: `manutencao-frota.html`, `CONFIG_PADRAO_RAPOSA`, `ULTIMO_KM_PGQ` e
     `TIPOS_PREVENTIVA_PADRAO`
   - programas e atividades: `integracao-frota.html`, `COLABORADORES` e `INTEGRACOES`
   - as 3 pessoas que só existem na ata: `ata-reuniao.html`, `COLABORADORES`
   - metas: não há constante nomeada. Os valores estão embutidos nas condicionais do
     `dashboard-semanal.html`, linhas 394, 404, 414 e 431, e nos textos das linhas 186
     a 202. Extrair à mão e conferir contra a decisão de qual alerta usar.
6. `packages/auth` com better-auth sobre o adapter Drizzle.
7. `verificar/fase-0.sh` com as nove contagens, a checagem dos códigos de atividade e o
   teste de login.

Escrever o seed como script que lê os HTMLs é mais trabalho que copiar à mão, e é o
que garante que os 31 nomes e as 15 placas entrem sem erro de digitação. O script
também vira a prova de que o dado do front e o do banco são o mesmo. As metas são a
exceção, porque não há constante para ler.

Metade desse passo 5 já está feita. `infra/extrair-constantes.ts` lê as 28
constantes dos 5 arquivos e escreve `infra/constantes.json`, que fica fora do
repositório de propósito, porque é artefato regenerável. Ele não usa regex para
parsear o literal: anda caractere a caractere contando profundidade de chave e
colchete, respeitando string e escape, e depois avalia o trecho isolado. O que ele
achou, e que ninguém tinha notado:

- as listas de placa dos três arquivos são idênticas, e as 15 chaves de
  `VEICULOS_INFO` batem com a união delas. Zero placa órfã nos dois sentidos.
- os dois cadastros de pessoa cobrem populações diferentes. Toda a Imperatriz, oito
  motoristas, mais o Severino de Belém, existem nas listas de motorista e em nenhum
  dos dois `COLABORADORES`. O seed une, não escolhe.
- `ULTIMO_KM_PGQ` tem 5 placas para 7 veículos da Raposa. Faltam SM02J13 e SMW0B96,
  que aparecem em `CONFIG_PADRAO_RAPOSA` com `ultimo_km` nulo.
- as 8 placas a mais do `VEICULOS_INFO` de documentos vêm com modelo, marca e ano
  preenchidos com travessão, ou seja, sem dado.

As quatro senhas do objeto `USUARIOS` estão no HTML em base64 com um `atob()` ao
lado, então já vazaram. O extrator redige o campo `senha` antes de escrever o JSON, e
o seed cria os quatro usuários com senha nova, vinda do `.env`. Isso resolve o item 2
do passivo da fase 4 na origem, em vez de arrastá-lo até lá.

## registro de execução

| fase | estado | quando | commits |
|---|---|---|---|
| 0 base | não iniciada | | |
| 1 login | não iniciada | | |
| 2 banco | não iniciada | | |
| 3 duplicação | não iniciada | | |
| 4 publicar | não iniciada | | |
| 5 andaime | não iniciada | | |

Atualize esta tabela ao fim de cada fase. Plano que diverge da realidade engana a
próxima sessão.
