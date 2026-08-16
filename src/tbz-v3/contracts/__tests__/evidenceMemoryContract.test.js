const test = require('node:test')
const assert = require('node:assert/strict')

const {
  buildEvidenceIdentity,
  validateCandidateMemoryState
} = require('../evidenceMemoryContract')

const validState = {
  candidate_memory: {
    items: [
      {
        memory_item_id: 'MEM-001',
        claim: 'Experience Python professionnelle',
        status: 'active',
        evidence_ids: ['EVD-001']
      }
    ]
  },
  evidence: [
    {
      evidence_id: 'EVD-001',
      memory_item_id: 'MEM-001',
      source_type: 'probe_response',
      source_id: 'RESP-001',
      question_id: 'Q1',
      response_hash: 'hash-001',
      status: 'active'
    }
  ]
}

test('accepts a valid candidate memory state', () => {
  assert.equal(validateCandidateMemoryState(validState), true)
})

test('creates deterministic evidence identity from canonical components', () => {
  assert.equal(
    buildEvidenceIdentity({
      candidateId: 'CAND-001',
      memoryItemId: 'MEM-001',
      sourceType: 'probe_response',
      sourceId: 'RESP-001'
    }),
    'CAND-001:MEM-001:probe_response:RESP-001'
  )
})

test('rejects duplicate memory ids', () => {
  const state = structuredClone(validState)
  state.candidate_memory.items.push({
    memory_item_id: 'MEM-001',
    claim: 'Duplicate',
    status: 'active',
    evidence_ids: []
  })
  assert.throws(() => validateCandidateMemoryState(state), /Duplicate memory_item_id/)
})

test('rejects evidence pointing to unknown memory', () => {
  const state = structuredClone(validState)
  state.evidence[0].memory_item_id = 'MEM-UNKNOWN'
  assert.throws(() => validateCandidateMemoryState(state), /unknown memory_item_id/)
})

test('rejects memory items pointing to unknown evidence', () => {
  const state = structuredClone(validState)
  state.candidate_memory.items[0].evidence_ids = ['EVD-UNKNOWN']
  assert.throws(() => validateCandidateMemoryState(state), /unknown evidence_id/)
})
