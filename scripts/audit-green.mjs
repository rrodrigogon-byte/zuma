import fs from 'fs'
import path from 'path'

const targets = [
  'web/src/pages/public/Home.jsx',
  'web/src/pages/Login.jsx',
  'web/src/components/Sidebar.jsx',
  'web/src/components/Layout.jsx',
  'web/src/pages/PDV.jsx',
  'web/src/theme.css',
]
const greenHex = /#(?:008000|006400|228b22|2e8b57|3cb371|32cd32|00ff00|00a651|0b6e4f|14532d|166534|15803d|16a34a|22c55e|4ade80|86efac|bbf7d0|dcfce7)\b/gi
const greenNames = /['"](?:green|forestgreen|limegreen|seagreen|darkgreen|olivedrab)['"]/gi
let total = 0

for (const relativePath of targets) {
  const file = path.join(process.cwd(), relativePath)
  const text = fs.readFileSync(file, 'utf8')
  const matches = [...text.matchAll(greenHex), ...text.matchAll(greenNames)]
  if (matches.length) {
    total += matches.length
    console.log(`${relativePath}: ${matches.map(m => m[0]).join(', ')}`)
  }
}
console.log(`TOTAL=${total}`)
