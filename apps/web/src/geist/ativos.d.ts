/**
 * O `import simbolo from './em-simbolo.svg'` da casca. O Vite resolve o import para a URL
 * do arquivo ja versionado com hash, e sem esta declaracao o `tsc` nao sabe disso.
 *
 * A alternativa era `vite/client`, que traz junto o `ImportMeta` do Vite e briga com o
 * `types: ["bun"]` do `tsconfig.base.json`. Uma linha por extensao usada e mais barato.
 */
declare module '*.svg' {
  const url: string
  export default url
}
