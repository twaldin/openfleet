const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

test('deployment prompts do not reference deprecated tools', () => {
  const deploymentPath = path.join(__dirname, 'fixtures', 'deployment.json')
  const deployment = JSON.parse(fs.readFileSync(deploymentPath, 'utf8'))
  const promptText = Object.values(deployment.jobs)
    .flatMap((job) => job.prompt || [])
    .join('\n')

  assert.doesNotMatch(promptText, /reply_discord|claudecord/)
})
