const MEMORY_STATUSES = Object.freeze(['active', 'contradicted'])
const EVIDENCE_STATUSES = Object.freeze(['active', 'superseded', 'duplicate'])
const EVIDENCE_SOURCE_TYPES = Object.freeze(['probe_response'])

function assertNonEmptyString(value, field) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${field} must be a non-empty string`)
  }
}

function validateEvidence(evidence) {
  if (!evidence || typeof evidence !== 'object') {
    throw new Error('evidence must be an object')
  }

  assertNonEmptyString(evidence.evidence_id, 'evidence.evidence_id')
  assertNonEmptyString(evidence.memory_item_id, 'evidence.memory_item_id')
  assertNonEmptyString(evidence.source_type, 'evidence.source_type')
  assertNonEmptyString(evidence.source_id, 'evidence.source_id')
  assertNonEmptyString(evidence.question_id, 'evidence.question_id')
  assertNonEmptyString(evidence.response_hash, 'evidence.response_hash')

  if (!EVIDENCE_SOURCE_TYPES.includes(evidence.source_type)) {
    throw new Error(`Unsupported evidence source_type: ${evidence.source_type}`)
  }

  if (!EVIDENCE_STATUSES.includes(evidence.status)) {
    throw new Error(`Unsupported evidence status: ${evidence.status}`)
  }
}

function validateMemoryItem(item) {
  if (!item || typeof item !== 'object') {
    throw new Error('candidate_memory item must be an object')
  }

  assertNonEmptyString(item.memory_item_id, 'memory_item.memory_item_id')
  assertNonEmptyString(item.claim, 'memory_item.claim')

  if (!MEMORY_STATUSES.includes(item.status)) {
    throw new Error(`Unsupported memory status: ${item.status}`)
  }

  if (!Array.isArray(item.evidence_ids)) {
    throw new Error('memory_item.evidence_ids must be an array')
  }
}

function validateCandidateMemoryState(state) {
  if (!state || typeof state !== 'object') {
    throw new Error('candidate_memory_state must be an object')
  }

  if (!state.candidate_memory || typeof state.candidate_memory !== 'object') {
    throw new Error('candidate_memory must be an object')
  }

  if (!Array.isArray(state.candidate_memory.items)) {
    throw new Error('candidate_memory.items must be an array')
  }

  if (!Array.isArray(state.evidence)) {
    throw new Error('evidence must be an array')
  }

  state.candidate_memory.items.forEach(validateMemoryItem)
  state.evidence.forEach(validateEvidence)

  const memoryIds = new Set()
  state.candidate_memory.items.forEach((item) => {
    if (memoryIds.has(item.memory_item_id)) {
      throw new Error(`Duplicate memory_item_id: ${item.memory_item_id}`)
    }
    memoryIds.add(item.memory_item_id)
  })

  const evidenceIds = new Set()
  state.evidence.forEach((evidence) => {
    if (evidenceIds.has(evidence.evidence_id)) {
      throw new Error(`Duplicate evidence_id: ${evidence.evidence_id}`)
    }
    evidenceIds.add(evidence.evidence_id)

    if (!memoryIds.has(evidence.memory_item_id)) {
      throw new Error(`Evidence references unknown memory_item_id: ${evidence.memory_item_id}`)
    }
  })

  state.candidate_memory.items.forEach((item) => {
    item.evidence_ids.forEach((evidenceId) => {
      if (!evidenceIds.has(evidenceId)) {
        throw new Error(`Memory item references unknown evidence_id: ${evidenceId}`)
      }
    })
  })

  return true
}

function buildEvidenceIdentity({ candidateId, memoryItemId, sourceType, sourceId }) {
  assertNonEmptyString(candidateId, 'candidateId')
  assertNonEmptyString(memoryItemId, 'memoryItemId')
  assertNonEmptyString(sourceType, 'sourceType')
  assertNonEmptyString(sourceId, 'sourceId')

  return [candidateId, memoryItemId, sourceType, sourceId].join(':')
}

module.exports = {
  MEMORY_STATUSES,
  EVIDENCE_STATUSES,
  EVIDENCE_SOURCE_TYPES,
  buildEvidenceIdentity,
  validateCandidateMemoryState
}
