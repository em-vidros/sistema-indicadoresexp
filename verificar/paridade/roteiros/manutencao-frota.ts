/**
 * `salvarPlano` grava sempre no mesmo `PUT /api/preventiva/<veiculoId>`, e o palco
 * responde com o mesmo corpo para qualquer chamada aquela URL. Por isso os passos
 * `adicionarItemConfig` e `removerItem` abrem o modal de DOIS veiculos diferentes
 * (PTV0006 para acrescentar, PTT0004 para remover): cada um tem sua propria chave de
 * fixture, entao o item que "some" depois do `removerItem` e mesmo o que a fixture diz
 * que sumiu, e nao um artefato de reusar a resposta do outro veiculo.
 *
 * O que foi acrescentado a mao na fixture, e por que. `GET /api/preventiva` e
 * `GET /api/registros?base=Raposa` saem do servidor de dev; a base real nao tem
 * nenhum registro de manutencao e todo item preventivo cai em "ok" (o km atual do PGQ
 * bate com o `ultimo_km` cadastrado, entao o restante e sempre o intervalo inteiro).
 * Cinco ramos foram acrescentados:
 *   1. Tres registros de manutencao na Raposa (duas corretivas, uma preventiva, uma
 *      com documento pendente e outra concluido) para a aba Corretivas e o Historico
 *      nao ficarem vazios nem mostrarem so uma cor de tarja.
 *   2. O item "Manutenção Preventiva Geral" de PTV0006 ganhou `alerta_km: 21000`
 *      (o intervalo e 20000; a folga de 1000 km absorve o registro de manutencao do
 *      item 1, que muda o km atual calculado pela tela) para cair em "alerta".
 *   3. O mesmo item em PTT0004 teve o `ultimo_km` abaixado para 300000, bem atras do
 *      km atual, para cair em "vencida".
 *   4. ROW3A87 ganhou um item novo, "Troca de óleo", sem `ultimo_km`, para o card
 *      desenhar o ramo "sem_dado" (traco no lugar do km restante).
 *   5. `GET /api/registros?base=Imperatriz` foi acrescentado vazio, so para o passo
 *      `base-trocada` ter o que responder.
 * As respostas de `PUT /api/preventiva/<id>` para PTV0006 e PTT0004, e o
 * `POST /api/registros` do import, nao existem na base real pelo mesmo motivo do
 * roteiro de atas: sao o formato de resposta do endpoint, escritas a mao.
 */
import { lerFixtures, type Roteiro } from '../palco.ts'

export const manutencaoFrota: Roteiro = {
  tela: 'manutencao-frota',
  url: '/manutencao-frota.html',
  agora: '2026-09-02T12:00:00-03:00',
  fixtures: await lerFixtures('manutencao-frota'),
  passos: [
    {
      nome: 'inicial',
      cobre: [],
      agir: async () => {},
    },
    {
      nome: 'config-aberto',
      cobre: ['abrirConfig'],
      agir: async (p) => {
        await p.click(`[onclick="abrirConfig('PTV0006')"]`)
      },
    },
    {
      nome: 'config-item-adicionado',
      cobre: ['adicionarItemConfig'],
      agir: async (p) => {
        await p.selectOption('#novoTipo', 'Alinhamento/Balanceamento')
        await p.fill('#novoIntervalo', '15000')
        await p.fill('#novoAlerta', '500')
        await p.click('[onclick="adicionarItemConfig()"]')
      },
    },
    {
      nome: 'config-modal-fechado',
      cobre: ['fecharModalConfig'],
      agir: async (p) => {
        await p.click('#modalConfig .modal-close')
      },
    },
    {
      nome: 'config-ptt0004-aberto',
      cobre: [],
      agir: async (p) => {
        await p.click(`[onclick="abrirConfig('PTT0004')"]`)
      },
    },
    {
      nome: 'config-item-removido',
      cobre: ['removerItem'],
      agir: async (p) => {
        await p.click('#il_0 .btn-del')
      },
    },
    {
      nome: 'config-salvo',
      cobre: ['salvarConfig'],
      agir: async (p) => {
        await p.click('[onclick="salvarConfig()"]')
      },
    },
    {
      nome: 'import-aberto',
      cobre: ['abrirImport'],
      agir: async (p) => {
        await p.click('[onclick="abrirImport()"]')
      },
    },
    {
      nome: 'import-cancelado',
      cobre: ['fecharModalImport'],
      agir: async (p) => {
        await p.click('[onclick="fecharModalImport()"]')
      },
    },
    {
      nome: 'import-reaberto',
      cobre: [],
      agir: async (p) => {
        await p.click('[onclick="abrirImport()"]')
      },
    },
    {
      nome: 'import-processado',
      cobre: ['processarImport'],
      agir: async (p) => {
        const csv = [
          'data,placa,base,tipo,servico,valor,fornecedor,km',
          '2026-08-15,PTV0006,Raposa,corretiva,Troca de pastilha de freio,320.00,Oficina Raposa,407000',
        ].join('\n')
        await p.setInputFiles('#importFile', {
          name: 'historico-manutencao.csv',
          mimeType: 'text/csv',
          buffer: Buffer.from(csv),
        })
      },
    },
    {
      nome: 'import-confirmado',
      cobre: ['confirmarImport'],
      agir: async (p) => {
        await p.click('#btnConfirmarImport')
      },
    },
    {
      nome: 'aba-corretivas',
      cobre: ['mudarAba'],
      agir: async (p) => {
        await p.click('#tabCorretivas')
      },
    },
    {
      nome: 'aba-historico-filtrada',
      cobre: ['renderHistorico'],
      agir: async (p) => {
        await p.click('#tabHistorico')
        await p.selectOption('#filtroTipoHistorico', 'corretiva')
      },
    },
    {
      nome: 'base-trocada',
      cobre: ['selecionarBase'],
      agir: async (p) => {
        await p.click('#chipImperatriz')
      },
    },
    {
      nome: 'aba-preventivas-restaurada',
      cobre: [],
      agir: async (p) => {
        await p.click('#tabPreventivas')
      },
    },
    {
      nome: 'ir-para-registro',
      cobre: ['irParaRegistro'],
      agir: async (p) => {
        await p.click(`[onclick="irParaRegistro('DMG9D41')"]`)
      },
    },
  ],
}
