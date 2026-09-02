# A baseline da paridade

Cada pasta aqui e uma tela congelada: o DOM normalizado depois de cada passo do
roteiro, o CSS, os efeitos que cada clique disparou, os handlers que a tela chama por
atributo.

A foto de cada passo nao mora aqui. Ela sai em `var/paridade-fotos/`, fora do git, na
hora da captura. Ela nunca e comparada, e as sete telas dariam uns 10 MB de binario que
muda a cada recaptura; quem investiga uma divergencia tem a linha exata do DOM.

`bun verificar/paridade.ts` abre `apps/web/dist/` num Chromium e cobra igualdade com
o que esta aqui. E o que permite portar tela a tela sem tocar na prova: um `.tsx` que
monte a mesma arvore passa.

Regravar uma tela e `bun verificar/paridade.ts --capturar --tela <nome>`, e sobre uma
baseline que ja existe so com `--forcar`. Regravar apaga a prova de que a tela nao
mudou, entao e decisao declarada e revisada no diff, nunca rotina para calar vermelho.
