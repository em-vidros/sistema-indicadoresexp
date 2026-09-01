#!/usr/bin/env bash
# Prova da fase 2: o banco virou a fonte de verdade.
#
# A fase 1 pos as telas atras de um login e nao encostou na persistencia. Esta fase
# tira o localStorage e o Apps Script do caminho, e o que ela tem que provar e que o
# dado sobrevive ao navegador: gravado numa sessao, lido em outra, sem nada guardado
# do lado de ca. E que a tela continua identica enquanto isso acontece.
#
# O roteiro de cada tela e o mesmo: escreve por HTTP, le por HTTP com outro cookie, e
# confere que nenhum modulo do front ainda toca em localStorage.
set -uo pipefail
cd "$(dirname "$0")/.."

PORTA=${PORTA_SERVIDOR:-3200}
BASE="http://localhost:${PORTA}"
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

entrar() {
  local usuario=$1 senha=$2 jar
  jar=$(mktemp)
  curl -s -o /dev/null -c "$jar" -X POST -H 'content-type: application/json' \
    -d "{\"usuario\":\"$usuario\",\"senha\":\"$senha\"}" "$BASE/api/entrar" 2>/dev/null
  echo "$jar"
}

echo "o armazenamento do navegador saiu do caminho"
# Nao e busca por elegancia: enquanto um modulo ler `emvidros_indicadores`, ele mostra
# um numero que so existe naquele computador, e duas pessoas veem telas diferentes.
for modulo in apps/web/src/js/*.ts; do
  nome=$(basename "$modulo" .ts)
  conferir "$nome sem localStorage" '0' "$(grep -c 'localStorage' "$modulo")"
done

echo
echo "o Apps Script e a planilha sairam do codigo"
conferir 'nenhum modulo chama o Apps Script' '0' \
  "$(grep -rl 'script\.google\|AKfycb' apps/web/src/js/ 2>/dev/null | wc -l | tr -d ' ')"

echo
echo "todo clique do markup acha a funcao dele"
if bun verificar/handlers.ts >/tmp/handlers-fase2.txt 2>&1; then
  conferir 'os handlers das 6 telas' 'vivos' 'vivos'
else
  conferir 'os handlers das 6 telas' 'vivos' 'MORTOS'
  sed 's/^/    /' /tmp/handlers-fase2.txt
fi

echo
echo "o visual nao mudou, nem no markup que o codigo gera"
if bun verificar/visual-telas.ts >/tmp/visual-fase2.txt 2>&1; then
  conferir 'as 6 telas contra ca90d06' 'igual' 'igual'
else
  conferir 'as 6 telas contra ca90d06' 'igual' 'DIFERENTE'
  sed 's/^/    /' /tmp/visual-fase2.txt
fi

echo
echo "o dado gravado numa sessao aparece em outra"
livia=$(entrar livia "${SENHA_LIVIA:?defina SENHA_LIVIA}")
hoje=$(date +%F)
# Motorista, veiculo e rota tem que existir no cadastro da base, senao a rota recusa
# com "cadastro inexistente". Estes tres sao da Raposa e vem do seed. O combustivel
# nao pode ser zero junto com as diarias: o `viagem_custo_ck` cobra soma positiva, que
# e a mesma guarda que o formulario original tinha.
viagem="{\"tipo\":\"viagem\",\"base\":\"Raposa\",\"data_saida\":\"$hoje\",\"motorista\":\"Anderson Penha Dos Anjos\",\"veiculo\":\"PTV0006\",\"rota\":\"PINHEIRO\",\"km_saida\":1000,\"valor_carga\":1,\"combustivel\":100,\"diarias\":0,\"m2\":0,\"peso_kg\":0,\"observacao\":\"prova da fase 2\"}"
criado=$(curl -s -b "$livia" -X POST -H 'content-type: application/json' \
  -d "{\"registros\":[$viagem]}" "$BASE/api/registros" 2>/dev/null)
conferir 'a viagem entra pela API' '1' \
  "$(echo "$criado" | grep -o '"id":"[^"]*"' | wc -l | tr -d ' ')"

# Outro cookie, outro processo de login: se o dado estivesse no navegador, esta
# leitura voltaria vazia. E o teste que o localStorage nunca teria passado.
outra=$(entrar livia "${SENHA_LIVIA}")
conferir 'e sai numa sessao que nao a gravou' 'prova da fase 2' \
  "$(curl -s -b "$outra" "$BASE/api/registros?base=Raposa" 2>/dev/null \
     | grep -o '"observacao":"prova da fase 2"' | head -1 | cut -d'"' -f4)"

# A limpeza tem que apagar no banco, e nao so na lista que o navegador tem na mao. O
# "Limpar hoje" da tela filtrava a memoria e nada mais: a tela ficava limpa, e o F5
# seguinte trazia tudo de volta. Aqui a prova apaga com um cookie e confere com outro,
# que e o unico jeito de a memoria do cliente nao responder pelo resultado.
curl -s -o /dev/null -b "$livia" -X DELETE \
  "$BASE/api/registros?base=Raposa&data=$hoje" 2>/dev/null
conferir 'depois de limpar, nao sobra na outra sessao' '0' \
  "$(curl -s -b "$outra" "$BASE/api/registros?base=Raposa" 2>/dev/null \
     | grep -o '"observacao":"prova da fase 2"' | wc -l | tr -d ' ')"
conferir 'e a tela chama a rota, nao a memoria' '1' \
  "$(grep -c 'await apagarRegistrosDoDia' apps/web/src/js/formulario-registro.ts)"

echo
echo "o PDF sobe e volta com o mesmo conteudo"
pdf=$(mktemp /tmp/fase2-XXXX.pdf)
printf '%%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%%%EOF\n' > "$pdf"
antes=$(sha256sum "$pdf" | cut -d' ' -f1)
# A ata da prova e reusada, nao criada de novo a cada rodada. Apagar ata e
# soft-delete, e de proposito nao leva o PDF junto: restaurar uma ata sem o
# documento assinado seria pior que guardar o blob. Criar uma por rodada deixava um
# arquivo orfao por execucao, e nove ja tinham se acumulado no banco de dev.
TITULO='Ata da prova da fase 2'
ata=$(curl -s -b "$livia" "$BASE/api/atas" 2>/dev/null \
  | grep -o "{[^{}]*\"titulo\":\"$TITULO\"[^{}]*}" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
if [ -z "$ata" ]; then
  ata=$(curl -s -b "$livia" -X POST -H 'content-type: application/json' \
    -d "{\"numero\":null,\"titulo\":\"$TITULO\",\"data\":\"$hoje\",\"topicos\":[],\"participantes\":[]}" \
    "$BASE/api/atas" 2>/dev/null | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
fi
curl -s -o /dev/null -b "$livia" -X POST -F "arquivo=@$pdf;type=application/pdf" \
  "$BASE/api/atas/$ata/pdf" 2>/dev/null
depois=$(curl -s -b "$livia" "$BASE/api/atas/$ata/pdf" 2>/dev/null | sha256sum | cut -d' ' -f1)
conferir 'o sha256 do PDF baixado' "$antes" "$depois"
rm -f "$pdf"

echo
echo "quem e de uma base nao alcanca a outra"
andreina=$(entrar andreina "${SENHA_ANDREINA:?defina SENHA_ANDREINA}")
conferir 'registro de base alheia' '403' \
  "$(curl -s -o /dev/null -w '%{http_code}' -b "$andreina" "$BASE/api/registros?base=Imperatriz" 2>/dev/null)"

echo
echo "o asset da tela e servido, e so com sessao"
asset=$(ls apps/web/dist/assets/ 2>/dev/null | grep '^formulario-registro-.*\.js$' | head -1)
conferir 'com sessao, o JS da tela desce' '200' \
  "$(curl -s -o /dev/null -w '%{http_code}' -b "$livia" "$BASE/assets/$asset" 2>/dev/null)"
conferir 'sem sessao, nao desce' '401' \
  "$(curl -s -o /dev/null -w '%{http_code}' -H 'sec-fetch-dest: script' "$BASE/assets/$asset" 2>/dev/null)"

rm -f "$livia" "$outra" "$andreina"

echo
if [ "$falhas" -eq 0 ]; then
  echo "fase 2: passou"
  exit 0
fi
echo "fase 2: $falhas falha(s)"
exit 1
