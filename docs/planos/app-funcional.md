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

> **Revisto em 2026-09-02.** O Henrique decidiu portar para React mesmo assim, e a fase
> 6 diz como isso acontece sem mudar um pixel. Os três fatos acima continuam verdadeiros
> e continuam sendo o custo; o que mudou foi quem paga.

Nota para quem executar: o Bun 1.4 tem servidor com import de HTML e bundling
embutido, que faria o mesmo trabalho sem Vite. Segui com Vite porque foi o pedido, e
porque o ecossistema de plugin é maior. A troca é reversível e custa umas 30 linhas.

## a stack

Bun 1.4 (o servidor tem 1.3.14 hoje, `bun upgrade` resolve), Vite 8 em modo MPA,
Hono no servidor, Postgres 17 em container próprio, Drizzle como ORM, better-auth
para sessão, Zod na fronteira, Tailwind 4 e Motion para o que for novo.

Em produção, desde a decisão de 2026-09-01, o Postgres do container vira Neon e a
publicação é na Vercel, com o mesmo Hono rodando no runtime Bun. O container local
continua sendo o banco de desenvolvimento e de teste. Os detalhes, e os dois riscos que
o primeiro deploy tem que provar, estão na fase 4.

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

Feita em 2026-09-01. O que está escrito abaixo é o que aconteceu, não o que eu
tinha previsto; onde os dois divergiram, o motivo está dito.

As 7 telas saíram da raiz para `apps/web/src/` e viraram entradas do Vite. O Hono
serve o build e a API na mesma origem, o que elimina CORS de vez. O overlay de login
do `formulario-registro.html` virou `entrar.html`, uma oitava tela com o CSS e o
markup copiados sem tirar nem pôr, e quem decide agora é o better-auth, com sessão em
cookie httpOnly. As 7 páginas exigem sessão. Antes, seis não pediam nada.

**O build é um no-op, e é de propósito.** Os `<script>` são inline e clássicos, então
o Vite não tem o que fazer neles: o `dist` sai byte a byte igual à origem, nas oito
telas. Ele entra nesta fase, e não na fase 2, para separar risco. Introduzir
empacotador junto com a extração dos módulos daria duas causas possíveis para o mesmo
sintoma.

**Os caminhos `docs/` não mudaram.** Eu tinha escrito que mudariam. Não precisou: o
servidor honra o espaço de URL que já existia, e quem passou a exigir sessão foi a
rota, não o caminho. Isso deixou seis dos sete arquivos intocados, byte a byte.

**A permissão vem do servidor.** `GET /api/sessao` devolve nome, admin, base fixa,
bases e tipos, lidos de `usuario_base` e `usuario_tipo`. O objeto `USUARIOS` com as
quatro senhas em base64 saiu do HTML, e com ele a chave `emvidros_sessao`.

**O `emvidros_usuarios_config` não tem como ser recuperado, e não vale endereço de
importação.** Ele vive no localStorage do navegador da Lívia, na origem do Netlify. O
app novo roda em outra origem, e origem diferente não enxerga o localStorage da
outra. Um endereço de importação nasceria sem quem o chamasse. Se ela tiver editado
permissão por lá, refaz uma vez na tela de administração, que agora grava no banco.

**A tela de administração de usuários passou a gravar no servidor**, em
`/api/usuarios`. O markup dela é gerado por `innerHTML`, então trocar a fonte do dado
não muda um pixel, com uma exceção que declaro porque é mudança de pixel. O campo
"Senha" passou a nascer vazio e passou de `type="text"` para `type="password"`. O
motivo dos dois é o mesmo: depois da fase 0 só existe hash, então não há o que
mostrar, vazio quer dizer "não muda", e um campo em que se digita senha é do tipo
senha. Hoje ele imprimia `livia@2026` na tela, em texto claro.

**O cadastro aberto do better-auth foi fechado.** `sign-up/email` vinha público junto
com `sign-in`, e num sistema de quatro usuários que nascem do seed isso é porta
destrancada. O portão devolve 404 nele.

Os PDFs de `docs/` saíram do site público e passaram a sair por `/docs/*` atrás da
sessão, só `.pdf` e `.svg`, com contenção de caminho. `docs/planos/` fica de fora por
duas barreiras independentes. O logo continua público, porque a tela de login o
mostra antes de existir sessão.

O JS de dados não mudou. As telas continuam lendo e escrevendo em localStorage, de
propósito: eu queria login e servidor provados antes de mexer na persistência.

**Prova.** `verificar/fase-1.sh`. Ela nasceu com duas comparações byte a byte, que a
fase 2 aposentou: com o script fora do HTML, comparar texto deixou de dizer alguma
coisa. Quem prova o visual agora é `verificar/visual-telas.ts`, que a fase 1 chama, e
que sabe o que mudou de propósito em cada tela. O `verificar/visual-formulario.ts`
saiu, porque ele cobria uma tela só e a nova cobre as seis. Depois disso, contra o
servidor de pé: as sete telas redirecionam para o login, o que não é
navegação recebe 401 em vez de um 302 que o `fetch` leria como sucesso, a apólice
abre com sessão, o plano em markdown não sai, nada escapa da pasta e a base da
Andreina vem do servidor.

**O que uma revisão independente derrubou.** Ela achou 14 defeitos, e dois eram de
parar. O `destinoSeguro` do `entrar.html` tinha quatro das cinco checagens do
servidor, sem a de caractere de controle, e o navegador remove TAB antes de resolver
a URL, então `/%09/evil.com` virava `//evil.com` e saía do site. Pior, no caminho sem
sessão o servidor servia a tela e nunca olhava o destino, então quem decidia era a
checagem fraca. Agora o portão limpa o destino envenenado da query antes de a tela
carregar, e o cliente tem a sexta linha.

O segundo era meu. Eu acrescentei a guarda que impede tirar a base fixa das bases
liberadas depois que o teste dela já estava escrito, e deixei a suíte vermelha com
um teste afirmando o contrário da regra. A revisão apagou a guarda inteira e a suíte
ficou mais verde do que com ela.

Outras cinco correções vieram dali. O `/api/entrar` passava por fora do limitador do
better-auth, que mora no roteador dele e não roda em chamada direta ao endpoint;
agora tem contador por IP, 10 falhas em 5 minutos. Uma exceção dentro do
`aplicarSessao` virava laço infinito de redirecionamento, com a aba piscando sem
mensagem, porque o `.catch` estava depois dele na cadeia. A cerca não enxergava
`import 'x'` sem `from`, o que deixou um pacote importar um app pelo efeito
colateral. E a prova do visual ignorava tudo que nasce de `innerHTML`, que nesta
tela são 8 pontos; ela agora compara também as tags de dentro do `<script>`, com as
interpolações apagadas.

**Uma prova que mudou de fase.** Eu tinha escrito aqui que a `andreina` receberia 403
ao lançar registro de Imperatriz. Não dá para provar isso na fase 1, porque a fase 1
não tem rota de escrita: os registros continuam em localStorage. Criar a rota só para
a prova seria endereço sem quem chame. A asserção foi para a fase 2, junto com a
escrita de verdade. O que a fase 1 prova no lugar é que a permissão da Andreina sai
do banco, e não de um objeto no HTML dela.

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

**Armadilha herdada da fase 1, leia antes de extrair o primeiro módulo.** O portão
nega por omissão, e a lista de rotas públicas tem quatro entradas nomeadas. Hoje o
`entrar.html` não tem asset nenhum, porque o script dele é inline. No momento em que
ele virar módulo, o Vite vai emitir um `/assets/entrar-<hash>.js`, o portão vai pedir
sessão para esse arquivo, e a tela de login vai carregar sem JavaScript, sem erro
visível. Não resolva liberando `/assets/*`: os bundles das outras seis telas carregam
o cadastro embutido. A saída é o asset do login ser nomeado e público, como o logo já é.

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

#### onde publica: Vercel, com o banco na Neon

O Henrique decidiu em 2026-09-01, e isso fecha a pergunta que as fases anteriores
deixaram em aberto. Não é o padrão Cloudflare da casa, e não é o servidor próprio com
Caddy e Watchtower. É um terceiro caminho, e ele custa menos trabalho do que os dois:

**O servidor continua sendo o mesmo Hono.** A Vercel roda Bun 1.4 como runtime de
função desde agosto de 2026, com `Bun.serve()` como ponto de entrada, e Hono está entre
os frameworks que ela detecta. Na prática o `apps/server/src/index.ts` de hoje vira um
`server.ts` na raiz que chama `Bun.serve({ fetch: app.fetch })`, e o `vercel.json`
declara `"bunVersion": "1.4.x"`. Nada de reescrever para Workers, e o `Bun.file` que
serve as telas continua existindo.

**O portão continua sendo o do app.** Servir o `dist` como estático da Vercel seria mais
rápido e passaria por cima do portão, que é a única coisa entre a frota e sete telas que
já foram públicas. Então tudo entra pela função, inclusive HTML e asset. O custo é uma
função invocada por arquivo servido; o benefício é não ter duas listas de rota pública
para manter em dia, uma delas fora do código.

**O risco desta escolha, e ele é real:** `paginas.ts` lê `apps/web/dist/` por caminho
relativo a `import.meta.url`. Bundle de função só carrega o que a Vercel resolve por
análise estática, e leitura por caminho montado não é resolvida. Se o `dist` não entrar,
as telas somem em produção e passam local, que é o pior formato de falha. `includeFiles`
no `vercel.json` é a saída, e o primeiro deploy tem que provar isso antes de qualquer
outra coisa.

**O banco vira Neon, e são duas strings de conexão, não uma.** A pooled (o host tem
`-pooler`) é a do runtime, e ela passa por PgBouncer em modo transação, que não suporta
prepared statement. `postgres-js` os usa por padrão, então `prepare: false` no
`criarDb` é obrigatório, e a falha sem ele aparece só sob concorrência em produção. A
direta é a das migrações, porque `drizzle-kit` pela pooled dá erro. O `max` cai de 10
para algo pequeno: com Fluid compute a instância é reusada, e pool grande por instância
multiplica por instância.

**Sobre "privado e seguro", com os números.** Vale dizer o que dá e o que não dá, porque
os dois níveis têm preço diferente. O que existe no plano gratuito é TLS obrigatório
(`sslmode=verify-full` mais `channel_binding=require`, não só `require`), senha gerada,
e branch de produção marcada como protegida. O que **não** existe: IP allowlist, que é
do plano Scale, e rede privada por AWS PrivateLink, que é de conta Organization. Ou
seja, o banco fica exposto à internet com autenticação, e não atrás de uma rede fechada.
Para o tamanho deste sistema isso é defensável, mas é escolha, não é o mesmo que privado.

**O que sai do `.env` e vira segredo da Vercel:** `DATABASE_URL`, `DATABASE_URL_UNPOOLED`,
`BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` e as quatro senhas do seed.
`BLOB_READ_WRITE_TOKEN` a Vercel injeta sozinha quando o Blob está ligado no projeto.

**O adaptador de arquivo já existe e nunca rodou.** `apps/server/src/armazenamento.ts`
tem `ArquivosVercel` sobre `@vercel/blob` 2.8 com `access: 'private'`, escolhido pelo
env `VERCEL`. A API confere, mas os testes usam um adaptador em memória e o local usa
disco, então esse caminho é código não exercitado. O primeiro deploy sobe um PDF e o
baixa de volta conferindo o sha256, ou ele não está provado.

**Prova.** `verificar/fase-4.sh` roda o grep dos cinco itens sobre os arquivos de
código, com este documento excluído da varredura. Ele cita as cinco strings de
propósito, então incluí-lo faria a prova nunca passar. Mais três coisas que só o deploy
responde: as sete telas carregam do bundle da função (o risco do `includeFiles`), o PDF
sobe e volta com o mesmo sha256 pelo Blob, e o login funciona de fora da rede.

### fase 5, o andaime que sai

Uma coisa nasce condenada nesta migração, e escrevo agora para que não fique para
sempre. As funções globais em `window` que a fase 2 preserva por causa dos `onclick=`
inline saem quando e se o visual for aberto para mudança. Enquanto a restrição valer,
elas ficam, e isso é escolha, não esquecimento.

Saem também o `GUIA-CONFIGURACAO.html` e os dois workflows JSON, que documentam uma
configuração de n8n e Google Sheets que o app novo torna desnecessária.

**Atualização de 2026-09-02.** A fase 6 tira os globais de `window` por outro caminho, o
porte para React, sem abrir o visual. O guia continua condenado e continua de pé até o
Henrique decidir; os workflows já saíram na fase 4.

### fase 6, o frontend vira React, e o visual não muda

Decidido pelo Henrique em 2026-09-02, sabendo que a seção "a restrição que manda no
desenho" descartava React de propósito. A restrição da Lívia continua valendo por
inteiro. O que muda é quem gera o markup: os oito `.html` de tela saem de
`apps/web/src`, cada tela vira um componente React 19, e a toolchain passa a ser o
Vite+ da VoidZero (CLI `vp`, pacote `vite-plus`), com o Bun continuando como runtime e
gerenciador de pacotes. O desenho saiu de um painel de três candidatos mais um juiz em
2026-09-02, e o que segue é a síntese.

**O que não muda, e por quê.** A navegação entre telas continua sendo recarga completa,
`window.location='dashboard-semanal.html'`, exatamente como hoje. Não entra roteador.
Isso é a decisão que sustenta o resto: duas telas nunca compartilham documento, então os
sete blocos `:root` que a fase 3 constatou serem diferentes nunca colidem, e o CSS vai
verbatim, sem prefixo, sem `@scope`, sem CSS Modules. As URLs continuam `/<tela>.html`,
porque bookmark, `destino=` em voo e as três provas de fase dependem delas. Os cinco
`*-api.ts` e seus testes ficam como estão. `portao.ts` e `paginas.ts` não ganham rota
nova nem fallback.

**A casca.** `apps/web/src/index.html` com uma dúzia de linhas e um `<div id="app">`.
Um plugin do Vite copia `dist/index.html` para `dist/<tela>.html`, uma cópia por nome em
`ROTAS`, e lança se o destino já existir, para a cópia nunca apagar uma tela que ainda
não foi portada. Do ponto de vista do Hono, `dist/` tem os mesmos nomes de arquivo de
hoje. `main.tsx` lê `location.pathname` uma vez, resolve o nome e monta o componente. A
casca tem uma regra de CSS própria, `#app{display:contents}`, porque `body{display:flex}`
das telas conta com `.sidebar` e `.main` como filhos diretos e o container do React
entraria no meio. É a única mudança de estrutura, e ela está declarada na prova.

**`ROTAS` é a barra de progresso.** `apps/web/src/telas/rotas.ts` tem o array das telas
já portadas e o complemento. O plugin copia a casca só para quem está dentro, o
`main.tsx` só resolve quem está dentro, a prova nova só cobra quem está dentro, e
`visual-telas.ts` e `handlers.ts` cobram exatamente quem está fora. Um commit de tela é
uma linha nesse array mais dois arquivos apagados. Nenhum dos cinco consumidores pede
edição por commit.

**Uma tela.** `telas/<tela>.tsx` mais `telas/<tela>.css`. O CSS é o recorte literal do
`<style>` de hoje, feito por script, e entra no componente como `<style>{css}</style>`
via `import css from './x.css?raw'`. O `?raw` entrega a string exata do arquivo; importar
como folha passaria pelo minificador e juntaria os oito `:root` num arquivo só. O estado
de módulo de hoje vira `useState`; as quatro variáveis de modal viram uma união
discriminada; `docsCfg`, que guarda placa e `'moto_'+nome` no mesmo objeto, vira dois
mapas. Formulários ficam não controlados, `defaultValue` e leitura por `ref` no salvar,
porque é o que a tela faz hoje. Regra de fidelidade estrutural: o que hoje alterna
`display:none` ou classe sem sair do DOM (`.modal-overlay`, `.login-erro`) continua
sempre montado e alterna por `className`; o que hoje nasce de `innerHTML` inteiro vira
`.map()` ou condicional. Sem essa regra o snapshot do estado inicial reprova. Zero
função em `window`, e a prova cobra isso por grep.

**O login migra também, e é a única tela com casca própria.** `entrar.html` vira uma
casca igual à outra apontando para `entrar.tsx`, com asset de nome fixo,
`assets/entrar.js`, e o React num chunk também nomeado, `assets/vendor-react.js`. Os dois
entram em `PUBLICOS` por nome, como o logo. `verificar/publicos.ts` cobra as duas
direções: tudo que `dist/entrar.html` carrega está em `PUBLICOS`, senão o login abre sem
JavaScript e sem erro; e nenhum arquivo público contém canário de cadastro (placa, nome
de motorista, rota de API), senão o porte abriu o que o portão fechava. Um sentido só
deixa passar exatamente o erro que o outro pega.

**Chart.js** sai do CDN e vira `chart.js@4.4.0`, a mesma versão da tag, por `import()`
dinâmico dentro do efeito do dashboard, com `destroy()` na limpeza. Some o global
`window.Chart` sem tipo e some a dependência de um CDN externo atrás de um portão que não
admite mais nada.

**Tipos.** Os componentes entram no `tsconfig.json` da raiz com `jsx: react-jsx` e o
`strict` que já está lá. Os `js/<tela>.ts` de hoje nunca passaram pelo `tsc -b`; os
`*-api.ts` passam a ser checados pela primeira vez e ganham tipo de retorno.

**A prova, que substitui `visual-telas.ts` e `handlers.ts`.** As duas comparam texto de
origem, e JSX não é HTML. A nova compara o que o navegador monta. Roda em Chromium de
verdade, por Playwright, nos dois lados, porque uma sonda de 2026-09-02 mostrou que o
happy-dom não compila `onclick="..."` em função e a captura das telas velhas depende
disso. `page.route` serve os arquivos de `dist/` e responde `/api/*` com fixtures
gravadas uma vez, então a prova não precisa de Hono nem de banco;
`page.clock.setFixedTime` congela o relógio, porque as telas escrevem "vence em 42 dias"
no DOM. Por tela e por estado (`inicial`, `lista-renderizada`, `modal-veiculo-aberto`),
cada estado alcançado por interação real, nunca chamando função interna.

Quatro comparações por tela. O DOM normalizado de cada estado contra
`verificar/baseline/<tela>/<estado>.html`; o normalizador apaga só o que não desenha
(atributo `on*=`, ordem de atributo, corrida de espaço, `style` reserializado), e cada
regra dele é uma afirmação contestável. O `telas/<tela>.css` byte a byte contra o
`<style>` de origem. A união dos handlers que os passos declaram cobrir contra a lista
extraída do markup velho, para handler que ninguém clica reprovar a prova e não a tela.
E a configuração passada ao `Chart` contra o JSON congelado, porque pixel de canvas não
está no DOM. O screenshot de cada estado fica salvo na baseline para inspeção; diff de
pixel com limiar entra só se o DOM não bastar.

Cada passo também congela os efeitos que o clique disparou, e um deles precisou de
decisão. Download que sai de `URL.createObjectURL(new Blob(...))` traz uma URL com UUID
sorteado por chamada, e gravar a URL faria o passo divergir de si mesmo. O palco grava o
conteúdo do arquivo no lugar dela, que é o que a tela produziu e o que o porte tem que
preservar. O relatório do `dashboard-semanal` entra na baseline linha por linha por causa
disso, e é a única coisa que hoje cobra o texto dele.

A baseline congela uma vez, antes de existir React, a partir do build de hoje, e entra
no git. Depois disso a prova não precisa do código velho, o que é o que permite apagar
`<tela>.html` e `js/<tela>.ts` no commit da própria tela. `bun verificar/paridade.ts
--mutar` planta uma mutação por tela numa cópia temporária do fonte e exige vermelho de
cada uma; sem isso a prova é uma afirmação sobre si mesma. São as duas famílias que a
fase 2 deixou passar: um pixel dentro de template, um `gap` ou uma `margin` crescendo dez
vezes, e um handler que sai do `Object.assign(window, ...)` e vira enfeite. Os bugs de hoje entram na baseline como estão. Há
pelo menos um em `documentos-frota`: o `querySelectorAll('.form-group input')` que
adiciona a classe `inp` roda na carga do módulo com o modal vazio e não faz nada. O React
tem que reproduzir isso; corrigir é decisão separada, com a Lívia.

**Vite+, adoção parcial.** Uma sonda de 2026-09-02 mostrou que `vite-plus@0.3.0` embute
Vite 8 sobre Rolldown, que `@vitejs/plugin-react@6` exige `vite@^8` explícito no
workspace (sem isso o build quebra com `ERR_PACKAGE_PATH_NOT_EXPORTED ./internal`), que
`vp test` é Vitest e não entende `bun:test`, e que `vp check` reformataria 27 arquivos
existentes. Então entram `vp dev` e `vp build`; `bun test` continua sendo o runner, e
`vp check` fica de fora até haver decisão de formatar a árvore, porque um script que
nasce vermelho ensina todo mundo a ignorá-lo. Tudo pelo pacote local, nada de
instalador global. Uma segunda sonda mostrou que o Playwright 1.62 roda sob Bun 1.4 com
`page.route`, `page.clock` e screenshot, e que o ciclo por tela leva menos de um segundo.

Um tropeço do commit 0 que vale registrar porque pode voltar. Por uns minutos em
2026-09-02, `rolldown@1.2.7` (que o Vite 8 puxa) estava no npm sem o binário
`@rolldown/binding-darwin-arm64`, e o build morria antes de ler o config. O binário
apareceu em seguida e o build passou sem override. Se acontecer de novo numa versão
nova, `"overrides": { "rolldown": "<última com binário>" }` na raiz resolve, dentro da
faixa `~1.2.x` que o Vite declara.

**A sequência.** Dez commits, cada um fechado por prova antes do próximo.

0. Vite+ entra e nada mais muda. `vite@^8`, `vite-plus` e `@vitejs/plugin-react`; o
   `vite.config.ts` troca o `defineConfig` e mantém a descoberta de `*.html`. React,
   Chart.js e Playwright entram no commit em que passam a ser usados. Prova: `bun run
   verificar` inteiro verde com o `dist` de hoje, e este plano com a fase escrita.
1. A baseline congela. `playwright` entra; o harness em `verificar/paridade/`, os
   roteiros e as fixtures das sete telas, os arquivos de `verificar/baseline/`. Zero React
   de tela. Prova: capturar duas vezes dá os mesmos bytes, e a mutação plantada em cada
   tela reprova. Fechado com 81 passos congelados e sete mutações pegas.
2. `entrar`, a menor, e a que exercita o recorte público. Nasce `verificar/publicos.ts`.
   Fechado. Três coisas que ele decidiu e valem para as outras seis. Campo que a tela
   velha lê com `getElementById(...).value` vira `ref`, e não estado controlado: o React
   escreve o atributo `value` num input controlado e a baseline congelou sem ele. O
   inventário de `handlers.txt` passa a ser lido da baseline e nunca reextraído, porque
   o React não deixa atributo `on*` e a lista viraria vazia, deixando a prova verde
   justamente onde ela precisa morder. E cada tela portada sai da lista de
   `visual-telas.ts` no seu próprio commit, porque aquela prova compara arquivo com
   arquivo e a casca React não se parece com o que o build entrega.
3. `documentos-frota`. 4. `integracao-frota`. 5. `dashboard-semanal`, onde entra o
   Chart.js. 6. `ata-reuniao`. 7. `manutencao-frota`. 8. `formulario-registro`, onde o
   nome do asset muda nas provas das fases 2 e 4.
9. Limpeza. Somem `visual-telas.ts`, `handlers.ts` e a captura do legado; o `include`
   do tsconfig fecha em `apps/web/src/**`; a tabela no fim deste arquivo fecha a fase.

As fixtures e o servidor de desenvolvimento usam a branch `porte-react` da Neon, criada
em 2026-09-02 a partir de `production`, com a string em `.env.porte.local`, fora do git.
O `.env` desta máquina aponta para a produção e nenhum passo desta fase toca nele.

**Mecânico, delegado a modelo mais barato.** Recorte do `<style>` por script, HTML e
template para JSX (`class`, `for`, `style` de string para objeto sempre com valor em
string, `onclick="f('a')"` para `onClick={() => f('a')}`, `.map().join('')` para
`.map()` com `key`), os roteiros das telas 3 a 8 depois que o da 2 existe como modelo,
os globs dos `fase-*.sh`. **Julgamento, na sessão principal.** O modelo de estado de
cada tela, as regras do normalizador, a lista de estados, a tabela de handlers cobertos,
o recorte de asset público, e decidir se uma diferença apontada é regressão ou mudança
declarada.

**Riscos que fico devendo provar.** O `display:contents` no `#app` é a única coisa entre
o layout de hoje e um layout quebrado, e o screenshot salvo na baseline é o que permite
olhar. Há uma janela branca antes da primeira pintura que hoje não existe, porque o CSS
passa a chegar pelo JavaScript; se incomodar a Lívia, a correção é uma regra de fundo na
casca, por rota. Playwright sob Bun é fato a confirmar no commit 1; se falhar, a prova
roda com `node`. E o `GUIA-CONFIGURACAO.html` fica fora até decisão.

**Prova.** `verificar/fase-6.sh`: nenhum `.html` de tela em `apps/web/src` além das
duas cascas e do guia; `bun verificar/paridade.ts` verde e `--mutar` vermelho nas duas
mutações; `verificar/publicos.ts` verde nos dois sentidos; zero `window.` de escrita em
`apps/web/src/telas/`; e as provas das fases 1, 2 e 4 continuam passando contra o
servidor.

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

Onde o app publica deixou de estar em aberto em 2026-09-01: Vercel com runtime Bun, e
o banco na Neon. Publicado em 2026-09-02. A seção da fase 4 tem o desenho, e a do fim
do documento tem o que o deploy mudou em relação a ele.

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

| fase | estado | quando | o que falta |
|---|---|---|---|
| 0 base | **pronta** | 2026-08-31 | |
| 1 login | **pronta** | 2026-09-01 | |
| 2 banco | **pronta** | 2026-09-01 | |
| 3 duplicação | não iniciada | | |
| 4 publicar | **pronta** | 2026-09-02 | |
| 5 andaime | não iniciada | | os globais saem pela fase 6; sobra o guia |
| 6 react | em andamento | 2026-09-02 | commits 0 a 9, um por tela |

Atualize esta tabela ao fim de cada fase. Plano que diverge da realidade engana a
próxima sessão.

### o que a fase 0 já tem

Bun 1.4.0. Postgres 17.11 rootless na 5433, por `infra/banco.sh`. O monorepo com
`packages/core`, `packages/db` e a cerca de import. 32 tabelas aplicadas, com as
oito colunas geradas saindo do `drizzle-kit` sem SQL escrito à mão. 142 testes
passando, tipos limpos, cerca verde.

O domínio tem as regras que hoje vivem espalhadas nos HTMLs, cada uma como função
pura: `avaliarKpi`, `classificarPontualidade`, `statusVencimento`,
`statusPreventiva`, `podeRegistrar` e os sete derivados. As portas são três, e
ainda não têm consumidor, porque `casos/` só entra na fase 1.

### a prova da fase 0, e o que ela cobra

`bash verificar/fase-0.sh` com o servidor de pé e o seed rodado. São 20 asserções e
todas passam. As nove contagens do cadastro, os 47 códigos de atividade comparados
um a um contra o extrator, as 7 rotas locais, as quatro senhas vazadas recusadas com
401, e o login novo devolvendo 200 com cookie.

A comparação dos códigos é um a um de propósito. Eu tinha escrito uma grade de `a` a
`c` e a série real não é regular: a semana 1 vai até `f`, as semanas 2 a 4 vão até
`d`, e a semana 5 do motorista para em `b`. Contar 47 não prova que são os 47 certos.

O seed é idempotente, com transação e id determinístico por UUIDv5 sobre a chave
natural. `colaborador` não tem nenhuma restrição de unicidade, então com id
aleatório a segunda execução duplicaria as 31 linhas.

O servidor mínimo roda na 3200, e não na 3100, que está ocupada pelo container do
agente-projetista.

### duas coisas que a fase 0 aprendeu e que valem para o resto

**O banco é o árbitro do número, não a documentação.** `Math.round(x * 100) / 100`,
que é o que o front faz hoje, discorda do `ROUND(numeric, 2)` do Postgres em
`3 × 2,675`, onde um dá 8,02 e o outro 8,03. A causa é que o erro já está no
produto em float, antes de qualquer arredondamento, então nenhum truque de string
resolve. `derivados.ts` passou a fazer aritmética decimal em inteiro, e o teste
`derivados-vs-postgres.test.ts` compara 5.060 pares contra o banco de verdade,
numa consulta por operação.

**Número ausente ganha de número inventado.** `atraso_min` fica nulo quando a data
prevista é nula, em vez de cair na data de saída. A tela de hoje tem um campo de
data só, e supor que a viagem chega no dia previsto erra por 24 horas justamente
na viagem noturna, que é o padrão desta frota. A fase 2 vai mandar a data prevista
igual à de chegada, reproduzindo a suposição de forma explícita, e a saída é
acrescentar um campo de data ao lado de "Hora Prevista" quando o visual abrir.

### o que a fase 2 aprendeu, e custou caro

**Extrair `<script>` para módulo mata todo `onclick=` da tela, em silêncio.** Script
inline roda no escopo global, então `onclick="salvar()"` acha `function salvar()` sem
ninguém pensar no assunto. `<script type="module">` tem escopo próprio. No instante em
que o script vira módulo, toda função chamada por atributo do HTML some do lugar onde o
navegador a procura, e o que acontece é uma linha no console que ninguém lê. A tela
abre, pinta certo, a lateral navega, e o botão Salvar não faz nada.

Aconteceu em duas das seis telas, e a suíte inteira ficou verde: 232 testes passando,
tipos limpos, markup idêntico, build fiel. Tipo não pega, porque `window.x` não é
checado. Teste de API não pega, porque a API está certa. Comparação de markup não pega,
porque o markup está certo. A prova que pega é `verificar/handlers.ts`, que cruza os
`on*=` do HTML e do markup gerado contra o que o módulo põe em `window`. Ela entrou no
`bun run verificar` e é a primeira coisa a rodar numa tela que vira módulo.

**A prova de fidelidade visual teve que mudar de forma.** Até a fase 1 era `cmp` byte a
byte, e funcionava porque o Vite não encosta em `<script>` inline. Com módulo, o Vite
troca a tag, move ela do fim do body para o `<head>` e acrescenta o `modulepreload`.
`verificar/visual-telas.ts` substituiu isso: compara o HTML sem script nenhum dos dois
lados, e compara a lista de tags que o código gera, com a interpolação apagada. As duas
comparações reprovaram mutação plantada (`gap` alterado num template, handler removido
do `window`), então elas medem alguma coisa.

**Refatorar markup durante a extração é mudança de visual disfarçada de limpeza.** Os
quatro blocos de assinatura do passe de integração viraram um `.map`. O HTML gerado é
equivalente e o `passin-grid` é `display:grid`, onde espaço em branco não conta, então
ninguém veria diferença. Desfiz mesmo assim, e não por preciosismo: enquanto a origem é
o critério, a prova é exata e uma diferença é uma diferença. Trocar isso por "diferença
que eu julguei inofensiva" transfere para quem lê o relatório o trabalho de julgar de
novo, toda vez.

**Autorização não se herda de estar logado.** As rotas novas nasceram checando sessão e
não checando de quem ela é. Só `registros` filtrava por base. Nas outras, um operador da
Raposa lia o acervo das três bases, baixava o PDF de outra base mandando o id direto,
sobrescrevia a apólice de um veículo alheio e apagava ata de qualquer base. A causa não
foi descuido isolado: toda a suíte de ata, documento e integração logava com a Livia,
que é admin e vê tudo, então nenhum teste jamais pediu nada com credencial de operador.
Teste que só exercita quem pode tudo não prova permissão nenhuma.

**"Quais bases este usuário alcança" tem que existir uma vez só.** A fase 2 escreveu
essa leitura três vezes, em `registros.ts`, `atas.ts` e `integracoes.ts`, cada autor
copiando porque a original era privada e o arquivo estava fora do escopo dele. Regra de
autorização duplicada é a pior duplicação que existe: quando ela mudar, uma das cópias
fica para trás, e o sintoma não é erro, é vazamento em silêncio. Agora ela mora em
`packages/db/src/consultas/permissao.ts`, numa função só.

O que **não** foi unificado, e a decisão é deliberada: os filtros de visibilidade de
cada domínio. Eles parecem a mesma coisa e não são. A coluna que carrega a base muda em
cada um, base nula significa coisas diferentes (ata da empresa, ficha de nome livre,
documento sem dono), e o admin curto-circuita em ata e integração mas passa pela lista
de ids em documento. Uma função cobrindo os três precisaria de três parâmetros de coluna
e duas flags, e a flag errada é exatamente por onde o vazamento entra.

**Teste de permissão que afirma `length > 0` não prova permissão.** O teste de que a
Andreina continua vendo o acervo da base dela passava com o filtro trocado por
`return []`, porque os manuais não têm base nenhuma e aparecem para todo mundo. Ele
agora afirma sobre um documento de dono conhecido, e a mutação o derruba.

**A base de um documento nem sempre está no documento.** O CHECK `documento_base_ck` só
deixa `base_id` preenchido em `plano_pgq`; nos outros cinco tipos ele é NULL por
obrigação. Filtrar por `documento.base_id` teria escondido o vazamento sem fechá-lo. A
base real vem do veículo ou do colaborador, e o filtro é o `coalesce` dos três.

**O que ficou fora da fase 2, de propósito.** Os KPIs do dashboard continuam agregados
no cliente. O plano os mandava para o servidor, e eu adiei: trocar a fonte de dados e
mover o cálculo no mesmo commit torna impossível saber qual dos dois mudou o número, e a
tela não pode mudar. Fica para a fase 3, junto com a consolidação do CSS.

**Uma duplicação nasceu nesta fase, e ela tem endereço.** O campo `pontualidade` era um
select que o operador preenchia à mão, sem relação com o horário digitado. O banco
guarda `atraso_min`, e a classificação passou a ser derivada. A tolerância de 15 minutos
está no parâmetro `pontualidade_tolerancia_min` do seed **e** escrita de novo em
`apps/web/src/js/dashboard-semanal.ts`, porque nenhuma rota entrega parâmetro. Mudar a
tolerância no banco hoje não muda a tela. A saída é uma rota de parâmetros na fase 3, e
até lá o número na tela pode divergir do que aparecia antes, o que é esperado: o valor
antigo era escolha do operador, não medição.

### o que a fase 2 mudou na tela, apesar da restrição

A restrição era não mudar o visual, e o visual não mudou: as seis telas continuam
fiéis ao commit de origem, tag por tag, e `verificar/visual-telas.ts` cobra isso a cada
verificação. O que mudou foi comportamento em caminhos que antes não existiam, porque
armazenamento no navegador nunca falha e rede falha. Está tudo listado aqui para quem
for avisar a equipe.

**Caminhos de erro que nasceram nesta fase.** Salvar plano preventivo, importar CSV e
lançar registro agora podem recusar. Cada um ganhou uma frase começando com o aviso, e
o modal deixou de fechar quando a gravação falha: fechar com o dado não gravado é a
confirmação falsa que esta fase existe para acabar. O `limparHoje` do formulário é o
caso mais claro do problema antigo: ele apagava os registros da tela, dava a confirmação
e não apagava nada; recarregar trazia tudo de volta.

**Regras do banco que a tela não tinha.** Tipo preventivo repetido no mesmo veículo é
recusado, onde antes a tela aceitava e mostrava duas linhas. Ata sem data não entra, e
na importação em lote as linhas recusadas são contadas na mensagem em vez de sumirem.
Viagem com combustível e diárias zerados é recusada com 400, que é a mesma guarda que o
formulário original tinha e que o banco agora também cobra.

**Números que podem divergir do que aparecia antes.** A pontualidade era um select que
o operador preenchia à mão, sem relação com o horário digitado; agora ela é derivada de
`atraso_min`. Divergência aqui é a medição substituindo a opinião, não erro.

**Ordem e latência.** Trocar de base virou uma leitura no servidor, então o chip muda
antes dos números. A API ordena por nome, e as telas recolocam a ordem que a pessoa
conhecia (a do PGQ na preventiva, a de data no histórico) antes de desenhar.

**Uma dívida que a fase 2 cria e não paga: ninguém varre blob órfão.** Apagar ata é
soft-delete e de propósito não leva o PDF junto, porque restaurar uma ata sem o
documento assinado seria pior que guardar o arquivo. Trocar o PDF de um documento marca
a linha antiga com `apagado_em` e deixa o blob no armazenamento. As duas escolhas estão
certas uma a uma, e a soma é armazenamento que só cresce. Com 15 veículos e 4 usuários
isso leva anos para importar, mas o coletor não existe e ninguém vai lembrar depois.

### o que a fase 4 fez, e o que ficou de fora

Escrito em 2026-09-02. Está no ar em `https://sistema-indicadoresexp.vercel.app`, e as
18 asserções de `verificar/fase-4.sh` passam contra essa URL.

**O entrypoint mudou de lugar, e isso não é detalhe.** O preset Bun da Vercel descobre
o servidor pela chamada de `Bun.serve()` durante a carga do módulo, e só procura por
ela em `server.ts` ou `src/server.ts` na raiz do projeto. Num monorepo isso obriga o
arquivo a morar longe do servidor. Então `apps/server/src/index.ts` parou de abrir
porta e passou a exportar `criarApp()`, e quem chama `Bun.serve` é o `server.ts` da
raiz. O `bun run dev` aponta para esse mesmo arquivo de propósito: dois entrypoints,
um para produção e outro para desenvolvimento, divergem, e a divergência só aparece
depois de publicar. A cerca de import ganhou uma camada `entrypoint` com uma
permissão só, para que ele não vire um segundo lugar onde se monta rota.

**As duas leituras de disco passaram a resolver por `process.cwd()` na Vercel.**
`paginas.ts` e `documentos.ts` montavam o caminho a partir de `import.meta.url`, que
dentro da função aponta para o bundle e não para a árvore do repositório.
`pastaDeConteudo` em `arquivos.ts` decide pelos dois casos.

**O `includeFiles` que o plano previa não existe, e não podia existir.** O campo
`functions` do `vercel.json` só casa padrão dentro de `api/`, e o preset Bun põe o
entrypoint na raiz. O deploy recusou com `The pattern "server.ts" defined in
'functions' doesn't match any Serverless Functions inside the 'api' directory`. Tirei a
chave inteira, e o preset subiu o projeto todo. As telas, o asset com hash e o PDF de
1,6 MB de `docs/` chegam na função com o mesmo sha256 do disco, o que a prova mede. O
custo é que `docs/planos/` também sobe. É documento interno num bundle privado, e a
rota só serve `.pdf` e `.svg`, então ninguém o alcança de fora.

**A função vai para `gru1`.** O banco está em `sa-east-1`, e uma função em `iad1`
pagaria a travessia do Atlântico Sul em cada consulta, várias por request. Se a conta
não permitir escolher região, o deploy recusa o `vercel.json` e o campo sai.

**A Neon está de pé, com o schema e o seed aplicados.** 32 tabelas, as 8 colunas
geradas e as nove contagens do cadastro iguais às do Postgres local. O banco lá é o
18.6, e o local é o 17.11; os 21 testes de `derivados-vs-postgres.test.ts` rodaram
contra o 18 e passaram, então as colunas geradas e os derivados batem nas duas versões.

**São duas strings de conexão, e o código sabe disso sozinho.** `criarDb` liga
`prepare: false` e baixa `max` para 3 quando o host tem `-pooler`, em vez de esperar
que alguém passe a opção certa. `urlMigracao()` faz o inverso e recusa a pooled, com
mensagem dizendo o que definir. As duas estão no `.env` com `sslmode=verify-full` mais
`channel_binding=require`, que a Neon aceita.

**Uma armadilha que quase custou o banco.** `seed.test.ts` e `sessao.test.ts` fazem
`truncate ... restart identity cascade`, e o `.env` desta máquina passou a apontar para
a Neon no meio desta fase. A suíte rodou uma vez contra ela. Não havia dado, mas o
mecanismo é esse: o teste passa verde e leva o banco junto. `verificar/banco-de-teste.ts`
entrou como `preload` de `bun test` pelo `bunfig.toml` e recusa host que não seja local,
a menos que `PERMITIR_TESTE_REMOTO=1` esteja na linha de comando.

**Os cinco segredos saíram.** Três já tinham saído na extração dos módulos. O IP do
servidor antigo saiu do `GUIA-CONFIGURACAO.html`, e os dois workflows do n8n foram
apagados, com o e-mail e o id de planilha junto. Eles documentavam a integração com
Apps Script e Google Sheets que a fase 2 tornou desnecessária, e sairiam na fase 5 de
qualquer forma. O que continua de pé é o histórico do git, que guarda as cinco strings
e os 11 MB de PDF mesmo depois de apagados da árvore. Reescrever histórico é
irreversível e passa pelo Henrique.

**O `ArquivosVercel` nunca tinha rodado até agora.** Ele existe desde a fase 2, e os
testes usam um adaptador em memória enquanto o local usa disco. A prova sobe um PDF
pelo `/api/atas/:id/pdf` e compara o sha256 do que volta, que é o único exercício real
desse código.

**O que ficou de fora é o domínio.** O app responde em
`sistema-indicadoresexp.vercel.app`, e não em `sistema-indicadoresexp.emvidros.com.br`.
Apontar o DNS obriga a trocar `BETTER_AUTH_URL` e publicar de novo, porque o cookie de
sessão é assinado com o host. É decisão da Livia com o Henrique, não minha.

**O deploy não sai do git.** `vercel link` recusou o repositório com `The repository
"sistema-indicadoresexp" is private and owned by an organization, which is not
supported on the Hobby plan`. O projeto foi criado do mesmo jeito, mas cada publicação
é um `vercel deploy --prod` na mão. Quem publicar precisa lembrar de rodar
`bash verificar/fase-4.sh <URL>` depois, porque não há CI nesse caminho.

Sobre o `neon.ts` e o `neon deploy`: eles descrevem o estado do projeto Neon e o
reconciliam, `neon deploy` sendo alias de `neon config apply`. Não publicam o app, e
por isso não competem com a Vercel. Entram depois do `neon login`, que é interativo.
