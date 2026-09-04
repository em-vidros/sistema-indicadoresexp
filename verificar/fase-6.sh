#!/usr/bin/env bash
# Prova da fase 6: as sete telas viraram React e o visual nao mudou.
#
# E o portao da fase, como `fase-1.sh`, `fase-2.sh` e `fase-4.sh` sao das suas. Roda com
# o `dist/` construido (`bun run build` antes); contra o servidor, as provas das fases
# 1, 2 e 4 continuam passando, cada uma no seu script.
set -uo pipefail
cd "$(dirname "$0")/.."

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

# O numero de cascas subiu depois que esta fase fechou, e isso e declarado, nao afrouxado.
# A fase 7 acrescenta ao Painel as telas Viagens, Rotas e Frota, cada uma com a sua casca
# de 17 linhas, e por isso a contagem passa de 8 para 11 e a lista abaixo cresce junto.
echo "nenhum .html alem das cascas e do guia"
CASCAS=(ata-reuniao dashboard-semanal documentos-frota entrar formulario-registro
       frota integracao-frota manutencao-frota rotas viagens)
conferir 'quantos .html em src' '11' "$(ls apps/web/src/*.html | wc -l | tr -d ' ')"
for tela in "${CASCAS[@]}" GUIA-CONFIGURACAO; do
  [ -f "apps/web/src/$tela.html" ] && tem=existe || tem=falta
  conferir "$tela.html em src" 'existe' "$tem"
done
conferir 'nenhum .html dentro de telas/' '0' \
  "$(ls apps/web/src/telas/*.html 2>/dev/null | wc -l | tr -d ' ')"
for tela in "${CASCAS[@]}"; do
  conferir "a casca $tela monta o componente" '1' \
    "$(grep -c "src=\"./telas/$tela.tsx\"" "apps/web/src/$tela.html")"
done

echo
echo "os mortos do commit 9 sumiram"
conferir 'visual-telas.ts apagado' 'sumiu' \
  "$([ ! -e verificar/visual-telas.ts ] && echo sumiu || echo existe)"
conferir 'handlers.ts apagado' 'sumiu' \
  "$([ ! -e verificar/handlers.ts ] && echo sumiu || echo existe)"
conferir 'o include cobre src inteira' '1' \
  "$(grep -cF 'apps/web/src/**/*' tsconfig.json)"
conferir 'sem include so de telas' '0' \
  "$(grep -c 'src/telas' tsconfig.json)"

echo
echo "o build nao toca no guia"
# A unica assercao viva de `visual-telas.ts` morava aqui: src e dist do guia sao o
# mesmo texto, porque o Vite nao encosta em HTML sem modulo. Apagado o arquivo, a
# comparacao mora neste portao.
if [ ! -f apps/web/dist/GUIA-CONFIGURACAO.html ]; then
  conferir 'o dist existe (rode bun run build)' 'existe' 'falta'
elif cmp -s apps/web/src/GUIA-CONFIGURACAO.html apps/web/dist/GUIA-CONFIGURACAO.html; then
  conferir 'src e dist do guia' 'igual' 'igual'
else
  conferir 'src e dist do guia' 'igual' 'DIFERENTE'
fi

echo
echo "a tela desenha igual depois do porte"
if bun verificar/paridade.ts >/tmp/paridade-fase6.txt 2>&1; then
  conferir 'paridade contra a baseline' 'igual' 'igual'
else
  conferir 'paridade contra a baseline' 'igual' 'DIFERENTE'
  sed 's/^/    /' /tmp/paridade-fase6.txt
fi

echo
echo "a prova morde: cada mutacao reprova"
total=$(grep -cF "tela: '" verificar/paridade/mutacoes.ts)
if bun verificar/paridade.ts --mutar >/tmp/mutacoes-fase6.txt 2>&1; then
  conferir 'mutacoes pegas' "$total" "$(grep -c ': pegou' /tmp/mutacoes-fase6.txt)"
else
  conferir 'mutacoes pegas' "$total" 'PASSOU DESPERCEBIDA'
  sed 's/^/    /' /tmp/mutacoes-fase6.txt
fi

echo
echo "o recorte publico fecha nos dois sentidos"
if bun verificar/publicos.ts >/tmp/publicos-fase6.txt 2>&1; then
  conferir 'portao e login de acordo' 'de acordo' 'de acordo'
else
  conferir 'portao e login de acordo' 'de acordo' 'DISCORDAM'
  sed 's/^/    /' /tmp/publicos-fase6.txt
fi

echo
echo "nenhum global exposto em telas/"
# `window.location.href =` e navegacao entre telas, decidida no plano, e `print` e
# `open` sao leitura. O que nao pode voltar e expor funcao no escopo global, que era
# o que os `onclick=` inline de antes exigiam e o que `handlers.ts` cobrava.
conferir 'sem Object.assign(window' '0' \
  "$(grep -rn 'Object\.assign(window' apps/web/src/telas/ 2>/dev/null | wc -l | tr -d ' ')"
conferir 'sem window.x = fora location' '0' \
  "$(grep -rnE 'window\.[A-Za-z_$][A-Za-z0-9_$]* *=' apps/web/src/telas/ 2>/dev/null | grep -v 'window\.location' | wc -l | tr -d ' ')"

echo
if [ "$falhas" -eq 0 ]; then
  echo "fase 6: passou"
  exit 0
fi
echo "fase 6: $falhas falha(s)"
exit 1
