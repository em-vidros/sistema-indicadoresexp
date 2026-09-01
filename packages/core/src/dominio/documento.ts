import { z } from 'zod'
import { ArquivoId, BaseId, ColaboradorId, DocumentoId, VeiculoId } from './ids.ts'
import { DataISO } from './tempo.ts'

const LINK_ABSOLUTO = /^https?:\/\/\S+$/
// Sem espaco e sem esquema. Passa 'docs/manual-atego.pdf' e barra 'javascript:...'.
const CAMINHO_RELATIVO = /^[^\s:]+$/

/**
 * `z.url()` recusaria os caminhos que os proprios literais de origem guardam:
 * `MANUAIS_RAPOSA[].url` e `'docs/manual-atego.pdf'` (documentos-frota.html,
 * linhas 234 a 237) e `PLANOS[].url` e `'docs/pgq-manutencao-2026.pdf'` (linha
 * 242). O seed quebraria antes da primeira linha.
 */
const link = z
  .string()
  .trim()
  .refine(
    (v) => LINK_ABSOLUTO.test(v) || CAMINHO_RELATIVO.test(v),
    'link deve ser URL http(s) ou caminho relativo',
  )

/**
 * Arquivo e link convivem, e nao sao alternativa um do outro. `salvarDoc`, nas
 * linhas 673 a 689 de documentos-frota.html, grava `link` e `pdfB64` juntos para
 * seguro, tacografo e CRLV, e a leitura da linha 634 e
 * `d.crlv?.pdfB64 || d.crlv?.link`. O `CHECK` do banco tambem e `OR`. Modelar como
 * uniao exclusiva fazia o zod descartar o campo extra em silencio, e o link do
 * Drive sumia.
 *
 * `.strict()` porque o descarte silencioso vale aqui tambem: `{ arquivo, link,
 * pdfB64 }` perdia o terceiro campo e voltava sucesso.
 */
export const Fonte = z
  .strictObject({ arquivo: ArquivoId.nullable(), link: link.nullable() })
  .refine((f) => f.arquivo !== null || f.link !== null, 'documento sem arquivo e sem link')
export type Fonte = z.infer<typeof Fonte>

/**
 * A tela guarda `''` quando o campo nao foi preenchido: a categoria tem
 * `<option value="">—</option>` na linha 651 e a renderizacao da linha 468 e
 * `${cnh.categoria||'—'} · ${cnh.numero||'—'}`. Vazio e ausencia, e vira nulo.
 */
const textoOpcional = z
  .string()
  .trim()
  .nullable()
  .transform((s) => (s === null || s === '' ? null : s))

const comum = {
  id: DocumentoId,
  fonte: Fonte,
  atualizadoEm: DataISO,
}

/**
 * O vencimento e nulavel nos quatro tipos que vencem, porque a origem nao tem o
 * dado: `grep -c tacografo_venc documentos-frota.html` devolve 0, e os 7
 * tacografos que o sistema ja entrega nao tem data nenhuma. Exigir a data aqui
 * impediria de semear o que existe hoje.
 *
 * Seis coisas que a tela trata como uma so. Sem a uniao,
 * `{ tipo: 'plano_pgq', vencimento: '2026-12-01', cnhNumero: '123' }` grava. Os
 * literais `MANUAIS_RAPOSA` e `PLANOS` nao tem campo de vencimento, e por isso
 * manual e plano_pgq nao ganham um aqui nem nulavel.
 *
 * Cada membro e `strictObject`, e nao `object`. O padrao do zod e `strip`: a
 * chave que nao pertence ao tipo some e o parse devolve sucesso, entao o exemplo
 * de cima passava e a uniao nao guardava nada. Com `strict` o parse falha
 * nomeando a chave (`Unrecognized key: "cnhNumero"`).
 *
 * `seguradora` entra na apolice pelo mesmo motivo, ao contrario: e coluna real,
 * com o `documento_seguradora_ck` a prendendo em 'apolice', e sem ela declarada o
 * `strip` descartava o valor que o chamador mandou. Nos outros cinco tipos ela
 * continua sendo chave desconhecida, que e o que o CHECK diz.
 */
export const Documento = z.discriminatedUnion('tipo', [
  z.strictObject({
    ...comum,
    tipo: z.literal('apolice'),
    veiculo: VeiculoId,
    seguradora: textoOpcional,
    vencimento: DataISO.nullable(),
  }),
  z.strictObject({
    ...comum,
    tipo: z.literal('crlv'),
    veiculo: VeiculoId,
    vencimento: DataISO.nullable(),
  }),
  z.strictObject({
    ...comum,
    tipo: z.literal('tacografo'),
    veiculo: VeiculoId,
    vencimento: DataISO.nullable(),
  }),
  z.strictObject({
    ...comum,
    tipo: z.literal('cnh'),
    colaborador: ColaboradorId,
    vencimento: DataISO.nullable(),
    numero: textoOpcional,
    categoria: textoOpcional,
  }),
  z.strictObject({
    ...comum,
    tipo: z.literal('manual'),
    veiculos: z.array(VeiculoId).min(1, 'manual sem veiculo').readonly(),
  }),
  z.strictObject({ ...comum, tipo: z.literal('plano_pgq'), base: BaseId }),
])
export type Documento = z.infer<typeof Documento>

export type TipoDocumento = Documento['tipo']

export function venceEm(d: Documento): DataISO | null {
  switch (d.tipo) {
    case 'apolice':
    case 'crlv':
    case 'tacografo':
    case 'cnh':
      return d.vencimento
    case 'manual':
    case 'plano_pgq':
      return null
  }
}
