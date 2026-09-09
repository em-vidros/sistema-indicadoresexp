/**
 * Usuarios: quem entra no sistema, com que papel e em que base.
 *
 * Antes disto a administracao de gente era um dialogo escondido no menu de Registrar, e
 * ele so sabia editar quem ja existia. Nascer alguem novo era ir no banco. Aqui a lista
 * inteira e uma tela, e o cadastro dela nao pede senha: ele devolve um link de primeiro
 * acesso, e a pessoa escolhe a propria senha ao abrir o link. Senha digitada por um
 * terceiro chega na pessoa por WhatsApp e fica sabida por dois; o link nao.
 *
 * Por isso o link e um estado do dialogo e nao um aviso de canto de tela: ele aparece uma
 * vez, e quem cadastrou tem que conseguir copiar antes de fechar. Perdido, o caminho e
 * gerar outro pelo menu da linha.
 *
 * A base fixa vive dentro do `Posto` de `usuarios-api.ts`, que e uma uniao, e a tela
 * respeita o mesmo invariante enquanto a pessoa escolhe: papel admin troca o campo de base
 * por um calculado escrito "Todas as bases", com o cadeado. O campo nao some, porque campo
 * que some faz o dialogo pular e deixa a duvida de para onde foi a base.
 *
 * O desenho e o da tela de Cadastro, e de proposito: as duas sao lista com busca, selo de
 * estado, menu por linha e dialogo de edicao. O que falta aqui, e falta por nao precisar,
 * e paginacao; sao poucas pessoas, e vinte por pagina nunca chegaria a virar duas.
 *
 * A checagem de capacidade esta aqui dentro porque o roteador de `app/main.tsx` ainda nao
 * filtra por `exige`. O lugar certo dela e la, numa linha; enquanto isso a tela recusa a si
 * mesma com a mesma cara de rota desconhecida.
 */
import { useState } from 'react'
import type { JSX, ReactNode } from 'react'
import { invalidar, useRecurso, useSessao } from '../app/dados.ts'
import { Ligacao } from '../app/navegacao.tsx'
import { Caixa, Campo, Dialogo, GradeDeCampos, TituloDeSecao, useAvisos } from '../geist/formulario.tsx'
import { Copy, Icone, MagnifyingGlass, MoreHorizontal, Plus, Users } from '../geist/icones.tsx'
import {
  Badge,
  Botao,
  CabecalhoDeBloco,
  CabecalhoDePagina,
  Entrada,
  Esqueleto,
  Estatistica,
  Grade,
  Menu,
  Tabela,
  Td,
  Th,
  Vazio,
} from '../geist/primitivos.tsx'
import type { Opcao } from '../geist/primitivos.tsx'
import { obterCadastro } from '../js/cadastro-api.ts'
import {
  FalhaDeUsuarios,
  apagarUsuario,
  criarUsuario,
  gerarConvite,
  listarUsuarios,
  salvarUsuarios,
} from '../js/usuarios-api.ts'
import type { Convite, MudancaDeUsuario, Papel, Posto, UsuarioListado } from '../js/usuarios-api.ts'

const ROTULO_DO_PAPEL: Readonly<Record<Papel, string>> = {
  admin: 'Administrador',
  gestor: 'Gestor',
  operador: 'Operador',
}

const PAPEIS = Object.keys(ROTULO_DO_PAPEL) as readonly Papel[]

const OPCOES_DE_PAPEL: readonly Opcao<string>[] = PAPEIS.map((papel) => ({
  valor: papel,
  rotulo: ROTULO_DO_PAPEL[papel],
}))

/** Os mesmos quatro tipos de lancamento de Registrar rota, que e quem le esta permissao. */
const ROTULO_DO_TIPO: Readonly<Record<string, string>> = {
  viagem: 'Viagem',
  abastecimento: 'Abastecimento',
  manutencao: 'Manutenção',
  quebra: 'Quebra',
}

const TIPOS = Object.keys(ROTULO_DO_TIPO)

const AUSENTE = <span className="g-fraco">·</span>

/** O que o dialogo edita. `senha` so existe na edicao, e vazia quer dizer "nao mexe". */
type Rascunho = {
  readonly usuario: string
  readonly nome: string
  readonly papel: Papel
  /** Guardada mesmo com papel admin, para voltar atras nao apagar a escolha de antes. */
  readonly baseFixa: string
  readonly bases: readonly string[]
  readonly tipos: readonly string[]
  readonly senha: string
}

/** A recusa que cabe embaixo de um campo. As outras viram aviso de canto de tela. */
type Erro = { readonly campo: 'usuario' | 'baseFixa'; readonly texto: string }

/**
 * O que esta aberto por cima da lista. Sendo uniao, o link de convite nao consegue
 * conviver com o formulario meio preenchido que o gerou.
 */
type Aberto =
  | { readonly tipo: 'novo'; readonly rascunho: Rascunho; readonly erro: Erro | undefined }
  | { readonly tipo: 'editar'; readonly login: string; readonly rascunho: Rascunho; readonly erro: Erro | undefined }
  | { readonly tipo: 'convite'; readonly usuario: string; readonly convite: Convite }
  | { readonly tipo: 'apagar'; readonly usuario: string }

const NOVO: Rascunho = {
  usuario: '',
  nome: '',
  papel: 'operador',
  baseFixa: '',
  bases: [],
  tipos: [...TIPOS],
  senha: '',
}

function rascunhoDe(pessoa: UsuarioListado): Rascunho {
  return {
    usuario: pessoa.usuario,
    nome: pessoa.nome,
    papel: pessoa.papel,
    baseFixa: pessoa.baseFixa ?? '',
    bases: pessoa.bases,
    tipos: pessoa.tipos,
    senha: '',
  }
}

/** O par que o servidor aceita, ou nada quando falta a base fixa de gestor e operador. */
function postoDe(rascunho: Rascunho): Posto | null {
  if (rascunho.papel === 'admin') return { papel: 'admin' }
  const base = rascunho.baseFixa.trim()
  return base === '' ? null : { papel: rascunho.papel, baseFixa: base }
}

function alternar(lista: readonly string[], item: string, marcado: boolean): readonly string[] {
  return marcado ? [...lista, item] : lista.filter((cada) => cada !== item)
}

function juntar(partes: readonly string[]): ReactNode {
  return partes.length === 0 ? AUSENTE : partes.join(' · ')
}

/** O `expiraEm` chega como instante ISO, e quem le o link so precisa do dia. */
function diaDe(iso: string): string {
  const quando = new Date(iso)
  return Number.isNaN(quando.getTime()) ? iso : quando.toLocaleDateString('pt-BR')
}

function contar(quantos: number, singular: string, plural: string): string {
  return `${quantos} ${quantos === 1 ? singular : plural}`
}

/** O selo da coluna Acesso: definiu a senha, tem link em aberto, ou nao tem nem link. */
function acessoDe(pessoa: UsuarioListado): JSX.Element {
  if (pessoa.senhaDefinida) return <Badge rotulo="Ativo" cor="verde" />
  if (pessoa.conviteAberto) return <Badge rotulo="Convite aberto" cor="ambar" />
  return <Badge rotulo="Sem acesso" cor="vermelho" />
}

/** A mesma cara da rota desconhecida de `app/main.tsx`, para quem nao gerencia usuarios. */
function RotaDesconhecida(): JSX.Element {
  return (
    <>
      <CabecalhoDePagina titulo="Página não encontrada" subtitulo={window.location.pathname} acoes={null} />
      <Vazio
        icone={MagnifyingGlass}
        titulo="Não há nada neste endereço"
        texto="O link pode estar velho, ou a tela pode ter mudado de caminho."
        acao={<Ligacao className="g-botao g-botao-primario" para="/registrar">Ir para Registrar rota</Ligacao>}
      />
    </>
  )
}

function Campos({ rascunho, erro, edicao, bases, mudar }: {
  readonly rascunho: Rascunho
  readonly erro: Erro | undefined
  /** Na edicao o login e chave e nao se digita, e a senha entra como troca na mao. */
  readonly edicao: boolean
  readonly bases: readonly Opcao<string>[]
  readonly mudar: (rascunho: Rascunho) => void
}): JSX.Element {
  // `exactOptionalPropertyTypes` recusa `erro={undefined}`, entao a prop entra por spread.
  const noCampo = (campo: Erro['campo']): { erro?: string } =>
    erro?.campo === campo ? { erro: erro.texto } : {}

  return (
    <>
      <GradeDeCampos>
        {edicao
          ? (
            <Campo
              rotulo="Senha"
              span={6}
              dica="Deixe em branco para não mudar"
              valor={rascunho.senha}
              aoMudar={(senha) => mudar({ ...rascunho, senha })}
            />
          )
          : (
            <Campo
              rotulo="Usuário"
              span={6}
              mono
              obrigatorio
              dica="marcos"
              valor={rascunho.usuario}
              {...noCampo('usuario')}
              aoMudar={(valor) => mudar({ ...rascunho, usuario: valor.trim().toLowerCase() })}
            />
          )}
        <Campo
          rotulo="Nome"
          span={6}
          obrigatorio
          valor={rascunho.nome}
          aoMudar={(nome) => mudar({ ...rascunho, nome })}
        />
        <Campo
          rotulo="Papel"
          tipo="select"
          span={6}
          obrigatorio
          valor={rascunho.papel}
          opcoes={OPCOES_DE_PAPEL}
          aoMudar={(valor) => mudar({ ...rascunho, papel: valor as Papel })}
        />
        {rascunho.papel === 'admin'
          ? <Campo rotulo="Base fixa" tipo="calculado" span={6} valor="Todas as bases" />
          : (
            <Campo
              rotulo="Base fixa"
              tipo="select"
              span={6}
              obrigatorio
              dica="Escolha a base"
              valor={rascunho.baseFixa}
              opcoes={bases}
              {...noCampo('baseFixa')}
              aoMudar={(baseFixa) => mudar({ ...rascunho, baseFixa })}
            />
          )}
      </GradeDeCampos>

      <TituloDeSecao
        titulo="Bases"
        subtitulo="O que o seletor da barra lateral oferece a esta pessoa"
        direita={
          <div className="g-chips">
            {bases.map((base) => (
              <Caixa
                key={base.valor}
                rotulo={base.rotulo}
                marcado={rascunho.bases.includes(base.rotulo)}
                aoMudar={(marcado) => mudar({ ...rascunho, bases: alternar(rascunho.bases, base.rotulo, marcado) })}
              />
            ))}
          </div>
        }
      />

      <TituloDeSecao
        titulo="Tipos de registro"
        subtitulo="As abas que aparecem em Registrar rota"
        direita={
          <div className="g-chips">
            {TIPOS.map((tipo) => (
              <Caixa
                key={tipo}
                rotulo={ROTULO_DO_TIPO[tipo] ?? tipo}
                marcado={rascunho.tipos.includes(tipo)}
                aoMudar={(marcado) => mudar({ ...rascunho, tipos: alternar(rascunho.tipos, tipo, marcado) })}
              />
            ))}
          </div>
        }
      />
    </>
  )
}

export default function Usuarios(): JSX.Element {
  const sessao = useSessao()
  const lista = useRecurso('usuarios', listarUsuarios)
  const catalogo = useRecurso('cadastro', () => obterCadastro())
  const { avisar } = useAvisos()
  const [busca, setBusca] = useState('')
  const [aberto, setAberto] = useState<Aberto | null>(null)
  const [trabalhando, setTrabalhando] = useState(false)

  if (sessao.dados === null) return <Esqueleto />
  if (!sessao.dados.capacidades.gerenciaUsuarios) return <RotaDesconhecida />

  const pessoas = lista.dados
  if (pessoas === null) {
    if (lista.estado === 'carregando') return <Esqueleto />
    return (
      <Vazio
        icone={Users}
        titulo="A lista de usuários não carregou"
        texto="Quem entra no sistema e com que papel não chegou."
        acao={<Botao rotulo="Tentar de novo" aoClicar={lista.recarregar} />}
      />
    )
  }

  const bases: readonly Opcao<string>[] = (catalogo.dados?.bases ?? [])
    .filter((base) => base.ativo)
    .map((base) => ({ valor: base.nome, rotulo: base.nome }))

  const alvo = busca.trim().toLowerCase()
  const achadas = pessoas.filter((pessoa) => {
    if (alvo === '') return true
    const texto = `${pessoa.usuario} ${pessoa.nome} ${ROTULO_DO_PAPEL[pessoa.papel]} ${pessoa.baseFixa ?? ''} ${pessoa.bases.join(' ')}`
    return texto.toLowerCase().includes(alvo)
  })

  const porPapel = PAPEIS
    .map((papel) => ({ papel, quantos: pessoas.filter((pessoa) => pessoa.papel === papel).length }))
    .filter((par) => par.quantos > 0)
    .map((par) => `${par.quantos} ${ROTULO_DO_PAPEL[par.papel].toLowerCase()}`)
  const comSenha = pessoas.filter((pessoa) => pessoa.senhaDefinida).length
  const semSenha = pessoas.length - comSenha
  const convitesAbertos = pessoas.filter((pessoa) => pessoa.conviteAberto).length

  const fechar = (): void => {
    setTrabalhando(false)
    setAberto(null)
  }

  const recarregar = (): void => {
    invalidar('usuarios')
    // O nome e o papel de quem esta mexendo podem ser os proprios, e a barra lateral
    // desenha os dois a partir da sessao.
    invalidar('sessao')
  }

  const falhar = (motivo: unknown, campo: Erro['campo'] | null): void => {
    setTrabalhando(false)
    const texto = motivo instanceof Error ? motivo.message : 'não foi possível salvar'
    if (campo !== null && motivo instanceof FalhaDeUsuarios && motivo.status === 409) {
      setAberto((atual) =>
        atual === null || (atual.tipo !== 'novo' && atual.tipo !== 'editar')
          ? atual
          : { ...atual, erro: { campo, texto } }
      )
      return
    }
    avisar(texto, 'erro')
  }

  const semBaseFixa = (): void => {
    setAberto((atual) =>
      atual === null || (atual.tipo !== 'novo' && atual.tipo !== 'editar')
        ? atual
        : { ...atual, erro: { campo: 'baseFixa', texto: 'Gestor e operador precisam de uma base fixa.' } }
    )
  }

  const criar = (rascunho: Rascunho): void => {
    const posto = postoDe(rascunho)
    if (posto === null) {
      semBaseFixa()
      return
    }
    setTrabalhando(true)
    void criarUsuario({
      ...posto,
      usuario: rascunho.usuario,
      nome: rascunho.nome.trim(),
      bases: rascunho.bases,
      tipos: rascunho.tipos,
    }).then(
      (criado) => {
        recarregar()
        setTrabalhando(false)
        setAberto({ tipo: 'convite', usuario: criado.usuario, convite: criado.convite })
      },
      (motivo: unknown) => falhar(motivo, 'usuario'),
    )
  }

  const editar = (login: string, rascunho: Rascunho): void => {
    const posto = postoDe(rascunho)
    if (posto === null) {
      semBaseFixa()
      return
    }
    const mudanca: MudancaDeUsuario = {
      usuario: login,
      nome: rascunho.nome.trim(),
      papel: posto.papel,
      baseFixa: posto.papel === 'admin' ? null : posto.baseFixa,
      bases: rascunho.bases,
      tipos: rascunho.tipos,
      // Senha vazia quer dizer "nao muda". Mandar vazio apagaria a senha da pessoa.
      ...(rascunho.senha === '' ? {} : { senha: rascunho.senha }),
    }
    setTrabalhando(true)
    void salvarUsuarios([mudanca]).then(
      () => {
        recarregar()
        fechar()
        avisar(`${login} atualizado`)
      },
      (motivo: unknown) => falhar(motivo, null),
    )
  }

  const novoLink = (login: string): void => {
    void gerarConvite(login).then(
      (convite) => {
        recarregar()
        setAberto({ tipo: 'convite', usuario: login, convite })
      },
      (motivo: unknown) => falhar(motivo, null),
    )
  }

  const apagar = (login: string): void => {
    setTrabalhando(true)
    void apagarUsuario(login).then(
      () => {
        recarregar()
        fechar()
        avisar(`${login} apagado`)
      },
      (motivo: unknown) => falhar(motivo, null),
    )
  }

  const copiar = (link: string): void => {
    const area = navigator.clipboard
    if (area === undefined) {
      avisar('Este navegador não deixa copiar daqui. Selecione o link e copie na mão.', 'erro')
      return
    }
    void area.writeText(link).then(
      () => avisar('Link copiado'),
      () => avisar('Não consegui copiar. Selecione o link e copie na mão.', 'erro'),
    )
  }

  const colunas = ['Usuário', 'Nome', 'Papel', 'Base fixa', 'Bases', 'Tipos', 'Acesso', '']

  const bloco = (
    <>
      <CabecalhoDeBloco
        titulo="Usuários"
        subtitulo="O papel decide o que a pessoa vê; a base fixa decide onde ela trabalha"
      />
      {achadas.length === 0
        ? (
          <Vazio
            icone={Users}
            titulo="Ninguém com este recorte"
            texto="Nenhum usuário bate com a busca. Cadastre alguém ou limpe a busca."
          />
        )
        : (
          <Tabela cabecalho={colunas.map((coluna, i) => <Th key={i}>{coluna}</Th>)}>
            {achadas.map((pessoa) => (
              <tr key={pessoa.usuario}>
                <Td><span className="g-l13m g-forte">{pessoa.usuario}</span></Td>
                <Td>{pessoa.nome === '' ? AUSENTE : pessoa.nome}</Td>
                <Td>{ROTULO_DO_PAPEL[pessoa.papel]}</Td>
                <Td>{pessoa.baseFixa ?? <span className="g-fraco">Todas as bases</span>}</Td>
                <Td>{juntar(pessoa.bases)}</Td>
                <Td>{juntar(pessoa.tipos.map((tipo) => ROTULO_DO_TIPO[tipo] ?? tipo))}</Td>
                <Td>{acessoDe(pessoa)}</Td>
                <Td>
                  <Menu
                    aparencia="quadrado"
                    nome="Ações da linha"
                    gatilho={<Icone de={MoreHorizontal} />}
                    itens={[
                      {
                        rotulo: 'Editar',
                        aoEscolher: () =>
                          setAberto({
                            tipo: 'editar',
                            login: pessoa.usuario,
                            rascunho: rascunhoDe(pessoa),
                            erro: undefined,
                          }),
                      },
                      { rotulo: 'Gerar link de acesso', aoEscolher: () => novoLink(pessoa.usuario) },
                      { rotulo: 'Apagar', aoEscolher: () => setAberto({ tipo: 'apagar', usuario: pessoa.usuario }) },
                    ]}
                  />
                </Td>
              </tr>
            ))}
          </Tabela>
        )}
    </>
  )

  return (
    <>
      <CabecalhoDePagina
        titulo="Usuários"
        subtitulo="Quem entra no sistema, com que papel e em que base"
        acoes={
          <>
            <Entrada
              marcador="Buscar login, nome ou base"
              largura={280}
              valor={busca}
              aoDigitar={setBusca}
            />
            <Botao
              rotulo="Novo usuário"
              tipo="primario"
              antes={Plus}
              aoClicar={() => setAberto({ tipo: 'novo', rascunho: NOVO, erro: undefined })}
            />
          </>
        }
      />

      <Grade
        celulas={[
          {
            col: [1, 5],
            linha: 1,
            conteudo: (
              <Estatistica
                rotulo="Usuários"
                valor={String(pessoas.length)}
                apoio={porPapel.length === 0 ? 'Ninguém cadastrado' : porPapel.join(' · ')}
              />
            ),
          },
          {
            col: [5, 9],
            linha: 1,
            conteudo: (
              <Estatistica
                rotulo="Já entraram"
                valor={String(comSenha)}
                apoio={semSenha === 0
                  ? 'Todo mundo já definiu a senha'
                  : `${contar(semSenha, 'pessoa ainda não definiu', 'pessoas ainda não definiram')} a senha`}
              />
            ),
          },
          {
            col: [9, 13],
            linha: 1,
            conteudo: (
              <Estatistica
                rotulo="Convites abertos"
                valor={String(convitesAbertos)}
                apoio={convitesAbertos === 0
                  ? 'Nenhum link de primeiro acesso em aberto'
                  : 'Link gerado, ainda válido e ainda não usado'}
              />
            ),
          },
          { col: [1, 13], linha: 2, rente: true, conteudo: bloco },
        ]}
      />

      {aberto?.tipo === 'novo' || aberto?.tipo === 'editar'
        ? (
          <Dialogo
            aberto
            titulo={aberto.tipo === 'novo' ? 'Novo usuário' : 'Editar usuário'}
            subtitulo={aberto.tipo === 'editar' ? aberto.login : 'Sem senha: quem escolhe a dela é a própria pessoa'}
            largura={640}
            aoFechar={fechar}
            acoes={
              <>
                <Botao rotulo="Cancelar" aoClicar={fechar} />
                <Botao
                  rotulo={aberto.tipo === 'novo' ? 'Cadastrar' : 'Salvar'}
                  tipo="primario"
                  carregando={trabalhando}
                  aoClicar={() => {
                    if (aberto.tipo === 'novo') criar(aberto.rascunho)
                    else editar(aberto.login, aberto.rascunho)
                  }}
                />
              </>
            }
          >
            <Campos
              rascunho={aberto.rascunho}
              erro={aberto.erro}
              edicao={aberto.tipo === 'editar'}
              bases={bases}
              mudar={(rascunho) => setAberto({ ...aberto, rascunho, erro: undefined })}
            />
          </Dialogo>
        )
        : null}

      {aberto?.tipo === 'convite'
        ? (
          <Dialogo
            aberto
            titulo="Link de primeiro acesso"
            subtitulo={aberto.usuario}
            largura={640}
            aoFechar={fechar}
            acoes={
              <>
                <Botao rotulo="Fechar" aoClicar={fechar} />
                <Botao
                  rotulo="Copiar link"
                  tipo="primario"
                  antes={Copy}
                  aoClicar={() => copiar(window.location.origin + aberto.convite.url)}
                />
              </>
            }
          >
            <GradeDeCampos>
              <Campo
                rotulo="Link"
                tipo="calculado"
                span={12}
                mono
                valor={window.location.origin + aberto.convite.url}
              />
            </GradeDeCampos>
            <TituloDeSecao
              titulo="Mande o link para a pessoa"
              subtitulo={`Ele vale até ${diaDe(aberto.convite.expiraEm)}, e quem abrir escolhe a própria senha. Este link aparece uma vez só; perdido, gere outro pelo menu da linha.`}
            />
          </Dialogo>
        )
        : null}

      {aberto?.tipo === 'apagar'
        ? (
          <Dialogo
            aberto
            titulo="Apagar usuário"
            subtitulo={aberto.usuario}
            aoFechar={fechar}
            acoes={
              <>
                <Botao tipo="terciario" rotulo="Cancelar" aoClicar={fechar} />
                <Botao
                  tipo="primario"
                  rotulo="Apagar usuário"
                  carregando={trabalhando}
                  aoClicar={() => apagar(aberto.usuario)}
                />
              </>
            }
          >
            <div className="g-l14">
              Isto tira {aberto.usuario} do sistema. Os registros que a pessoa lançou ficam, sem o nome de quem
              lançou. Não tem como desfazer.
            </div>
          </Dialogo>
        )
        : null}
    </>
  )
}
