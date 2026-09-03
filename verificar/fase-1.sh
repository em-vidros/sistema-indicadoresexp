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
PORTA=${PORTA_SERVIDOR:-3200}
falhas=0

codigo() { curl -s -o /dev/null -w '%{http_code}' "$@" 2>/dev/null; }

conferir() {
  local rotulo=$1 esperado=$2 obtido=$3
  if [ "$obtido" = "$esperado" ]; then
    printf '  ok    %-44s %s\n' "$rotulo" "$obtido"
  else
    printf '  FALHA %-44s esperado %s, obtido %s\n' "$rotulo" "$esperado" "$obtido"
    falhas=$((falhas + 1))
  fi
}

echo "o visual das telas nao mudou, e o build tambem nao mexe nele"
# Era `visual-telas.ts` aqui, apagado no commit 9 da fase 6 com a ultima tela portada.
# Quem cobra agora e `bash verificar/fase-6.sh`, via `verificar/paridade.ts`, que compara
# o que o navegador monta em vez de texto de arquivo com texto de arquivo.

echo
echo "as sete telas exigem sessao, e antes seis nao pediam nada"
for tela in "${TELAS[@]}"; do
  destino=$(curl -s -o /dev/null -w '%{redirect_url}' -H 'sec-fetch-dest: document' \
    "http://localhost:${PORTA}/$tela.html" 2>/dev/null)
  conferir "$tela" "/entrar.html?destino=%2F$tela.html" "${destino#http://localhost:${PORTA}}"
done

echo
echo "o que nao e navegacao recebe 401, nao um 302 que o fetch leria como sucesso"
conferir 'GET /api/sessao'                    '401' "$(codigo http://localhost:${PORTA}/api/sessao)"
conferir 'PDF pedido por iframe'              '401' \
  "$(codigo -H 'sec-fetch-dest: iframe' http://localhost:${PORTA}/docs/apolice-PTV0006.pdf)"
conferir 'a tela de login e publica'          '200' "$(codigo http://localhost:${PORTA}/entrar.html)"
conferir 'o logo dela tambem'                 '200' "$(codigo http://localhost:${PORTA}/docs/logo-emvidros.svg)"
conferir 'cadastro aberto do better-auth'     '404' \
  "$(codigo -X POST -H 'content-type: application/json' \
     -d '{"email":"invasor@emvidros.com.br","password":"12345678","name":"x"}' \
     http://localhost:${PORTA}/api/auth/sign-up/email)"

echo
echo "com sessao, o que e de dentro entra e o que nao e nao sai"
cookie=$(mktemp)
conferir 'login pela rota da tela' '200' \
  "$(codigo -c "$cookie" -X POST -H 'content-type: application/json' \
     -d "{\"usuario\":\"livia\",\"senha\":\"${SENHA_LIVIA:?defina SENHA_LIVIA, a mesma que o seed usou}\"}" \
     http://localhost:${PORTA}/api/entrar)"
conferir 'a apolice abre'                     '200' \
  "$(codigo -b "$cookie" http://localhost:${PORTA}/docs/apolice-PTV0006.pdf)"
# `docs/` guarda os PDFs da frota e tambem o plano e o ADR em markdown, no mesmo
# diretorio. Sessao valida nao pode ser passe para o segundo grupo.
conferir 'o plano em markdown nao sai'        '404' \
  "$(codigo -b "$cookie" http://localhost:${PORTA}/docs/planos/app-funcional.md)"
# O `..` cru nunca chega ao handler, porque o parser de URL normaliza antes. O que
# de fato pode furar a contencao e decodificar duas vezes, e e isso que este par
# mede. `%61` e a letra `a`: uma decodificacao acha o arquivo, duas nao acham nada.
# Comparar so o 404 nao provaria nada, porque caminho inexistente da 404 dos dois
# jeitos; e o 200 do primeiro que da sentido ao 404 do segundo.
conferir 'uma decodificacao acha a apolice'   '200' \
  "$(codigo -b "$cookie" "http://localhost:${PORTA}/docs/%61police-PTV0006.pdf")"
conferir 'duas decodificacoes nao acham nada' '404' \
  "$(codigo -b "$cookie" "http://localhost:${PORTA}/docs/%2561police-PTV0006.pdf")"
conferir 'byte nulo nao vira 500'             '404' \
  "$(codigo -b "$cookie" "http://localhost:${PORTA}/docs/planos/app-funcional.md%00.pdf")"
conferir 'destino envenenado sai da query'    "http://localhost:${PORTA}/entrar.html" \
  "$(curl -s -o /dev/null -w '%{redirect_url}' -H 'sec-fetch-dest: document' \
     "http://localhost:${PORTA}/entrar.html?destino=/%09/evil.com" 2>/dev/null)"
conferir 'a base da andreina vem do servidor' 'Raposa' \
  "$(c2=$(mktemp); curl -s -o /dev/null -c "$c2" -X POST -H 'content-type: application/json' \
       -d "{\"usuario\":\"andreina\",\"senha\":\"${SENHA_ANDREINA:?defina SENHA_ANDREINA}\"}" \
       http://localhost:${PORTA}/api/entrar 2>/dev/null
     curl -s -b "$c2" http://localhost:${PORTA}/api/sessao 2>/dev/null \
       | sed 's/.*"baseFixa":"\([^"]*\)".*/\1/'; rm -f "$c2")"
rm -f "$cookie"


echo
if [ "$falhas" -eq 0 ]; then
  echo "fase 1: passou"
  exit 0
fi
echo "fase 1: $falhas falha(s)"
exit 1
