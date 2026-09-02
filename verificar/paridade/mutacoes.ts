/**
 * Uma prova que nunca ficou vermelha nao provou nada. Cada linha aqui estraga a tela
 * de um jeito que a paridade TEM que pegar, e `--mutar` reprova se alguma passar.
 *
 * A revisao da fase 2 achou exatamente este buraco trocando `gap:5px` por `gap:50px`
 * num template do modal: a prova de entao passou verde. As duas mutacoes abaixo sao
 * as duas familias que interessam, o pixel que muda sem ninguem declarar e o handler
 * que some do escopo global e transforma o botao em enfeite.
 *
 * A cada tela portada, a linha dela passa a apontar para o `.tsx`.
 */
import type { Tela } from './palco.ts'

export type Mutacao = {
  readonly tela: Tela
  /** Caminho a partir da raiz do repositorio. */
  readonly arquivo: string
  /** Tem que existir e aparecer uma unica vez, senao a mutacao para em erro. */
  readonly de: string
  readonly para: string
  /** O que a prova estaria deixando passar se esta mutacao nao reprovasse. */
  readonly motivo: string
}

export const MUTACOES: readonly Mutacao[] = [
  {
    tela: 'documentos-frota',
    arquivo: 'apps/web/src/js/documentos-frota.ts',
    de: '<div style="display:flex;gap:6px;">',
    para: '<div style="display:flex;gap:60px;">',
    motivo:
      'o espacamento dos botoes do manual mudou dez vezes de tamanho e ninguem declarou; e o markup que nasce dentro do modulo, que nenhuma comparacao de arquivo enxerga',
  },
  {
    tela: 'documentos-frota',
    arquivo: 'apps/web/src/js/documentos-frota.ts',
    de: '  abrirModalVeiculo,\n',
    para: '',
    motivo:
      'o handler sumiu de `window` e o botao de editar virou clique que nao faz nada; a tela abre, pinta certo, e so o console reclama',
  },
]
