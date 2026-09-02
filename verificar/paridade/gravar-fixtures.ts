/**
 * Pega as respostas reais de um servidor de pe e grava o ponto de partida das
 * fixtures. Rode contra o dev apontado para a branch `porte-react` da Neon:
 *
 *     SENHA_LIVIA=... bun verificar/paridade/gravar-fixtures.ts
 *
 * O que sai daqui e ponto de partida, nao resultado final. A base de producao nao
 * exercita os ramos que a tela desenha diferente (documento vencido, em alerta, sem
 * data, sem arquivo), entao depois de gravar o JSON e editado a mao, e o roteiro da
 * tela diz no cabecalho o que foi acrescentado e por que.
 */
import { TELAS, type Tela } from './palco.ts'

/**
 * Os GETs que o modulo de cada tela dispara ao carregar. Saem de ler o `*-api.ts` e o
 * js da tela. Tela com lista vazia ainda nao teve o roteiro escrito; quem escrever o
 * proximo acrescenta os caminhos dela aqui e roda de novo.
 */
const GETS_POR_TELA: Readonly<Record<Tela, readonly string[]>> = {
  'entrar': [],
  'documentos-frota': ['/api/documentos/catalogo', '/api/documentos'],
  'integracao-frota': ['/api/integracoes/catalogo', '/api/integracoes'],
  'dashboard-semanal': ['/api/registros'],
  'ata-reuniao': ['/api/atas/catalogo', '/api/atas'],
  'manutencao-frota': ['/api/preventiva', '/api/registros?base=Raposa'],
  'formulario-registro': ['/api/sessao'],
}

const BASE = Bun.env['BASE'] ?? 'http://localhost:3200'
const SENHA = Bun.env['SENHA_LIVIA']

console.log('fixture e dado de teste, nao espelho de producao.')
console.log('o que sair daqui vai ser editado a mao para cobrir os ramos que a base nao tem.\n')

if (SENHA === undefined || SENHA === '') {
  console.error('falta SENHA_LIVIA no ambiente')
  process.exit(1)
}

const entrada = await fetch(`${BASE}/api/entrar`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ usuario: 'livia', senha: SENHA, lembrar: true }),
})
if (!entrada.ok) {
  console.error(`login recusado com ${entrada.status} em ${BASE}`)
  process.exit(1)
}

const cookie = (entrada.headers.getSetCookie() ?? [])
  .map((bruto) => bruto.split(';')[0])
  .filter((parte): parte is string => parte !== undefined)
  .join('; ')

for (const tela of TELAS) {
  const caminhos = GETS_POR_TELA[tela]
  const fixtures: Record<string, { corpo: unknown }> = {}
  for (const caminho of caminhos) {
    const resposta = await fetch(BASE + caminho, { headers: { cookie } })
    if (!resposta.ok) {
      console.error(`${tela}: GET ${caminho} respondeu ${resposta.status}`)
      process.exit(1)
    }
    fixtures[`GET ${caminho}`] = { corpo: await resposta.json() }
  }
  const destino = new URL(`fixtures/${tela}.json`, import.meta.url)
  await Bun.write(destino, `${JSON.stringify(fixtures, null, 2)}\n`)
  console.log(`${tela}: ${caminhos.length} GET(s) gravado(s)`)
}
