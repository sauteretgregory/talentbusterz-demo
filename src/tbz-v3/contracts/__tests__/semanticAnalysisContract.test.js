const test = require('node:test')
const assert = require('node:assert/strict')

const {
  validateProbeSemanticAnalysisState
} = require('../probeSemanticAnalysisContract')

const baseState = {
  artifact_type: 'probe_semantic_analysis_state',
  contract_version: 'v1.0',
  analysis_id: 'SEM-001',
  candidate_id: 'CAND-001',
  probe_cycle_id: 'PROBE-001',
  question_id: 'Q1',
  response: {
    response_id: 'RESP-001',
    text: 'Oui, j utilise Python au travail.'
  },
  interpretations: [
    {
      relation: 'KNOWN',
      memory_item_id: 'MEM-001',
      claim: 'Experience Python professionnelle',
      evidence: {
        source_type: 'probe_response',
        source_id: 'RESP-001',
        question_id: 'Q1',
        response_hash: 'hash-001'
      }
    }
  ]
}

test('accepts a valid semantic analysis state', () => {
  assert.equal(validateProbeSemanticAnalysisState(baseState), true)
})

test('accepts all five semantic relations', () => {
  for (const relation of ['KNOWN', 'NEW', 'NUANCE', 'CONTRADICTION', 'UNKNOWN']) {
    const state = structuredClone(baseState)
    state.interpretations[0] = {
      ...state.interpretations[0],
      relation,
      memory_item_id: relation === 'NEW' || relation === 'UNKNOWN' ? null : 'MEM-001'
    }
    assert.equal(validateProbeSemanticAnalysisState(state), true)
  }
})

test('rejects semantic score fields', () => {
  const state = structuredClone(baseState)
  state.score = 82
  assert.throws(() => validateProbeSemanticAnalysisState(state), /Forbidden semantic-analysis field: score/)
})

test('rejects invented memory id on NEW', () => {
  const state = structuredClone(baseState)
  state.interpretations[0].relation = 'NEW'
  state.interpretations[0].memory_item_id = 'MEM-INVENTED'
  assert.throws(() => validateProbeSemanticAnalysisState(state), /must not invent memory_item_id/)
})

test('rejects memory reference on UNKNOWN', () => {
  const state = structuredClone(baseState)
  state.interpretations[0].relation = 'UNKNOWN'
  assert.throws(() => validateProbeSemanticAnalysisState(state), /UNKNOWN interpretation must not reference memory_item_id/)
})
