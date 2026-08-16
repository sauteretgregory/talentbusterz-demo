const crypto = require('crypto')

const {
  validateProbeSemanticAnalysisState
} = require('../contracts/probeSemanticAnalysisContract')
const {
  buildEvidenceIdentity,
  validateCandidateMemoryState
} = require('../contracts/evidenceMemoryContract')

function assertNonEmptyString(value, field) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${field} must be a non-empty string`)
  }
}

function normalizeClaim(claim) {
  return String(claim)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9+#.\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function stableId(prefix, value) {
  const digest = crypto.createHash('sha256').update(value).digest('hex').slice(0, 16)
  return `${prefix}-${digest}`
}

function cloneState(state) {
  return {
    candidate_memory: {
      items: (state.candidate_memory?.items || []).map((item) => ({
        ...item,
        evidence_ids: [...(item.evidence_ids || [])]
      }))
    },
    evidence: (state.evidence || []).map((evidence) => ({ ...evidence }))
  }
}

function findEvidenceByResponse(state, responseHash, sourceId) {
  return state.evidence.find(
    (evidence) =>
      evidence.response_hash === responseHash &&
      evidence.source_id === sourceId
  )
}

function findMemoryByClaim(state, claim) {
  const normalized = normalizeClaim(claim)
  return state.candidate_memory.items.find(
    (item) => normalizeClaim(item.claim) === normalized
  )
}

function createMemoryItem({ candidateId, claim }) {
  const normalized = normalizeClaim(claim)
  return {
    memory_item_id: stableId('MEM', `${candidateId}:${normalized}`),
    claim,
    status: 'active',
    evidence_ids: []
  }
}

function createEvidence({ candidateId, memoryItemId, interpretation, status = 'active' }) {
  const { evidence } = interpretation
  const evidenceIdentity = buildEvidenceIdentity({
    candidateId,
    memoryItemId,
    sourceType: evidence.source_type,
    sourceId: evidence.source_id
  })

  return {
    evidence_id: stableId('EVD', evidenceIdentity),
    memory_item_id: memoryItemId,
    source_type: evidence.source_type,
    source_id: evidence.source_id,
    question_id: evidence.question_id,
    response_hash: evidence.response_hash,
    status
  }
}

function resolveInterpretation(state, candidateId, interpretation) {
  const responseEvidence = findEvidenceByResponse(
    state,
    interpretation.evidence.response_hash,
    interpretation.evidence.source_id
  )

  if (responseEvidence) {
    return {
      action: 'duplicate',
      evidence_id: responseEvidence.evidence_id,
      memory_item_id: responseEvidence.memory_item_id
    }
  }

  const relation = interpretation.relation

  if (relation === 'UNKNOWN') {
    return { action: 'ignored' }
  }

  let memoryItem = null

  if (interpretation.memory_item_id) {
    memoryItem = state.candidate_memory.items.find(
      (item) => item.memory_item_id === interpretation.memory_item_id
    )

    if (!memoryItem) {
      throw new Error(
        `Semantic interpretation references unknown memory_item_id: ${interpretation.memory_item_id}`
      )
    }
  }

  if (relation === 'NEW') {
    memoryItem = findMemoryByClaim(state, interpretation.claim)

    if (memoryItem) {
      const evidence = createEvidence({
        candidateId,
        memoryItemId: memoryItem.memory_item_id,
        interpretation,
        status: 'duplicate'
      })
      state.evidence.push(evidence)
      return {
        action: 'duplicate_claim',
        evidence_id: evidence.evidence_id,
        memory_item_id: memoryItem.memory_item_id
      }
    }

    memoryItem = createMemoryItem({ candidateId, claim: interpretation.claim })
    state.candidate_memory.items.push(memoryItem)
  }

  if (!memoryItem) {
    throw new Error(`Relation ${relation} requires a resolvable memory item`)
  }

  if (relation === 'CONTRADICTION') {
    memoryItem.status = 'contradicted'
  }

  if (relation === 'NUANCE') {
    memoryItem.claim = interpretation.claim
  }

  const evidence = createEvidence({
    candidateId,
    memoryItemId: memoryItem.memory_item_id,
    interpretation
  })

  state.evidence.push(evidence)
  memoryItem.evidence_ids.push(evidence.evidence_id)

  return {
    action: relation.toLowerCase(),
    evidence_id: evidence.evidence_id,
    memory_item_id: memoryItem.memory_item_id
  }
}

function resolveSemanticAnalysis({ candidateId, semanticAnalysis, candidateMemoryState }) {
  assertNonEmptyString(candidateId, 'candidateId')
  validateProbeSemanticAnalysisState(semanticAnalysis)
  validateCandidateMemoryState(candidateMemoryState)

  if (semanticAnalysis.candidate_id !== candidateId) {
    throw new Error('candidateId does not match semanticAnalysis.candidate_id')
  }

  const state = cloneState(candidateMemoryState)
  const resolutions = semanticAnalysis.interpretations.map((interpretation) =>
    resolveInterpretation(state, candidateId, interpretation)
  )

  validateCandidateMemoryState(state)

  return {
    resolution_version: 'v1.0',
    analysis_id: semanticAnalysis.analysis_id,
    candidate_data_state: state,
    resolutions
  }
}

module.exports = {
  normalizeClaim,
  resolveSemanticAnalysis
}
