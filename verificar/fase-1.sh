#!/usr/bin/env bash
# Prova da fase 1. Ela cresce junto com a fase; hoje cobre o build.
#
# A restricao do cliente e que o visual nao muda. Aqui isso nao e opiniao: as sete
# telas construidas tem que sair identicas, byte a byte, aos arquivos de origem, e
# os arquivos de origem tem que sair identicos ao que estava na raiz do repositorio
# antes da mudanca.
set -uo pipefail
cd "$(dirname "$0")/.."

ORIGEM=ca90d06   # o commit que trouxe as sete telas
TELAS=(ata-reuniao dashboard-semanal documentos-frota formulario-registro
       GUIA-CONFIGURACAO integracao-frota manutencao-frota)
falhas=0

conferir() {
  local rotulo=$1 esperado=$2 obtido=$3
  if [ "$obtido" = "$esperado" ]; then
    printf '  ok    %-44s %s\n' "$rotulo" "$obtido"
  else
    printf '  FALHA %-44s esperado %s, obtido %s\n' "$rotulo" "$esperado" "$obtido"
    falhas=$((falhas + 1))
  fi
}

echo "o build nao toca em nenhum byte das telas"
bun run build >/dev/null 2>&1 || { echo '  FALHA build do vite'; exit 1; }
for tela in "${TELAS[@]}"; do
  conferir "$tela" 'igual' \
    "$(cmp -s "apps/web/src/$tela.html" "apps/web/dist/$tela.html" && echo igual || echo DIFERENTE)"
done

echo
echo "as telas que a fase 1 nao edita continuam iguais a $ORIGEM"
for tela in "${TELAS[@]}"; do
  [ "$tela" = formulario-registro ] && continue
  conferir "$tela" 'igual' \
    "$(git show "$ORIGEM:$tela.html" | diff -q - "apps/web/src/$tela.html" >/dev/null && echo igual || echo DIFERENTE)"
done

echo
if [ "$falhas" -eq 0 ]; then
  echo "fase 1: passou"
  exit 0
fi
echo "fase 1: $falhas falha(s)"
exit 1
