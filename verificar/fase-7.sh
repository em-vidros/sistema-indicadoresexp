#!/usr/bin/env bash
# Prova da fase 7: o painel ganhou visual novo e as seis telas congeladas nao andaram.
#
# E o portao da fase, no molde de `fase-6.sh`. Roda com o `dist/` construido
# (`bun run build` antes); as provas das fases 1, 2, 4 e 6 continuam valendo, cada uma
# no seu script.
#
# A assercao que da razao a este arquivo e a do meio: `telas/base.css` e `telas/casca.css`
# nao mudaram desde `dc30556`, o commit da fase 3 que os criou. O defeito que este
# trabalho existe para evitar e alguem "aproveitar" uma medida do desenho novo mexendo
# numa das duas folhas compartilhadas, o que muda as seis telas que a Livia aprovou sem
# que ninguem tenha pedido. A paridade pegaria o estrago, mas so depois de rodar o
# Chromium; aqui o `git diff` responde em milissegundos e diz exatamente qual arquivo
# andou.
set -uo pipefail
cd "$(dirname "$0")/.."

# O commit da fase 3, onde as duas folhas compartilhadas nasceram com o texto de hoje.
FASE_3=dc30556

PAINEL=(dashboard-semanal viagens rotas frota)
CONGELADAS=(ata-reuniao documentos-frota entrar formulario-registro integracao-frota manutencao-frota)

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

echo "as duas folhas compartilhadas nao andaram desde a fase 3"
for folha in base casca; do
  if git diff --quiet "$FASE_3" -- "apps/web/src/telas/$folha.css"; then
    conferir "$folha.css desde $FASE_3" 'igual' 'igual'
  else
    conferir "$folha.css desde $FASE_3" 'igual' 'MUDOU'
  fi
done

echo
echo "as folhas nao atravessam a fronteira nos dois sentidos"
# O painel nao pode importar o CSS das congeladas, e as congeladas nao podem importar o
# CSS do painel. Sao dois sistemas visuais no mesmo `dist/`, e cada tela carrega um so.
for tela in "${PAINEL[@]}"; do
  conferir "$tela nao importa base/casca.css" '0' \
    "$(grep -cE "(base|casca)\.css" "apps/web/src/telas/$tela.tsx")"
done
for tela in "${CONGELADAS[@]}"; do
  conferir "$tela nao importa geist.css" '0' \
    "$(grep -c 'geist\.css' "apps/web/src/telas/$tela.tsx")"
done

echo
echo "as quatro cascas do painel existem e montam o componente"
for tela in "${PAINEL[@]}"; do
  [ -f "apps/web/src/$tela.html" ] && tem=existe || tem=falta
  conferir "$tela.html em src" 'existe' "$tem"
  conferir "a casca $tela monta o componente" '1' \
    "$(grep -c "src=\"./telas/$tela.tsx\"" "apps/web/src/$tela.html" 2>/dev/null || echo 0)"
done

echo
echo "toda classe do sistema visual sai com o prefixo g-"
# Sem prefixo, uma classe nova do painel colide com uma das seis folhas congeladas no dia
# em que alguem juntar dois CSS no mesmo documento. Le so as linhas de seletor, que sao
# as que terminam abrindo bloco, e ignora as de comentario.
fora_do_prefixo=$(grep -E '\{[[:space:]]*$|\{' apps/web/src/geist/geist.css \
  | grep -vE '^\s*(/\*|\*)' \
  | sed 's/{.*//' \
  | grep -oE '\.[A-Za-z_-][A-Za-z0-9_-]*' \
  | grep -vE '^\.g-' | sort -u)
conferir 'classes sem prefixo g-' '0' "$(printf '%s' "$fora_do_prefixo" | grep -c . | tr -d ' ')"
[ -n "$fora_do_prefixo" ] && printf '    %s\n' $fora_do_prefixo

echo
echo "nenhum global exposto no codigo do painel"
# Mesma regra da fase 6, agora sobre os tres diretorios que o redesenho criou ou mexeu.
# `window.location` e navegacao entre telas, decidida no plano.
ONDE=(apps/web/src/telas/ apps/web/src/geist/ apps/web/src/dashboard/)
conferir 'sem Object.assign(window' '0' \
  "$(grep -rn 'Object\.assign(window' "${ONDE[@]}" 2>/dev/null | wc -l | tr -d ' ')"
conferir 'sem window.x = fora location' '0' \
  "$(grep -rnE 'window\.[A-Za-z_$][A-Za-z0-9_$]* *=' "${ONDE[@]}" 2>/dev/null | grep -v 'window\.location' | wc -l | tr -d ' ')"

echo
echo "o Recharts fica no bundle de quem desenha grafico"
# Uma pagina por tela existe para isto: as tres telas sem grafico nao carregam a
# biblioteca. A pergunta e sobre o `dist/`, e nao sobre o import, entao a resposta sai
# dos arquivos que cada `.html` construido pede.
recharts_em() {
  local tela=$1 html="apps/web/dist/$1.html" achou=0
  [ -f "$html" ] || { echo 'SEM DIST'; return; }
  for asset in $(grep -oE 'assets/[A-Za-z0-9_.-]+\.js' "$html" | sort -u); do
    grep -q 'recharts-' "apps/web/dist/$asset" && achou=1
  done
  [ "$achou" = 1 ] && echo carrega || echo 'nao carrega'
}
for tela in viagens rotas frota; do
  conferir "$tela sem Recharts no dist" 'nao carrega' "$(recharts_em "$tela")"
done
conferir 'dashboard-semanal com Recharts no dist' 'carrega' "$(recharts_em dashboard-semanal)"

echo
echo "a baseline cobre as seis congeladas, e nenhuma a mais"
conferir 'quantas telas na baseline' '6' \
  "$(find verificar/baseline -mindepth 1 -maxdepth 1 -type d | wc -l | tr -d ' ')"
conferir 'dashboard-semanal fora da baseline' 'fora' \
  "$([ -d verificar/baseline/dashboard-semanal ] && echo dentro || echo fora)"

echo
echo "as seis telas desenham iguais a baseline"
if bun verificar/paridade.ts >/tmp/paridade-fase7.txt 2>&1; then
  conferir 'paridade contra a baseline' 'igual' 'igual'
else
  conferir 'paridade contra a baseline' 'igual' 'DIFERENTE'
  sed 's/^/    /' /tmp/paridade-fase7.txt
fi

echo
echo "a prova morde: cada mutacao reprova"
total=$(grep -cF "tela: '" verificar/paridade/mutacoes.ts)
if bun verificar/paridade.ts --mutar >/tmp/mutacoes-fase7.txt 2>&1; then
  conferir 'mutacoes pegas' "$total" "$(grep -c ': pegou' /tmp/mutacoes-fase7.txt)"
else
  conferir 'mutacoes pegas' "$total" 'PASSOU DESPERCEBIDA'
  sed 's/^/    /' /tmp/mutacoes-fase7.txt
fi

echo
if [ "$falhas" -eq 0 ]; then
  echo "fase 7: passou"
  exit 0
fi
echo "fase 7: $falhas falha(s)"
exit 1
