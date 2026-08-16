import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import candidate from '../src/tbz-v3/fixtures/doctrine/candidate.json' with { type: 'json' }
import { createCandidateMemoryStore } from './candidateMemoryStore.js'

test('candidate memory persists enrichment across multiple offer contexts', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'tbz-candidate-memory-'))
  const store = createCandidateMemoryStore({ directory })

  try {
    const initial = await store.resolve({ candidate })
    assert.equal(initial.source, 'initial_candidate')

    const enriched = structuredClone(candidate)
    enriched.candidate_data_state.continuous_enrichment_state = {
      profile_scope: 'persistent_candidate_profile',
      evidence_items: [{
        question_id: 'probe_offer_a_001',
        response: 'Expérience confirmée pendant la candidature A',
        evidence_status: 'confirmed',
        evidence_origin_type: 'direct_user_statement'
      }]
    }
    enriched.candidate_data_state.probe_response_state = {
      applied_question_ids: ['probe_offer_a_001']
    }

    await store.save(enriched)

    const offerB = await store.resolve({
      candidateId: candidate.candidate_data_state.candidate_id,
      candidate: structuredClone(candidate)
    })

    assert.equal(offerB.source, 'persistent_memory')
    assert.equal(
      offerB.candidate.candidate_data_state.continuous_enrichment_state.evidence_items[0].question_id,
      'probe_offer_a_001'
    )
    assert.deepEqual(
      offerB.candidate.candidate_data_state.probe_response_state.applied_question_ids,
      ['probe_offer_a_001']
    )
  } finally {
    await fs.rm(directory, { recursive: true, force: true })
  }
})

test('candidate memory requires a candidate id and does not silently create an unrelated profile', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'tbz-candidate-memory-'))
  const store = createCandidateMemoryStore({ directory })

  try {
    await assert.rejects(
      () => store.resolve(),
      /candidate_id is required/
    )
    assert.equal(await store.load('missing_candidate'), null)
  } finally {
    await fs.rm(directory, { recursive: true, force: true })
  }
})
