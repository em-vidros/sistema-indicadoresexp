/**
 * O que a tela de cadastro fala com `/api/cadastro`.
 *
 * Os tipos sao redigitados aqui, e nao importados de `@ind/db`: o front nao
 * conhece o pacote de persistencia, e o que atravessa a rede e JSON, nao a linha
 * do drizzle. O preco e que nada compara as duas copias: o teste ao lado prende
 * caminho, metodo e corpo, e campo que mudar de nome so aparece na tela.
 *
 * Toda recusa chega como `FalhaDeCadastro`, que leva o status junto porque a tela trata
 * 409 e 403 de maneiras diferentes.
 */
export type FuncaoColaborador = 'motorista' | 'ajudante' | 'atendimento' | 'logistica'

export type BaseCadastro = {
  id: string
  nome: string
  ativo: boolean
}

export type VeiculoCadastro = {
  id: string
  placa: string
  modelo: string | null
  marca: string | null
  ano: string | null
  baseId: string
  base: string
  ativo: boolean
}

export type ColaboradorCadastro = {
  id: string
  nome: string
  cargo: string | null
  funcao: FuncaoColaborador
  admissao: string | null
  baseId: string
  base: string
  ativo: boolean
}

export type RotaCadastro = {
  id: string
  nome: string
  baseId: string
  base: string
  local: boolean
  ativo: boolean
}

export type CatalogoCadastro = {
  bases: BaseCadastro[]
  veiculos: VeiculoCadastro[]
  colaboradores: ColaboradorCadastro[]
  rotas: RotaCadastro[]
}

export type EntradaVeiculo = {
  placa: string
  marca: string | null
  modelo: string | null
  ano: string | null
  baseId: string
  ativo: boolean
}

export type EntradaColaborador = {
  nome: string
  cargo: string | null
  funcao: FuncaoColaborador
  admissao: string | null
  baseId: string
  ativo: boolean
}

export type EntradaRota = {
  nome: string
  baseId: string
  local: boolean
  ativo: boolean
}

export type EntradaBase = {
  nome: string
  ativo: boolean
}

/** O status viaja junto porque 409 e erro de campo e 403 e aviso de tela. */
export class FalhaDeCadastro extends Error {
  constructor(message: string, readonly status: number) {
    super(message)
  }
}

type Chamar = typeof fetch

async function pedirJson<T>(caminho: string, init: RequestInit, chamar: Chamar): Promise<T> {
  const resposta = await chamar(caminho, init)
  if (!resposta.ok) {
    const falha = (await resposta.json().catch(() => null)) as { erro?: string } | null
    throw new FalhaDeCadastro(falha?.erro ?? `pedido recusado com ${resposta.status}`, resposta.status)
  }
  return (await resposta.json()) as T
}

async function gravar<T>(
  caminho: string,
  id: string | null,
  corpo: unknown,
  chamar: Chamar,
): Promise<T> {
  return await pedirJson(
    id ? `/api/cadastro/${caminho}/${encodeURIComponent(id)}` : `/api/cadastro/${caminho}`,
    {
      method: id ? 'PUT' : 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(corpo),
    },
    chamar,
  )
}

/** `todos` traz tambem o inativo, que a tela precisa mostrar para reativar. */
export async function obterCadastro(
  todos = false,
  chamar: Chamar = fetch,
): Promise<CatalogoCadastro> {
  return await pedirJson(todos ? '/api/cadastro?todos=1' : '/api/cadastro', {}, chamar)
}

export async function criarVeiculo(
  entrada: EntradaVeiculo,
  chamar: Chamar = fetch,
): Promise<VeiculoCadastro> {
  return await gravar('veiculos', null, entrada, chamar)
}

export async function atualizarVeiculo(
  id: string,
  entrada: EntradaVeiculo,
  chamar: Chamar = fetch,
): Promise<VeiculoCadastro> {
  return await gravar('veiculos', id, entrada, chamar)
}

export async function criarColaborador(
  entrada: EntradaColaborador,
  chamar: Chamar = fetch,
): Promise<ColaboradorCadastro> {
  return await gravar('colaboradores', null, entrada, chamar)
}

export async function atualizarColaborador(
  id: string,
  entrada: EntradaColaborador,
  chamar: Chamar = fetch,
): Promise<ColaboradorCadastro> {
  return await gravar('colaboradores', id, entrada, chamar)
}

export async function criarRota(
  entrada: EntradaRota,
  chamar: Chamar = fetch,
): Promise<RotaCadastro> {
  return await gravar('rotas', null, entrada, chamar)
}

export async function atualizarRota(
  id: string,
  entrada: EntradaRota,
  chamar: Chamar = fetch,
): Promise<RotaCadastro> {
  return await gravar('rotas', id, entrada, chamar)
}

export async function criarBase(
  entrada: EntradaBase,
  chamar: Chamar = fetch,
): Promise<BaseCadastro> {
  return await gravar('bases', null, entrada, chamar)
}

export async function atualizarBase(
  id: string,
  entrada: EntradaBase,
  chamar: Chamar = fetch,
): Promise<BaseCadastro> {
  return await gravar('bases', id, entrada, chamar)
}
