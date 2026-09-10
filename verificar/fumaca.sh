#!/usr/bin/env bash
# Fumaça pós-deploy: a produção responde, e o que é público continua público.
#
# Leitura só: nenhum passo escreve no banco nem precisa de senha, então roda no CI
# logo depois do `vercel deploy --prod`. O 401 de `/api/sessao` é resposta certa,
# não falha: sem cookie o portão barra, e é isso que prova que ele está de pé.
#
#   bash verificar/fumaca.sh [https://dominio]
#
# Sem argumento, mira a produção. Se algum código vier diferente do esperado, tenta
# de novo mais duas vezes antes de reprovar, porque a troca de alias propaga em
# segundos. Reprovar aqui não desfaz o deploy sozinho: o passo seguinte é o
# rollback em um clique, no workflow `rollback` do Actions.
set -uo pipefail

BASE=${1:-${BASE_PROD:-https://sistema-indicadoresexp.vercel.app}}
BASE=${BASE%/}
TENTATIVAS=3
ESPERA=20
falhas=0

conferir() {
  local rotulo=$1 esperado=$2 obtido=$3
  if [ "$obtido" = "$esperado" ]; then
    printf '  ok    %-28s %s\n' "$rotulo" "$obtido"
  else
    printf '  FALHA %-28s esperado %s, obtido %s\n' "$rotulo" "$esperado" "$obtido"
    falhas=$((falhas + 1))
  fi
}

codigo() {
  curl -s -o /dev/null -w '%{http_code}' --max-time 15 "$@" 2>/dev/null || true
}

rodar() {
  falhas=0
  conferir 'saude' '200' "$(codigo "$BASE/saude")"
  conferir 'login' '200' "$(codigo "$BASE/entrar.html")"
  conferir 'css do sistema visual' '200' "$(codigo "$BASE/assets/geist.css")"
  conferir 'api sem sessao barra' '401' "$(codigo "$BASE/api/sessao")"
  conferir 'raiz manda para o login' '302' "$(codigo -H 'Accept: text/html' "$BASE/")"
}

tentativa=1
while true; do
  echo "fumaca: tentativa $tentativa de $TENTATIVAS contra $BASE"
  rodar
  if [ "$falhas" -eq 0 ]; then
    echo 'fumaca: passou'
    exit 0
  fi
  if [ "$tentativa" -ge "$TENTATIVAS" ]; then
    break
  fi
  tentativa=$((tentativa + 1))
  sleep "$ESPERA"
done

echo "fumaca: $falhas falha(s)"
exit 1
