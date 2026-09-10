import { chromium } from 'playwright'

const [original, convertido] = process.argv.slice(2)
if (!original || !convertido) throw new Error('Informe as folhas original e compilada.')
const browser = await chromium.launch()
try {
  const page = await browser.newPage()
  const normalized = []
  for (const path of [original, convertido]) {
    const css = (await Bun.file(path).text()).replaceAll('./fontes/', '/assets/')
    normalized.push(await page.evaluate((text) => {
      const sheet = new CSSStyleSheet()
      sheet.replaceSync(text)
      function rules(list: CSSRuleList): unknown[] {
        return Array.from(list).flatMap<unknown>(rule => {
          if (rule instanceof CSSStyleRule) {
            return [{ selector: rule.selectorText, declarations: rule.style.cssText.replace(/\s+/g, ' ') }]
          }
          if (rule instanceof CSSGroupingRule) {
            if (rule instanceof CSSLayerBlockRule && ['properties', 'utilities'].includes(rule.name)) return []
            return [{ condition: rule.cssText.slice(0, rule.cssText.indexOf('{')).trim(), rules: rules(rule.cssRules) }]
          }
          if (rule instanceof CSSLayerStatementRule) return []
          if (rule instanceof CSSPropertyRule && rule.name.startsWith('--tw-')) return []
          return [rule.cssText]
        })
      }
      return rules(sheet.cssRules)
    }, css))
  }
  await Bun.write('var/tailwind/cssom-original.json', JSON.stringify(normalized[0], null, 2))
  await Bun.write('var/tailwind/cssom-convertido.json', JSON.stringify(normalized[1], null, 2))
  if (JSON.stringify(normalized[0]) !== JSON.stringify(normalized[1])) {
    throw new Error('CSSOM difere. Compare os arquivos em var/tailwind/cssom-*.json.')
  }
  console.log('Seletores, declarações e condições idênticos no CSSOM.')
} finally {
  await browser.close()
}
