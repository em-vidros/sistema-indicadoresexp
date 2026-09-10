import { mkdir } from 'node:fs/promises'
import { chromium } from 'playwright'
import { CAMINHOS_DA_SPA } from '../apps/server/src/caminhos.ts'

const rotulo = process.argv[2]
if (!rotulo || !/^[\w-]+$/.test(rotulo)) throw new Error('Informe um rótulo para as capturas.')
const origem = process.env.PARIDADE_ORIGEM ?? 'http://localhost:3000'
const usuario = process.env.PARIDADE_USUARIO ?? 'livia'
const senha = process.env[`SENHA_${usuario.toUpperCase()}`]
if (!senha) throw new Error('Defina a senha do usuário de paridade no ambiente.')
const pasta = new URL(`../var/paridade/${rotulo}/`, import.meta.url).pathname
await mkdir(pasta, { recursive: true })
const browser = await chromium.launch({ args: ['--disable-gpu', '--force-color-profile=srgb'] })
try {
  for (const width of [390, 768, 1440]) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce' })
    const login = await context.request.post(`${origem}/api/entrar`, { data: { usuario, senha, lembrar: false } })
    if (!login.ok()) throw new Error(`Login respondeu ${login.status()}.`)
    if (process.env.PARIDADE_DIST) {
      const dist = process.env.PARIDADE_DIST
      await context.route(`${origem}/**`, async route => {
        const path = new URL(route.request().url()).pathname
        if (path.startsWith('/api/') || path.startsWith('/docs/')) return route.continue()
        const asset = path.startsWith('/assets/') || path.endsWith('.html') ? path : '/app.html'
        const file = Bun.file(`${dist}${asset}`)
        if (!await file.exists()) throw new Error(`Arquivo ausente na referência: ${asset}`)
        await route.fulfill({ body: Buffer.from(await file.arrayBuffer()), contentType: file.type })
      })
    }
    const page = await context.newPage()
    await page.clock.setFixedTime(new Date('2026-09-10T14:00:00Z'))
    const errors: string[] = []
    page.on('pageerror', error => errors.push(error.message))
    for (const path of CAMINHOS_DA_SPA) {
      await page.goto(`${origem}${path}`, { waitUntil: 'networkidle' })
      await page.evaluate(() => document.fonts.ready)
      await page.screenshot({ path: `${pasta}${width}-${path.slice(1)}.png`, fullPage: true, animations: 'disabled' })
      if (path === '/usuarios') {
        await page.getByRole('button', { name: 'Novo usuário', exact: true }).focus()
        await page.keyboard.press('Enter')
        await page.locator('dialog[open]').waitFor()
        await page.screenshot({ path: `${pasta}${width}-usuario-dialogo.png`, fullPage: true, animations: 'disabled' })
        await page.keyboard.press('Escape')
      }
    }
    await context.clearCookies()
    await page.goto(`${origem}/entrar.html`, { waitUntil: 'networkidle' })
    await page.evaluate(() => document.fonts.ready)
    await page.screenshot({ path: `${pasta}${width}-login.png`, fullPage: true, animations: 'disabled' })
    await page.getByRole('textbox').first().focus()
    await page.screenshot({ path: `${pasta}${width}-login-foco.png`, fullPage: true, animations: 'disabled' })
    await page.getByRole('button', { name: 'Entrar', exact: true }).hover()
    await page.screenshot({ path: `${pasta}${width}-login-hover.png`, fullPage: true, animations: 'disabled' })
    if (errors.length) throw new Error(errors.join('\n'))
    await context.close()
    console.log(`Capturas em ${width}px concluídas.`)
  }
} finally {
  await browser.close()
}
