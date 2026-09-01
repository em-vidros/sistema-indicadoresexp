#!/usr/bin/env bash
# Prova da fase 0: o banco tem o cadastro que hoje esta escrito dentro dos HTMLs,
# e o login do better-auth aceita quem deve e recusa quem nao deve.
#
# Os numeros esperados nao sao chutes: saem de infra/extrair-constantes.ts rodando
# sobre os arquivos de origem. Se um deles mudar, rode o extrator e ajuste aqui.
set -uo pipefail
cd "$(dirname "$0")/.."

CONTAINER=${PG_CONTAINER:-indicadores-pg}
PORTA=${PORTA_SERVIDOR:-3200}
falhas=0

sql() { podman exec "$CONTAINER" psql -U indicadores -d indicadores -tAc "$1" 2>&1; }

conferir() {
  local rotulo=$1 esperado=$2 obtido=$3
  if [ "$obtido" = "$esperado" ]; then
    printf '  ok    %-34s %s\n' "$rotulo" "$obtido"
  else
    printf '  FALHA %-34s esperado %s, obtido %s\n' "$rotulo" "$esperado" "$obtido"
    falhas=$((falhas + 1))
  fi
}

echo "os nove conjuntos do cadastro"
conferir 'bases'                    3  "$(sql 'select count(*) from base')"
conferir 'veiculos'                15  "$(sql 'select count(*) from veiculo')"
conferir 'colaboradores'           31  "$(sql 'select count(*) from colaborador')"
conferir 'rotas'                   22  "$(sql 'select count(*) from rota')"
conferir 'tipos de preventiva'      8  "$(sql 'select count(*) from tipo_preventivo')"
conferir 'usuarios'                 4  "$(sql 'select count(*) from "user"')"
conferir 'metas de kpi'             4  "$(sql 'select count(*) from meta')"
conferir 'programas de integracao'  2  "$(sql 'select count(*) from programa_integracao')"
conferir 'atividades do programa'  47  "$(sql 'select count(*) from programa_atividade')"

echo
echo "as atividades, uma a uma"
# Contar 47 nao prova nada: prova que sao os 47 certos. A fonte e o extrator, nao
# uma grade que eu invente aqui. A serie real nao e regular: a semana 1 vai ate `f`,
# as semanas 2 a 4 vao ate `d`, a semana 5 do motorista para em `b` e nao existe m5c.
if [ ! -f infra/constantes.json ]; then
  printf '  FALHA %s\n' 'infra/constantes.json nao existe; rode bun infra/extrair-constantes.ts'
  falhas=$((falhas + 1))
else
  esperados=$(bun -e '
    const c = await Bun.file("infra/constantes.json").json()
    const codigos = []
    for (const programa of Object.values(c["integracao-frota.html"].INTEGRACOES))
      JSON.stringify(programa).replace(/"id":"([^"]+)"/g, (todo, id) => (codigos.push(id), todo))
    console.log([...new Set(codigos)].sort().join(","))
  ')
  obtidos=$(sql "select string_agg(codigo, ',' order by codigo) from programa_atividade")
  conferir 'os 47 codigos, um a um' "$esperados" "$obtidos"
fi
conferir 'trilha do motorista'     23  "$(sql "select count(*) from programa_atividade where codigo like 'm%'")"
conferir 'trilha do ajudante'      24  "$(sql "select count(*) from programa_atividade where codigo like 'a%'")"
conferir 'm5c nao existe'           0  "$(sql "select count(*) from programa_atividade where codigo = 'm5c'")"

echo
echo "as rotas locais, que decidem se o toggle de viagem longa aparece"
conferir 'rotas marcadas como local' 7 "$(sql 'select count(*) from rota where local')"

echo
echo "nenhuma senha antiga sobreviveu ao seed"
# As quatro senhas estao em base64 no HTML que o navegador recebia, com um atob() ao
# lado, entao ja vazaram. O seed cria os usuarios com senha nova, e nenhuma das
# antigas pode autenticar.
#
# Elas sao lidas do commit de origem, e nao escritas aqui. Dois motivos. Uma copia
# em texto claro neste arquivo seria um vazamento a mais, criado por mim. E a fase 1
# tirou o bloco do HTML, mas ele continua no historico do git, entao e de la que a
# prova tem que ler: enquanto o historico nao for reescrito, e de la que alguem
# tiraria as senhas para tentar entrar.
ORIGEM=ca90d06
codificadas=$(git show "$ORIGEM:formulario-registro.html" \
  | grep -o "senha: _d('[^']*')" | sed "s/.*'\(.*\)'.*/\1/")
if [ -z "$codificadas" ]; then
  printf '  FALHA %s\n' "nao achei as senhas antigas em $ORIGEM:formulario-registro.html"
  falhas=$((falhas + 1))
fi
n=0
for codificada in $codificadas; do
  # Uma por vez: `base64 -d` num pipe com as quatro cola tudo numa string so.
  antiga=$(printf '%s' "$codificada" | base64 -d)
  n=$((n + 1))
  codigo=$(curl -s -o /dev/null -w '%{http_code}' -X POST \
    "http://localhost:${PORTA}/api/auth/sign-in/email" \
    -H 'content-type: application/json' \
    -d "{\"email\":\"livia@emvidros.com.br\",\"password\":\"${antiga}\"}" 2>/dev/null)
  conferir "senha vazada ${n} de 4 recusada" '401' "$codigo"
done

echo
echo "o login novo funciona"
cookie=$(mktemp)
codigo=$(curl -s -o /dev/null -w '%{http_code}' -c "$cookie" -X POST \
  "http://localhost:${PORTA}/api/auth/sign-in/email" \
  -H 'content-type: application/json' \
  -d "{\"email\":\"livia@emvidros.com.br\",\"password\":\"${SENHA_LIVIA:?defina SENHA_LIVIA, a mesma que o seed usou}\"}" 2>/dev/null)
conferir 'login com a senha certa' '200' "$codigo"
conferir 'devolveu cookie de sessao' 'sim' "$(grep -qi 'session' "$cookie" && echo sim || echo nao)"
rm -f "$cookie"

echo
if [ "$falhas" -eq 0 ]; then
  echo "fase 0: passou"
  exit 0
fi
echo "fase 0: $falhas falha(s)"
exit 1
