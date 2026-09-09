import test from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'

import candidate from '../src/tbz-v3/fixtures/doctrine/candidate.json' with { type: 'json' }
import job from '../src/tbz-v3/fixtures/job-france-travail-210SDTY.json' with { type: 'json' }
import match from '../src/tbz-v3/fixtures/match-france-travail-210SDTY.json' with { type: 'json' }
import probe from '../src/tbz-v3/fixtures/probe-france-travail-210SDTY.json' with { type: 'json' }

const PORT = 8787
const BASE_URL = `http://127.0.0.1:${PORT}`

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

async function postProbeResponses(body) {
  const response = await fetch(`${BASE_URL}/api/probe-responses`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  })

  return {
    status: response.status,
    body: await response.json()
  }
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

test('HTTP probe response loop transports previous_match_state into score delta calculation', async () => {
  await withServer(async () => {
    const result = await postProbeResponses({
      canonical_candidate_data_state: candidate,
      canonical_job_data_state: job,
      canonical_probe_plan: probe,
      previous_match_state: match,
      responses: [
        {
          question_id: 'MPC_FT_002',
          answer: 'Je me situe à un niveau B2 en anglais professionnel, utilisé régulièrement avec des candidats et clients internationaux.'
        }
      ]
    })

    assert.equal(result.status, 200)
    assert.equal(result.body.previous_score, 74)
    assert.equal(typeof result.body.current_score, 'number')
    assert.equal(result.body.score_delta, result.body.current_score - result.body.previous_score)
    assert.equal(result.body.canonical_application_readiness_state.artifact_type, 'canonical_application_readiness_state')
    assert.equal(result.body.canonical_application_readiness_state.application_readiness.status, 'not_ready')
    assert.equal(result.body.canonical_application_readiness_state.application_readiness.recommendation, 'continue_enrichment')
    assert.equal(result.body.canonical_application_readiness_state.source_alignment.probe.artifact_id, probe.artifact_id)
  })
})

test('HTTP continue_enrichment preserves previous match without rerunning MATCH and updates readiness', async () => {
  await withServer(async () => {
    const result = await postProbeResponses({
      canonical_candidate_data_state: candidate,
      canonical_job_data_state: job,
      canonical_probe_plan: probe,
      previous_match_state: match,
      responses: [
        { control: 'continue_enrichment' }
      ],
      cycle_number: 1
    })

    assert.equal(result.status, 200)
    assert.equal(result.body.probe_cycle_status, 'open')
    assert.equal(result.body.probe_adaptive_decision, 'continue_enrichment')
    assert.deepEqual(result.body.canonical_match_state, match)
    assert.equal(result.body.enrichment_cycle.cycle_number, 2)
    assert.equal(result.body.canonical_probe_plan.probe_result.loop_status, 'open')
    assert.equal(result.body.canonical_probe_plan.probe_result.adaptive_decision, 'continue_enrichment')
    assert.equal(result.body.canonical_application_readiness_state.artifact_type, 'canonical_application_readiness_state')
    assert.equal(result.body.canonical_application_readiness_state.application_readiness.status, 'not_ready')
    assert.equal(result.body.canonical_application_readiness_state.application_readiness.recommendation, 'continue_enrichment')
  })
})
