# Correções nos fluxos da Lívia

A revisão cobriu lançamentos e edição de registros, datas, PDFs, usuários, convites e permissões por base. O banco local recebeu os testes que alteram dados. A produção recebe apenas a verificação de leitura do workflow de deploy.

## Problemas encontrados

- O primeiro acesso exigia uma sessão antes de definir a senha. A rota exata de convite passou a ser pública.
- Dois pedidos podiam aceitar o mesmo convite ou gerar dois links válidos para a mesma pessoa. Geração e aceite agora usam transações e bloqueiam a linha do destinatário.
- A redefinição de senha mantinha sessões antigas. Agora elas são revogadas.
- Duas alterações simultâneas podiam remover os últimos administradores. A atualização e a exclusão de usuários serializam a verificação.
- Mudar somente a base fixa podia deixá-la fora das bases permitidas. A validação usa a lista efetiva de permissões.
- O seed apagava usuários criados pela administração. Agora ele preserva essas contas.
- Campos numéricos interpretavam `1.234` como `1234`. Agora os campos nativos usam ponto decimal. Dinheiro continua aceitando o formato brasileiro.
- A data de hoje mudava às 21h no fuso de Fortaleza. Registrar e Integrações agora usam o calendário local.
- A manutenção mostrava anexos como concluídos sem salvar arquivos. Os controles foram removidos e a tela informa que orçamento e OS ainda não podem ser anexados nesse formulário.
- A tela de documentos aceitava PDFs de 6 MB, acima do limite de requisição da hospedagem. O limite agora é 4 MB, com margem para o formulário multipart.

- A barra lateral deixava só 126 px para o conteúdo em celular de 390 px. Agora a navegação fica acima do painel, com rolagem horizontal dos links.
- Manutenção de valor zero era aceita pela API, mas bloqueada pelo formulário. Agora zero aparece na edição e pode ser salvo.
- Assets sem hash podiam ficar dez minutos na versão anterior após publicar. Agora o navegador revalida esses arquivos.

## Verificação

O navegador local confirmou criação de quebra com `1.234` m², leitura de `1.23` após o arredondamento do banco, edição para `2.50` e preservação do mesmo identificador. Os testes de API cobrem convite sem sessão, consumo concorrente, permissões e PDFs acima de 4 MB. A suíte completa passou com 453 testes e nenhuma falha. O formulário foi conferido em 390 px e 1280 px sem rolagem horizontal da página. A fumaça de produção também verifica que o convite chega à API sem exigir sessão.

Não há migração de banco nesta alteração. Não há promessa de ausência de qualquer defeito fora dos fluxos revisados.
