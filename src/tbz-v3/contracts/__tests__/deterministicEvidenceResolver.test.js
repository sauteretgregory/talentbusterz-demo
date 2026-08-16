const assert = require('assert')
const { resolveSemanticAnalysis } = require('../../resolvers/deterministicEvidenceResolver')

const baseMemory = () => ({ candidate_memory: { items: [] }, evidence: [] })

function semantic(relation, claim, overrides = {}) {
  return {
    artifact_type: 'probe_semantic_analysis_state',
    contract_version: 'v1.0',
    analysis_id: overrides.analysis_id || 'SEM-001',
    candidate_id: 'CAN-001',
    probe_cycle_id: 'PROBE-001',
    question_id: overrides.question_id || 'Q1',
    response: { response_id: overrides.response_id || overrides.source_id || 'RESP-001', text: 'Réponse candidat' },
    interpretations: [{
      relation,
      memory_item_id: overrides.memory_item_id,
      claim,
      evidence: {
        source_type: 'probe_response',
        source_id: overrides.source_id || 'RESP-001',
        question_id: overrides.question_id || 'Q1',
        response_hash: overrides.response_hash || 'HASH-001'
      }
    }]
  }
}

const existingMemory = () => ({
  candidate_memory: { items: [{ memory_item_id: 'MEM-001', claim: 'Expérience Python professionnelle', status: 'active', evidence_ids: [] }] },
  evidence: []
})

// NEW
let result = resolveSemanticAnalysis({ candidateId: 'CAN-001', semanticAnalysis: semantic('NEW', 'Expérience Python professionnelle'), candidateMemoryState: baseMemory() })
assert.strictEqual(result.resolutions[0].action, 'new')
assert.strictEqual(result.candidate_data_state.candidate_memory.items.length, 1)
assert.strictEqual(result.candidate_data_state.evidence.length, 1)

// KNOWN
result = resolveSemanticAnalysis({ candidateId: 'CAN-001', semanticAnalysis: semantic('KNOWN', 'Expérience Python professionnelle', { memory_item_id: 'MEM-001' }), candidateMemoryState: existingMemory() })
assert.strictEqual(result.resolutions[0].action, 'known')
assert.strictEqual(result.candidate_data_state.candidate_memory.items.length, 1)
assert.strictEqual(result.candidate_data_state.evidence.length, 1)

// NUANCE
result = resolveSemanticAnalysis({ candidateId: 'CAN-001', semanticAnalysis: semantic('NUANCE', 'Expérience Python en automatisation', { memory_item_id: 'MEM-001' }), candidateMemoryState: existingMemory() })
assert.strictEqual(result.candidate_data_state.candidate_memory.items[0].claim, 'Expérience Python en automatisation')
assert.strictEqual(result.candidate_data_state.candidate_memory.items[0].status, 'active')

// CONTRADICTION
result = resolveSemanticAnalysis({ candidateId: 'CAN-001', semanticAnalysis: semantic('CONTRADICTION', 'Je n’ai pas d’expérience Python', { memory_item_id: 'MEM-001' }), candidateMemoryState: existingMemory() })
assert.strictEqual(result.candidate_data_state.candidate_memory.items[0].status, 'contradicted')
assert.strictEqual(result.candidate_data_state.candidate_memory.items.length, 1)

// UNKNOWN
result = resolveSemanticAnalysis({ candidateId: 'CAN-001', semanticAnalysis: semantic('UNKNOWN', 'Information non stabilisée'), candidateMemoryState: existingMemory() })
assert.strictEqual(result.resolutions[0].action, 'ignored')
assert.strictEqual(result.candidate_data_state.evidence.length, 0)

// Same response is idempotent.
const first = resolveSemanticAnalysis({ candidateId: 'CAN-001', semanticAnalysis: semantic('NEW', 'Expérience Python professionnelle'), candidateMemoryState: baseMemory() })
const duplicate = resolveSemanticAnalysis({ candidateId: 'CAN-001', semanticAnalysis: semantic('NEW', 'Expérience Python professionnelle'), candidateMemoryState: first.candidate_data_state })
assert.strictEqual(duplicate.resolutions[0].action, 'duplicate')
assert.strictEqual(duplicate.candidate_data_state.candidate_memory.items.length, 1)
assert.strictEqual(duplicate.candidate_data_state.evidence.length, 1)

// Same canonical claim from a different response cannot create another memory item.
const second = resolveSemanticAnalysis({
  candidateId: 'CAN-001',
  semanticAnalysis: semantic('NEW', 'Expérience Python professionnelle', { source_id: 'RESP-002', response_id: 'RESP-002', response_hash: 'HASH-002' }),
  candidateMemoryState: first.candidate_data_state
})
assert.strictEqual(second.resolutions[0].action, 'duplicate_claim')
assert.strictEqual(second.candidate_data_state.candidate_memory.items.length, 1)
assert.strictEqual(second.candidate_data_state.evidence.length, 2)
assert.strictEqual(second.candidate_data_state.evidence[1].status, 'duplicate')

// Unknown memory references are rejected.
assert.throws(() => resolveSemanticAnalysis({
  candidateId: 'CAN-001',
  semanticAnalysis: semantic('KNOWN', 'Unknown memory', { memory_item_id: 'MEM-X' }),
  candidateMemoryState: baseMemory()
}), /unknown memory_item_id/)

// Resolver cannot introduce scoring authority.
assert.strictEqual(Object.prototype.hasOwnProperty.call(result, 'score'), false)
assert.strictEqual(Object.prototype.hasOwnProperty.call(result, 'delta'), false)

console.log('deterministicEvidenceResolver: 8 tests passed')
