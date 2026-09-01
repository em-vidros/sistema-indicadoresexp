# arquitetura: hexagonal com o tamanho deste app

Decidido em 2026-08-31. Vale para o código novo. Os 7 HTMLs de origem não mudam de
visual, por decisão da Lívia, e isso está no `app-funcional.md`.

Quem for escrever código nesta base lê este arquivo antes. Ele é o contrato que o
`verificar/fronteiras.ts` cobra.

## a forma

```
packages/
  core/src/
    dominio/     puro. tipos e regras. sem I/O, sem framework, sem relógio.
    portas/      a forma do que o caso de uso precisa do mundo. só interface.
    casos/       orquestra o domínio através das portas.
  db/            adaptador de persistência. drizzle, schema, migrations, seed.
  auth/          adaptador de sessão. better-auth sobre o drizzle.
apps/
  server/        raiz de composição. hono, rotas, injeção. o único que conhece todos.
  web/           vite multipágina. os 7 html intactos, mais o `entrar.html` da fase 1.
infra/           o container do banco, o extrator de constantes.
verificar/       as provas de cada fase, mais a cerca de import.
```

Cinco pacotes, e cada um passa no mesmo teste: existe porque tem um segundo
consumidor. `db` é consumido pelo servidor, pelo seed e pelos scripts de
verificação. `auth` é consumido pelo servidor e pelo seed, que cria os quatro
usuários com o mesmo hasher. `core` é consumido por todos os três. Pacote com um
consumidor só seria repasse com cerimônia de publicação, e não tem nenhum aqui.

## por que hexagonal aqui, e onde ele para

O `_arquitetura.md` da casa lista "hexagonal completo" entre os não-objetivos, e
está certo para o caso geral. Uma interface por tabela num CRUD de 25 tabelas
custaria três arquivos por entidade e não compraria nada, porque não existe um
segundo adaptador de Postgres esperando na fila.

O que este app tem, e que justifica a disciplina, é um histórico específico: a
mesma regra de negócio escrita quatro vezes em arquivos diferentes, com valores
diferentes. O limiar de custo por carga vale 9 no card do dashboard, 10 na tabela
de rotas e 9,1 no texto do WhatsApp, tudo dentro do mesmo arquivo. Quebra e
manutenção/produção divergem do mesmo jeito. Hexagonal aqui não é sobre trocar
banco, é sobre existir um lugar só onde a regra mora.

Então a fronteira que eu imponho de verdade é uma: `dominio/` é puro e ninguém
importa framework lá dentro. As portas são três, todas com costura real.

## as três portas, e por que só três

**`ArmazenamentoArquivo`.** A única com segundo adaptador já anunciado. A fase 4
do plano deixa em aberto se o app publica no servidor, com volume em disco, ou no
padrão Cloudflare da casa, com objeto remoto. As duas APIs não se parecem. Três
telas sobem PDF.

**`Relogio`.** Vencimento de documento e alerta de preventiva perguntam que dia é
hoje. Sem a porta, testar "vence em 30 dias" vira mexer no relógio da máquina.

**`GeradorId`.** Mesmo motivo, para o teste ser determinístico.

Portas que eu **não** declaro, e o argumento de cada uma:

Repositório por tabela. O Drizzle já é a abstração sobre SQL, e o segundo
adaptador não existe. Os casos de uso recebem as funções de que precisam num
objeto `Deps`, tipado estruturalmente no próprio `core`. O TypeScript casa o
módulo do `db` com esse tipo de graça, sem `implements` e sem arquivo de
interface. É porta, sem a cerimônia.

Provedor de sessão. O better-auth já é a fronteira. Embrulhar uma biblioteca
escolhida esta semana é preparar uma troca que ninguém pediu.

Camada de serviço para CRUD. `criarAta` que só chama `db.insert(ata)` repete os
mesmos argumentos sem trocar de abstração. A rota responde "onde grava a ata" numa
leitura. Quando um handler passar de umas 100 linhas, ou quando uma operação
ganhar um segundo chamador, aí extrai. Sob demanda, não por padrão.

## o buraco que as colunas geradas abrem, e como ele fecha

O plano põe `km_rodados`, `custo_viagem`, `pct_custo`, `valor_total`,
`dias_oficina` e `pct_quebra` como `GENERATED ALWAYS ... STORED` do Postgres. Isso
significa que a definição autoritativa desses seis números mora no SQL da
migração, fora do `dominio/`. Um domínio que não sabe calcular o próprio número é
um domínio com buraco, e não adianta fingir que não.

Duas coisas fecham. A primeira é que a função pura existe do mesmo jeito em
`dominio/derivados.ts`, porque o formulário mostra o custo da viagem na tela antes
de gravar, e isso não pode ir ao servidor a cada tecla. A segunda é
`packages/db/test/derivados.test.ts`, que grava linhas com valor conhecido, lê a
coluna gerada de volta e compara com a função pura. Divergência entre o SQL e o
TypeScript reprova.

O SQL continua sendo quem garante. A função pura é a definição legível. O teste é
o que impede as duas de se separarem.

## a cerca

`bun run fronteiras` roda `verificar/fronteiras.ts`, que lê cada import de cada
camada e compara com uma tabela do que aquela camada pode ver. `dominio/` só pode
importar `zod` e ele mesmo. `portas/` pode ver `dominio/`. `casos/` pode ver os
dois. `db` e `auth` podem ver `core`, e ninguém pode ver `apps/`.

A fase 1 acrescentou a camada `server`, que é `apps/server/src/**` e pode ver
`hono`, os três pacotes da casa, `zod` e a biblioteca padrão. Ela é a raiz de
composição, e por isso é a única que alcança `db` e `auth` ao mesmo tempo. Foi essa
regra que decidiu onde o hash da senha é calculado: `packages/db` não alcança
`@ind/auth`, então a senha chega lá pronta, e quem hasheia é o servidor.

A regra de import relativo mudou junto, e vale registrar por que. Ela era "não pode
começar com `../`", e isso proibia `packages/db/src/consultas/` de alcançar
`../schema/`, que é o próprio pacote. O efeito foi torcer o código: a primeira
consulta nasceu em SQL cru pelo motivo errado. Agora a regra resolve o caminho e
pergunta se ele cai dentro da própria camada. Cerca que muda o formato do código
dentro da camada não está guardando fronteira nenhuma.

A prova é por falha, não por sucesso. Ponha `import { db } from '@ind/db'` em
qualquer arquivo de `dominio/`, rode o comando, e ele sai com código 1 nomeando o
arquivo, a linha e o motivo. Isso entra no `bun run verificar` junto com os tipos
e os testes.

Duas coisas que uma revisão de 2026-09-01 achou nela, as duas corrigidas. A linha
apontada vinha uma acima da real, porque o casamento do regex começa no espaço
antes da palavra-chave e esse espaço costuma ser a quebra de linha anterior. E
`import 'x'`, sem `from` e sem parêntese, passava direto, o que deixava um pacote
importar um app pelo efeito colateral. Cerca é o único mecanismo aqui, não há
`dependency-cruiser` nem plugin de lint atrás dela, então furo nela é furo no
contrato inteiro.

Sem `dependency-cruiser`, sem plugin de lint, sem `tsconfig` com references. Um
arquivo faz o mesmo trabalho.

## o modelo de domínio

Aqui está a parte que muda o schema do `app-funcional.md`. Cinco estados ilegais
que aquele desenho ainda deixava representáveis, cada um verificado no fonte.

**A viagem tem dois estados, não cinco colunas nulas.** Metade das viagens não
voltou ainda. `Viagem` é união de `em_curso`, que tem previsão e não tem chegada, e
`concluida`, que tem as duas mais o km de chegada. Isso mata
`{ chegada: null, km_chegada: 4000 }`.

**A pontualidade não é escolha do operador.** Hoje é um `<select>` na linha 308 do
formulário, independente de `hora_prevista` e `hora_chegada`. Nada impede gravar
"adiantado" com chegada depois do previsto, e o KPI de atraso conta essa linha. O
`<select>` continua no HTML, porque o visual não muda, e para de ser enviado na
fase 2. Sai na fase 5, junto com o resto do andaime.

A coluna gerada não é `pontualidade`, é `atraso_min`, um inteiro assinado em
minutos. A classificação em três faixas precisa da tolerância, que vive em
`parametro`, e coluna gerada do Postgres não consulta outra tabela. Então o banco
guarda o desvio e a consulta classifica, juntando com o parâmetro.

E `atraso_min` fica **nulo** quando `data_prevista` é nula, em vez de cair na data
de saída. A tela de hoje tem um campo de data só para a chegada e dois de hora,
então ninguém informa o dia previsto. Supor que a viagem chega no dia previsto erra
por 24 horas justamente na viagem noturna, que é o padrão desta frota: uma viagem
prevista para 06:00 do dia 31 que chega às 02:00 do dia 1, ou seja 1200 minutos
atrasada, sairia classificada como adiantada em 240. Número ausente ganha de número
inventado. A fase 2 vai mandar `data_prevista = data_chegada`, reproduzindo a
suposição de mesmo dia de forma explícita, e a saída é acrescentar um campo de data
ao lado de "Hora Prevista" quando o visual abrir.

O segundo também ficou proibido nas cinco colunas de hora de viagem e manutenção,
por CHECK. `HoraHM` do domínio é `HH:MM` e não representa segundo, então uma linha
com `13:19:30` faria `atraso_min` valer -40 no banco e -41 na função pura. Nenhuma
tela coleta segundo; proibir grava a paridade em vez de documentá-la.

**O abastecimento perde o campo `viagem_longa`.** Ele é escrito nas linhas 856 e
877 e nunca é lido de volta por nada. É estado de interface, não de negócio. O modo
sai da contagem de paradas, então não há dois campos para manter em sincronia. A
coluna `slot` também sai: ela é `['Saída','Interior','Chegada'][ordem-1]`, calculada
na linha 862. Fica `ordem`, com `CHECK (ordem BETWEEN 1 AND 3)` e
`UNIQUE (abastecimento_id, ordem)`.

Os agregados replicados nas três linhas filhas, que a linha 885 escreve com um
`forEach`, somem. Vira `SUM`.

**`status_documental` vira coluna gerada.** Hoje ele já diverge: o importador de
CSV, na linha 654 de `manutencao-frota.html`, grava `'pendente'` fixo, sem olhar se
os arquivos existem. Passa a ser `GENERATED ALWAYS AS (orcamento_arquivo_id IS NOT
NULL AND os_arquivo_id IS NOT NULL)`.

**O documento é uma união de seis tipos, não uma tabela chapada.** Apólice, CRLV e
tacógrafo pertencem a um veículo e vencem. CNH pertence a uma pessoa, vence e
carrega número e categoria. Manual pertence a vários veículos e não vence. O PGQ
pertence a uma base e não vence. Confirmei nos literais `MANUAIS_RAPOSA` e
`PLANOS`: nenhum dos dois tem campo de vencimento. Sem os `CHECK` por tipo,
`{ tipo: 'plano_pgq', vencimento: '2026-12-01', cnh_numero: '123' }` compila e
grava.

Some junto o documento sem fonte. `CHECK (arquivo_id IS NOT NULL OR link_externo IS
NOT NULL)`, porque a tela oferece upload ou link do Drive, e uma linha sem os dois
não é nada.

**`meta` ganha direção e duas faixas.** O desenho antigo, `(chave, valor_meta,
valor_alerta)`, não expressa o semáforo de três faixas nem o único KPI que usa `≤`
e não tem faixa crítica, que é o percentual de atraso da linha 431. Vira
`(chave, direcao, limite_ok, limite_atencao)`, com `limite_atencao` nulo quando só
há duas faixas. São quatro linhas, uma por KPI.

E o que não é limiar sai de lá. A tolerância da pontualidade e o teto de upload são
escalares sem direção e sem faixa; enfiá-los em `meta` seria o saco de campos
opcionais que esta mesma seção condena. Vão para `parametro (chave, valor,
descricao)`, que existe para isso e para o próximo valor desse feitio.

**`rota` é única por par, não por nome.** `BELÉM` e `SALINÓPOLIS` existem em
Imperatriz e em Belém ao mesmo tempo, então são 22 rotas para 20 nomes distintos.
`UNIQUE (nome, base_id)`. Placa continua única global, porque as três listas são
disjuntas e as 15 são distintas.

### o que eu não mudei

IDs marcados, sim. Números marcados, não. Marcar `Km`, `Litros` e `Reais` obrigaria
um construtor em cada literal do seed, de cada teste e de cada fixture, e a classe
de bug que este app tem não é unidade trocada, é limiar divergente. Custo alto,
retorno nenhum aqui.

Quatro tabelas de registro em vez de uma, arquivo em volume, dono opcional mais
junção no documento e `colaborador_id` nulo na integração continuam como o
`app-funcional.md` escreveu. Aquelas quatro decisões seguem certas.

## os valores que estavam em aberto

O `app-funcional.md` deixou três pendências de valor. Duas se resolvem sozinhas
quando o schema fica certo, e a terceira eu decidi.

**Custo por carga: 7 e 9.** O card do dashboard usa `< 7` verde e `< 9` amarelo. A
tabela de rotas usa 10, e o WhatsApp usa `meta * 1.3`, que dá 9,1. Os dois últimos
não são decisões, são um número solto e uma fórmula. O card é a superfície que a
Lívia olha, então ele ganha.

O mesmo raciocínio vale para os outros dois KPIs, que divergem exatamente igual e
que o plano anterior não tinha notado. Quebra fica em 1 e 2. Manutenção sobre
produção fica em 2 e 3. Atraso fica em 5, sem faixa crítica.

**Lavagem, 200 ou 300 km: os dois.** Não era conflito, era nível. 200 é o padrão do
catálogo, em `tipo_preventivo.alerta_km`. 300 é a configuração da Raposa, em
`item_preventivo.alerta_km`, que sobrepõe. Os dois valores entram, cada um no seu
lugar.

**Teto de upload: 6 MB.** É o maior dos dois tetos que existem hoje, e o maior PDF
do parque tem 1,66 MB. O de 4 MB da ata era o mais apertado sem motivo registrado.

**Falta uma decisão sua.** A tolerância da pontualidade. Se a chegada tem que bater
o minuto exato com a previsão para contar como "no prazo", quase nenhuma viagem
conta. Semeei 15 minutos, que é o valor que eu escolheria, e ele vive na tabela
`meta`, então muda sem publicar versão nova.

## o que sai do jeito antigo

`GENERATED ALWAYS` cobre `viagem.km_rodados`, `viagem.custo_viagem`,
`viagem.pct_custo`, `viagem.atraso_min`, `abastecimento_parada.valor_total`,
`manutencao.dias_oficina`, `manutencao.status_documental` e `quebra.pct_quebra`.
São oito, contra os seis do plano anterior. Os dois novos são `atraso_min` e
`status_documental`, e os dois entraram porque eram estado ilegal, não porque
faltava um número.

Também vale registrar o que **não** virou coluna gerada. `mediaKmL` existe só como
função pura, porque ela é um agregado sobre as paradas de um abastecimento e não
cabe numa expressão de linha.
