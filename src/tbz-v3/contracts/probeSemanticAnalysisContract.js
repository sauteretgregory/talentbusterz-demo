const SEMANTIC_RELATIONS = Object.freeze([
  'KNOWN',
  'NEW',
  'NUANCE',
  'CONTRADICTION',
  'UNKNOWN'
])

const SOURCE_TYPES = Object.freeze(['probe_response'])

function assertNonEmptyString(value, field) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${field} must be a non-empty string`)
  }
}

function validateEvidence(evidence) {
  if (!evidence || typeof evidence !== 'object') {
    throw new Error('interpretation.evidence must be an object')
  }

  assertNonEmptyString(evidence.source_type, 'interpretation.evidence.source_type')
  if (!SOURCE_TYPES.includes(evidence.source_type)) {
    throw new Error(`Unsupported evidence source_type: ${evidence.source_type}`)
  }

  assertNonEmptyString(evidence.source_id, 'interpretation.evidence.source_id')
  assertNonEmptyString(evidence.question_id, 'interpretation.evidence.question_id')
  assertNonEmptyString(evidence.response_hash, 'interpretation.evidence.response_hash')
}

function validateInterpretation(interpretation) {
  if (!interpretation || typeof interpretation !== 'object') {
    throw new Error('interpretation must be an object')
  }

  if (!SEMANTIC_RELATIONS.includes(interpretation.relation)) {
    throw new Error(`Unsupported semantic relation: ${interpretation.relation}`)
  }

  assertNonEmptyString(interpretation.claim, 'interpretation.claim')
  validateEvidence(interpretation.evidence)

  if (interpretation.relation === 'NEW' && interpretation.memory_item_id != null) {
    throw new Error('NEW interpretation must not invent memory_item_id')
  }

  if (
    interpretation.relation !== 'NEW' &&
    interpretation.relation !== 'UNKNOWN' &&
    interpretation.memory_item_id != null
  ) {
    assertNonEmptyString(interpretation.memory_item_id, 'interpretation.memory_item_id')
  }

  if (interpretation.relation === 'UNKNOWN' && interpretation.memory_item_id != null) {
    throw new Error('UNKNOWN interpretation must not reference memory_item_id')
  }
}

function validateProbeSemanticAnalysisState(state) {
  if (!state || typeof state !== 'object') {
    throw new Error('probe_semantic_analysis_state must be an object')
  }

  if (state.artifact_type !== 'probe_semantic_analysis_state') {
    throw new Error('artifact_type must be probe_semantic_analysis_state')
  }

  if (state.contract_version !== 'v1.0') {
    throw new Error('contract_version must be v1.0')
  }

  assertNonEmptyString(state.analysis_id, 'analysis_id')
  assertNonEmptyString(state.candidate_id, 'candidate_id')
  assertNonEmptyString(state.probe_cycle_id, 'probe_cycle_id')
  assertNonEmptyString(state.question_id, 'question_id')

  if (!state.response || typeof state.response !== 'object') {
    throw new Error('response must be an object')
  }

  assertNonEmptyString(state.response.response_id, 'response.response_id')
  assertNonEmptyString(state.response.text, 'response.text')

  if (!Array.isArray(state.interpretations)) {
    throw new Error('interpretations must be an array')
  }

  state.interpretations.forEach(validateInterpretation)

  // The semantic layer is interpretation-only. These fields are explicitly forbidden.
  const forbiddenFields = [
    'score',
    'delta',
    'score_delta',
    'weight',
    'match_score',
    'match_decision',
    'decision'
  ]

  forbiddenFields.forEach((field) => {
    if (Object.prototype.hasOwnProperty.call(state, field)) {
      throw new Error(`Forbidden semantic-analysis field: ${field}`)
    }
  })

  return true
}

module.exports = {
  SEMANTIC_RELATIONS,
  SOURCE_TYPES,
  validateProbeSemanticAnalysisState
}
