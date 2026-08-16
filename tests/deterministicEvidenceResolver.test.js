const assert = require('assert')
const { resolveSemanticAnalysis } = require('../src/tbz-v3/resolvers/deterministicEvidenceResolver')

function baseMemory() {
  return {
    candidate_memory: { items: [] },
    evidence: []
  }
}

function analysis(relation, claim, overrides = {}) {
  return {
    artifact_type: 'probe_semantic_analysis_state',
    contract_version: 'v1.0',
    analysis_id: overrides.analysis_id || 'SEM-001',
    candidate_id: 'CAN-001',
    probe_cycle_id: 'PROBE-001',
    question_id: overrides.question_id || 'Q1',
    response: {
      response_id: overrides.response_id || 'RESP-001',
      text: overrides.text || 'Réponse candidat'
    },
    interpretations: [
      {
        relation,
        memory_item_id: overrides.memory_item_id,
        claim,
        evidence: {
          source_type: 'probe_response',
          source_id: overrides.source_id || 'RESP-001',
          question_id: overrides.question_id || 'Q1',
          response_hash: overrides.response_hash || 'HASH-001'
        }
      }
    ]
  }
}

function memoryWithItem() {
  return {
    candidate_memory: {
      items: [
        {
          memory_item_id: 'MEM-001',
          claim: 'Expérience Python professionnelle',
          status: 'active',
          evidence_ids: []
        }
      ]
    },
    evidence: []
  }
}

// NEW creates one memory item and one evidence.
{
  const result = resolveSemanticAnalysis({
    candidateId: 'CAN-001',
    semanticAnalysis: analysis('NEW', 'Expérience Python professionnelle'),
    candidateMemoryState: baseMemory()
  })
  assert.strictEqual(result.resolutions[0].action, 'new')
  assert.strictEqual(result.candidate_data_state.candidate_memory.items.length, 1)
  assert.strictEqual(result.candidate_data_state.evidence.length, 1)
}

// KNOWN reuses existing memory and does not create a second memory item.
{
  const result = resolveSemanticAnalysis({
    candidateId: 'CAN-001',
    semanticAnalysis: analysis('KNOWN', 'Expérience Python professionnelle', {
      memory_item_id: 'MEM-001'
    }),
    candidateMemoryState: memoryWithItem()
  })
  assert.strictEqual(result.resolutions[0].action, 'known')
  assert.strictEqual(result.candidate_data_state.candidate_memory.items.length, 1)
  assert.strictEqual(result.candidate_data_state.evidence.length, 1)
}

// NUANCE updates the existing claim but keeps the same memory item.
{
  const result = resolveSemanticAnalysis({
    candidateId: 'CAN-001',
    semanticAnalysis: analysis('NUANCE', 'Expérience Python en automatisation', {
      memory_item_id: 'MEM-001'
    }),
    candidateMemoryState: memoryWithItem()
  })
  assert.strictEqual(result.candidate_data_state.candidate_memory.items[0].memory_item_id, 'MEM-001')
  assert.strictEqual(result.candidate_data_state.candidate_memory.items[0].claim, 'Expérience Python en automatisation')
  assert.strictEqual(result.candidate_data_state.candidate_memory.items[0].status, 'active')
}

// CONTRADICTION marks the existing memory contradicted; it never deletes it.
{
  const result = resolveSemanticAnalysis({
    candidateId: 'CAN-001',
    semanticAnalysis: analysis('CONTRADICTION', 'Je n’ai pas d’expérience Python', {
      memory_item_id: 'MEM-001'
    }),
    candidateMemoryState: memoryWithItem()
  })
  assert.strictEqual(result.candidate_data_state.candidate_memory.items[0].status, 'contradicted')
  assert.strictEqual(result.candidate_data_state.candidate_memory.items.length, 1)
  assert.strictEqual(result.candidate_data_state.evidence.length, 1)
}

// UNKNOWN never mutates memory or evidence.
{
  const state = memoryWithItem()
  const result = resolveSemanticAnalysis({
    candidateId: 'CAN-001',
    semanticAnalysis: analysis('UNKNOWN', 'Information non stabilisée'),
    candidateMemoryState: state
  })
  assert.strictEqual(result.resolutions[0].action, 'ignored')
  assert.strictEqual(result.candidate_data_state.candidate_memory.items.length, 1)
  assert.strictEqual(result.candidate_data_state.evidence.length, 0)
}

// Retrying the same response is idempotent.
{
  const first = resolveSemanticAnalysis({
    candidateId: 'CAN-001',
    semanticAnalysis: analysis('NEW', 'Expérience Python professionnelle'),
    candidateMemoryState: baseMemory()
  })
  const second = resolveSemanticAnalysis({
    candidateId: 'CAN-001',
    semanticAnalysis: analysis('NEW', 'Expérience Python professionnelle'),
    candidateMemoryState: first.candidate_data_state
  })
  assert.strictEqual(second.resolutions[0].action, 'duplicate')
  assert.strictEqual(second.candidate_data_state.candidate_memory.items.length, 1)
  assert.strictEqual(second.candidate_data_state.evidence.length, 1)
}

// A different response making the exact same canonical claim cannot create a second memory item.
{
  const first = resolveSemanticAnalysis({
    candidateId: 'CAN-001',
    semanticAnalysis: analysis('NEW', 'Expérience Python professionnelle'),
    candidateMemoryState: baseMemory()
  })
  const secondAnalysis = analysis('NEW', 'Expérience Python professionnelle', {
    source_id: 'RESP-002',
    response_id: 'RESP-002',
    response_hash: 'HASH-002'
  })
  const second = resolveSemanticAnalysis({
    candidateId: 'CAN-001',
    semanticAnalysis: secondAnalysis,
    candidateMemoryState: first.candidate_data_state
  })
  assert.strictEqual(second.resolutions[0].action, 'duplicate_claim')
  assert.strictEqual(second.candidate_data_state.candidate_memory.items.length, 1)
  assert.strictEqual(second.candidate_data_state.evidence.length, 2)
  assert.strictEqual(second.candidate_data_state.evidence[1].status, 'duplicate')
}

// The resolver must reject a semantic reference to an unknown memory item.
assert.throws(() => {
  resolveSemanticAnalysis({
    candidateId: 'CAN-001',
    semanticAnalysis: analysis('KNOWN', 'Unknown memory', { memory_item_id: 'MEM-X' }),
    candidateMemoryState: baseMemory()
  })
}, /unknown memory_item_id/)

console.log('deterministicEvidenceResolver: 8 tests passed')
