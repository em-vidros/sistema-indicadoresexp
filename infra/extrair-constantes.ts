const RAIZ = new URL("../", import.meta.url).pathname;
const DESTINO = RAIZ + "infra/constantes.json";

const MAPA: Record<string, string[]> = {
  "ata-reuniao.html": ["COLABORADORES"],
  "documentos-frota.html": [
    "DOCS_ESTATICOS",
    "MANUAIS_RAPOSA",
    "MOTORISTAS_BELEM",
    "MOTORISTAS_IMPERATRIZ",
    "MOTORISTAS_RAPOSA",
    "PLANOS",
    "VEICULOS_BELEM",
    "VEICULOS_IMPERATRIZ",
    "VEICULOS_INFO",
    "VEICULOS_RAPOSA",
  ],
  "formulario-registro.html": [
    "MOTORISTAS_BELEM",
    "MOTORISTAS_IMPERATRIZ",
    "MOTORISTAS_RAPOSA",
    "ROTAS_BELEM",
    "ROTAS_IMPERATRIZ",
    "ROTAS_LOCAIS",
    "ROTAS_RAPOSA",
    "USUARIOS",
    "VEICULOS_BELEM",
    "VEICULOS_IMPERATRIZ",
    "VEICULOS_RAPOSA",
  ],
  "integracao-frota.html": ["COLABORADORES", "INTEGRACOES"],
  "manutencao-frota.html": [
    "CONFIG_PADRAO_RAPOSA",
    "TIPOS_PREVENTIVA_PADRAO",
    "ULTIMO_KM_PGQ",
    "VEICULOS_INFO",
  ],
};

class ErroExtracao extends Error {
  constructor(arquivo: string, nome: string, motivo: string) {
    super(`${arquivo} → ${nome}: ${motivo}`);
    this.name = "ErroExtracao";
  }
}

function acharAtribuicao(fonte: string, nome: string): number | null {
  const ancora = new RegExp(`\\b(?:const|let|var)\\s+${nome}\\s*=`);
  const achado = ancora.exec(fonte);
  if (!achado) return null;
  return achado.index + achado[0].length;
}

// O literal é delimitado por varredura de profundidade, e não por expressão regular,
// porque os dados trazem colchete dentro de string ("[Euro V]"), acento, travessão e
// objeto aninhado em vários níveis — casos em que qualquer regex de fechamento erra o
// ponto final e devolve um trecho cortado ou grande demais.
function recortarLiteral(fonte: string, inicio: number, arquivo: string, nome: string): string {
  let i = inicio;
  let profundidade = 0;

  while (i < fonte.length) {
    const c = fonte[i]!;

    if (c === "'" || c === '"' || c === "`") {
      const aspa = c;
      i++;
      while (i < fonte.length) {
        if (fonte[i] === "\\") {
          i += 2;
          continue;
        }
        if (fonte[i] === aspa) break;
        i++;
      }
      if (i >= fonte.length) {
        throw new ErroExtracao(arquivo, nome, `string aberta em ${aspa} sem fechamento`);
      }
      i++;
      continue;
    }

    if (c === "/" && fonte[i + 1] === "/") {
      const quebra = fonte.indexOf("\n", i);
      i = quebra === -1 ? fonte.length : quebra + 1;
      continue;
    }

    if (c === "/" && fonte[i + 1] === "*") {
      const fim = fonte.indexOf("*/", i + 2);
      if (fim === -1) throw new ErroExtracao(arquivo, nome, "comentário de bloco sem fechamento");
      i = fim + 2;
      continue;
    }

    if (c === "{" || c === "[" || c === "(") {
      profundidade++;
      i++;
      continue;
    }

    if (c === "}" || c === "]" || c === ")") {
      profundidade--;
      if (profundidade < 0) {
        throw new ErroExtracao(arquivo, nome, `fechamento "${c}" sem abertura na posição ${i}`);
      }
      i++;
      continue;
    }

    if (profundidade === 0 && (c === ";" || c === ",")) {
      return fonte.slice(inicio, i);
    }

    i++;
  }

  throw new ErroExtracao(arquivo, nome, "fim do arquivo antes do ; que encerra a declaração");
}

// Só USUARIOS depende de ajuda externa: as senhas estão escritas como _d('...'),
// que no HTML é um atalho para atob. Nenhuma outra constante chama função.
const AJUDANTES = {
  _d: (s: string) => atob(s),
  atob,
};

function avaliarLiteral(trecho: string, arquivo: string, nome: string): unknown {
  const nomes = Object.keys(AJUDANTES);
  const valores = Object.values(AJUDANTES);
  try {
    return new Function(...nomes, `return (${trecho})`)(...valores);
  } catch (erro) {
    const motivo = erro instanceof Error ? erro.message : String(erro);
    throw new ErroExtracao(arquivo, nome, `não foi possível avaliar o literal — ${motivo}`);
  }
}

/**
 * As senhas do objeto USUARIOS estao no HTML servido ao navegador, em base64 com
 * um atob() ao lado. Ou seja: ja vazaram. Nao vao para o JSON e nao vao para o
 * seed. O seed cria os quatro usuarios com senha nova, vinda do .env.
 */
function redigirSenhas(valor: unknown): unknown {
  if (Array.isArray(valor)) return valor.map(redigirSenhas)
  if (valor === null || typeof valor !== 'object') return valor
  return Object.fromEntries(
    Object.entries(valor).map(([chave, v]) =>
      chave === 'senha' ? [chave, '<redigida: veja BETTER_AUTH no .env>'] : [chave, redigirSenhas(v)],
    ),
  )
}

function contar(valor: unknown): number {
  if (Array.isArray(valor)) return valor.length;
  if (valor !== null && typeof valor === "object") return Object.keys(valor).length;
  return 0;
}

const resultado: Record<string, Record<string, unknown>> = {};
const faltantes: string[] = [];
const linhas: string[] = [];
let total = 0;

// Os HTMLs de origem sairam da raiz na fase 1 e saem do repositorio na fase 6. O commit
// em que a Livia os entregou nao muda, entao ele e a fonte, e `constantes.json` continua
// regeneravel a partir do que ja esta versionado. E o mesmo ref que `visual-telas.ts` usa.
const ORIGEM = "ca90d06";

function daOrigem(arquivo: string): string {
  const proc = Bun.spawnSync(["git", "show", `${ORIGEM}:${arquivo}`], { cwd: RAIZ });
  if (proc.exitCode !== 0) {
    throw new Error(`git show ${ORIGEM}:${arquivo} falhou: ${proc.stderr.toString().trim()}`);
  }
  return proc.stdout.toString();
}

for (const arquivo of Object.keys(MAPA).sort()) {
  const fonte = daOrigem(arquivo);
  const doArquivo: Record<string, unknown> = {};

  for (const nome of [...MAPA[arquivo]!].sort()) {
    const inicio = acharAtribuicao(fonte, nome);
    if (inicio === null) {
      faltantes.push(`${arquivo} → ${nome}`);
      continue;
    }
    const trecho = recortarLiteral(fonte, inicio, arquivo, nome);
    const valor = redigirSenhas(avaliarLiteral(trecho, arquivo, nome));
    doArquivo[nome] = valor;
    linhas.push(`${arquivo}  ${nome}  ${contar(valor)}`);
    total++;
  }

  resultado[arquivo] = doArquivo;
}

if (faltantes.length > 0) {
  console.error("Constantes não encontradas:");
  for (const f of faltantes) console.error(`  ${f}`);
  console.error(`\n${faltantes.length} de ${faltantes.length + total} não foram encontradas. JSON não escrito.`);
  process.exit(1);
}

await Bun.write(DESTINO, JSON.stringify(resultado, null, 2) + "\n");

for (const linha of linhas) console.log(linha);
console.log(`total: ${total} constantes de ${Object.keys(MAPA).length} arquivos → ${DESTINO}`);
