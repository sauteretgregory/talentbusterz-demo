import test from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import fs from 'node:fs/promises'
import path from 'node:path'

import candidate from '../src/tbz-v3/fixtures/doctrine/candidate.json' with { type: 'json' }
import job from '../src/tbz-v3/fixtures/job-france-travail-210SDTY.json' with { type: 'json' }
import match from '../src/tbz-v3/fixtures/match-france-travail-210SDTY.json' with { type: 'json' }
import probe from '../src/tbz-v3/fixtures/probe-france-travail-210SDTY.json' with { type: 'json' }

const PORT = 8787
const BASE_URL = `http://127.0.0.1:${PORT}`
const CANDIDATE_ID = candidate.candidate_data_state.candidate_id
const MEMORY_FILE = path.resolve('server/output/candidate-memory', `${CANDIDATE_ID}.json`)

async function startServer() {
  const child = spawn(process.execPath, ['server/index.js'], {
    env: {
      ...process.env,
      TBZ_ENGINE_MODE: 'deterministic'
    },
    stdio: ['ignore', 'pipe', 'pipe']
  })

  let output = ''
  const onData = (chunk) => {
    output += chunk.toString()
  }

  child.stdout.on('data', onData)
  child.stderr.on('data', onData)

  const deadline = Date.now() + 5000
  while (Date.now() < deadline) {
    if (output.includes('TBZ backend listening on http://localhost:8787')) {
      return child
    }
    if (child.exitCode !== null) {
      throw new Error(`server exited before startup: ${output}`)
    }
    await new Promise((resolve) => setTimeout(resolve, 25))
  }

  child.kill('SIGTERM')
  throw new Error(`server did not start within timeout: ${output}`)
}

async function withServer(fn) {
  const server = await startServer()
  try {
    return await fn()
  } finally {
    server.kill('SIGTERM')
    await new Promise((resolve) => server.once('exit', resolve))
  }
}

async function postProbeResponses(body) {
  const response = await fetch(`${BASE_URL}/api/probe-responses`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })

  return { status: response.status, body: await response.json() }
}

async function getCandidateMemory(candidateId) {
  const response = await fetch(`${BASE_URL}/api/candidate-memory/${encodeURIComponent(candidateId)}`)
  return { status: response.status, body: await response.json() }
}

// This test proves the exact scenario the "still available after a page
// reload" requirement describes: answer one targeted question over real
// HTTP, then hit the new GET endpoint the browser calls on mount and check
// it returns that same persisted, enriched candidate state.
test('GET /api/candidate-memory/:id returns, after a real reload-equivalent lookup, the exact candidate state a targeted answer just produced', async () => {
  await fs.rm(MEMORY_FILE, { force: true })

  try {
    await withServer(async () => {
      const answered = await postProbeResponses({
        canonical_candidate_data_state: candidate,
        canonical_job_data_state: job,
        canonical_probe_plan: probe,
        previous_match_state: match,
        responses: [{
          question_id: 'MPC_FT_002',
          answer: 'Je me situe à un niveau B2 en anglais professionnel, utilisé régulièrement avec des candidats et clients internationaux.'
        }]
      })

      assert.equal(answered.status, 200)
      assert.equal(answered.body.candidate_memory_persisted, true)
      assert.deepEqual(
        answered.body.canonical_candidate_data_state.candidate_data_state.probe_response_state.applied_question_ids,
        ['MPC_FT_002']
      )

      const reloaded = await getCandidateMemory(CANDIDATE_ID)

      assert.equal(reloaded.status, 200)
      assert.equal(reloaded.body.status, 'completed')
      assert.equal(reloaded.body.candidate_id, CANDIDATE_ID)

      // The whole point of the "reload" requirement: what mount-time
      // rehydration fetches must be *exactly* what the answered question
      // just produced, not a re-derived or partial copy.
      assert.deepEqual(
        reloaded.body.canonical_candidate_data_state,
        answered.body.canonical_candidate_data_state
      )
      assert.deepEqual(
        reloaded.body.canonical_candidate_data_state.candidate_data_state.probe_response_state.applied_question_ids,
        ['MPC_FT_002']
      )
    })
  } finally {
    await fs.rm(MEMORY_FILE, { force: true })
  }
})

test('GET /api/candidate-memory/:id returns 404 for a candidate that has never answered anything (first-ever visit)', async () => {
  await withServer(async () => {
    const result = await getCandidateMemory('candidate_never_seen_before_xyz')
    assert.equal(result.status, 404)
    assert.equal(result.body.status, 'not_found')
  })
})
