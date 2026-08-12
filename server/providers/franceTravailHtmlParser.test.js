import assert from 'node:assert/strict'

import {
  parseFranceTravailHtml
} from './franceTravailHtmlParser.js'

const html = `
<!doctype html>
<html>
  <head>
    <style>.hidden { display:none }</style>
    <script>console.log('ignore me')</script>
  </head>
  <body>
    <h1>Talent Acquisition Manager</h1>
    <p>Entreprise : Exemple</p>
    <section>
      <h2>Description du poste</h2>
      <p>Recrutement, sourcing et accompagnement des managers.</p>
    </section>
    <section>
      <h2>Profil recherché</h2>
      <p>Expérience en recrutement et anglais courant.</p>
    </section>
  </body>
</html>
`

const result = parseFranceTravailHtml(html)

assert.equal(
  result.parser_id,
  'france_travail_public_html_parser'
)

assert.equal(
  result.parser_version,
  'v1'
)

assert.ok(
  result.raw_job_content.includes(
    'Talent Acquisition Manager'
  )
)

assert.ok(
  result.raw_job_content.includes(
    'Description du poste'
  )
)

assert.ok(
  result.raw_job_content.includes(
    'Profil recherché'
  )
)

assert.equal(
  result.raw_job_content.includes('console.log'),
  false
)

assert.equal(
  result.structured_source_data,
  null
)

console.log('✓ France Travail HTML parser mock test passed')
console.log(
  'Parsed length:',
  result.raw_job_content.length
)
