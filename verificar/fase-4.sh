#!/usr/bin/env bash
# Prova da fase 4: publicado, e sem o passivo de segredo que o codigo carregava.
#
# Sao duas metades com naturezas diferentes. A primeira roda em qualquer maquina e
# olha a arvore versionada: os cinco itens que o plano nomeou sairam do codigo. A
# segunda so tem resposta contra o deploy, porque o que ela mede e o que o bundler
# fez com os arquivos que o servidor le do disco, e isso nao existe no local.
#
#   bash verificar/fase-4.sh https://<projeto>.vercel.app
#
# Sem argumento, roda so a primeira metade.
set -uo pipefail
cd "$(dirname "$0")/.."

BASE=${1:-${BASE_PROD:-}}
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

# `git grep` em vez de `grep -r`: ele varre o que esta versionado, o que ja exclui
# node_modules, `dist/` e o `.env` sem precisar listar excecao. `docs/planos` fica de
# fora porque o plano cita as cinco strings de proposito, e incluir o documento faria
# a prova nunca passar.
achou() {
  local padrao=$1
  shift
  local onde=("${@:-.}")
  git grep -lI -e "$padrao" -- "${onde[@]}" ':(exclude)docs/planos' 2>/dev/null | wc -l | tr -d ' '
}

echo "os cinco segredos sairam do codigo"
conferir 'o deployment do Apps Script' '0' "$(achou 'AKfycbwUXXAoZeuvTYm3s9')"
# O escopo e `apps/`, e nao a arvore inteira, porque `infra/extrair-constantes.ts`
# chama `atob` com razao: ele le os HTMLs originais, que estao fora do repositorio, e
# redige as senhas antes de escrever o JSON. Quem nao pode ter isso e o que roda.
conferir 'as senhas em base64 do USUARIOS' '0' "$(achou 'atob(' apps)"
conferir 'o e-mail do resumo semanal' '0' "$(achou 'livia\.mcc97@gmail\.com')"
conferir 'o IP do servidor antigo' '0' "$(achou '170\.247\.31\.241')"
conferir 'o id da planilha' '0' "$(achou '1ZS-a8LRf6RL04JAxwfQTeRsPzfll2lNeaVkxnbctaxI')"

if [ -z "$BASE" ]; then
  echo
  echo 'fase 4: metade offline passou. rode com a URL do deploy para o resto:'
  echo '  bash verificar/fase-4.sh https://<projeto>.vercel.app'
  exit $((falhas > 0))
fi

entrar() {
  local jar
  jar=$(mktemp)
  curl -s -o /dev/null -c "$jar" -X POST -H 'content-type: application/json' \
    -d "{\"usuario\":\"livia\",\"senha\":\"${SENHA_LIVIA:?defina SENHA_LIVIA}\"}" \
    "$BASE/api/entrar" 2>/dev/null
  echo "$jar"
}

echo
echo "o processo responde, e o login funciona de fora da rede"
conferir 'saude' '200' \
  "$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 "$BASE/saude" 2>/dev/null)"
livia=$(entrar)
conferir 'a sessao da livia vale na producao' 'livia' \
  "$(curl -s -b "$livia" "$BASE/api/sessao" 2>/dev/null | grep -o '"usuario":"[^"]*"' | head -1 | cut -d'"' -f4)"

# O risco que decidiu o desenho desta fase. `paginas.ts` le `apps/web/dist/` por
# caminho montado em string, e analise estatica nao enxerga isso: sem o
# `includeFiles` do `vercel.json`, o bundle da funcao sobe sem uma unica tela e a
# falha aparece so aqui, porque local o arquivo esta no disco.
echo
echo "as telas vieram junto no bundle da funcao"
for origem in apps/web/src/*.html; do
  tela=$(basename "$origem" .html)
  conferir "$tela" '200' \
    "$(curl -s -o /dev/null -w '%{http_code}' -b "$livia" --max-time 20 "$BASE/$tela.html" 2>/dev/null)"
done
asset=$(ls apps/web/dist/assets/ 2>/dev/null | grep '^formulario-registro-.*\.js$' | head -1)
conferir 'o JS com hash do formulario' '200' \
  "$(curl -s -o /dev/null -w '%{http_code}' -b "$livia" --max-time 20 "$BASE/assets/$asset" 2>/dev/null)"

# Mesma pergunta, outra pasta: `docs/` tambem e lida do disco, e ela e a que a frota
# abre. Comparar o sha256 e nao o codigo 200 porque 200 com HTML de erro dentro ja
# aconteceu em plataforma que serve fallback.
echo
echo "os PDFs da frota vieram junto, e inteiros"
pdf=docs/manual-atego.pdf
conferir 'o sha256 do manual do Atego' "$(sha256sum "$pdf" | cut -d' ' -f1)" \
  "$(curl -s -b "$livia" --max-time 60 "$BASE/$pdf" 2>/dev/null | sha256sum | cut -d' ' -f1)"

# O `ArquivosVercel` sobre `@vercel/blob` existe desde a fase 2 e nunca rodou: os
# testes usam um adaptador em memoria e o local usa disco. Este e o unico lugar onde
# esse codigo e exercitado.
echo
echo "o Blob guarda e devolve o mesmo arquivo"
temp=$(mktemp /tmp/fase4-XXXX.pdf)
printf '%%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%%%EOF\n' > "$temp"
antes=$(sha256sum "$temp" | cut -d' ' -f1)
TITULO='Ata da prova da fase 4'
hoje=$(date +%F)
ata=$(curl -s -b "$livia" --max-time 20 "$BASE/api/atas" 2>/dev/null \
  | grep -o "{[^{}]*\"titulo\":\"$TITULO\"[^{}]*}" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
if [ -z "$ata" ]; then
  ata=$(curl -s -b "$livia" -X POST -H 'content-type: application/json' \
    -d "{\"numero\":null,\"titulo\":\"$TITULO\",\"data\":\"$hoje\",\"topicos\":[],\"participantes\":[]}" \
    --max-time 20 "$BASE/api/atas" 2>/dev/null | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
fi
curl -s -o /dev/null -b "$livia" -X POST -F "arquivo=@$temp;type=application/pdf" \
  --max-time 60 "$BASE/api/atas/$ata/pdf" 2>/dev/null
conferir 'o sha256 do PDF que voltou do Blob' "$antes" \
  "$(curl -s -b "$livia" --max-time 60 "$BASE/api/atas/$ata/pdf" 2>/dev/null | sha256sum | cut -d' ' -f1)"
rm -f "$temp" "$livia"

echo
if [ "$falhas" -eq 0 ]; then
  echo 'fase 4: passou'
  exit 0
fi
echo "fase 4: $falhas falha(s)"
exit 1
