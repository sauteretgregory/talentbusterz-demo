import test from 'node:test'
import assert from 'node:assert/strict'

import candidate from '../src/tbz-v3/fixtures/doctrine/candidate.json' with { type: 'json' }
import job from '../src/tbz-v3/fixtures/job-france-travail-210SDTY.json' with { type: 'json' }
import { createTbzEngineRegistry } from './engineRegistry.js'
import { ENGINE_IDS, executeEngine } from './engineGateway.js'
import { createMemoryCandidateMemoryRepository } from './repositories/memoryCandidateMemoryRepository.js'

test('LAB: Candidate Engine state is persisted before MATCH consumes it', async () => {
  const registry = createTbzEngineRegistry({ engineMode: 'deterministic' })
  const repository = createMemoryCandidateMemoryRepository()
  const candidateId = candidate.candidate_data_state.candidate_id

  const candidateExecution = await executeEngine(registry, ENGINE_IDS.CANDIDATE, {
    candidate_data_state: candidate,
    probe_responses: [{
      question_id: 'MPC_FT_002',
      answer: 'Je me situe à un niveau B2 en anglais professionnel, utilisé régulièrement avec des candidats et clients internationaux.'
    }]
  })

  assert.equal(candidateExecution.status, 'completed')
  const updatedCandidate = candidateExecution.output_artifact
  assert.equal(updatedCandidate.state_version, 'v1.4_probe_response_integration')

  const persisted = await repository.save(
    candidateId,
    updatedCandidate,
    candidate.state_version
  )
  assert.equal(persisted.status, 'persisted')

  const reloadedCandidate = await repository.get(candidateId)
  assert.deepEqual(reloadedCandidate, updatedCandidate)

  const matchExecution = await executeEngine(registry, ENGINE_IDS.MATCH, {
    candidate_data_state: reloadedCandidate,
    job_data_state: job
  })

  assert.equal(matchExecution.status, 'completed')
  assert.ok(matchExecution.output_artifact)
})

test('LAB: stale persistence conflict prevents promotion of a newer candidate state', async () => {
  const repository = createMemoryCandidateMemoryRepository([candidate])
  const candidateId = candidate.candidate_data_state.candidate_id

  const newerState = structuredClone(candidate)
  newerState.state_version = 'v1.5_probe_response_integration'
  newerState.candidate_data_state.state_version = 'v1.5_probe_response_integration'

  await assert.rejects(
    () => repository.save(candidateId, newerState, 'v0.0_stale_version'),
    (error) => error.code === 'CANDIDATE_MEMORY_CONFLICT'
  )

  const persistedState = await repository.get(candidateId)
  assert.equal(persistedState.state_version, candidate.state_version)
})
