const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

test('cairn deployment prompts use OpenFleet remote adapter instead of direct Discord bridge calls', () => {
  const deploymentPath = path.join(__dirname, '..', 'examples', 'cairn', 'deployment.json')
  const deployment = JSON.parse(fs.readFileSync(deploymentPath, 'utf8'))
  const promptText = Object.values(deployment.jobs)
    .flatMap((job) => job.prompt || [])
    .join('\n')

  assert.doesNotMatch(promptText, /reply_discord|claudecord\/scripts\/reply_discord/)
  assert.match(promptText, /node \/Users\/twaldin\/openfleet\/bin\/remote discord post/)
})
