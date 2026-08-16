const CONTRACT_VERSION = 'v1.0'
const ARTIFACT_TYPE = 'probe_semantic_analysis_state'

const ALLOWED_RELATIONS = Object.freeze([
  'KNOWN',
  'NEW',
  'NUANCE',
  'CONTRADICTION',
  'UNKNOWN'
])

const FORBIDDEN_FIELDS = Object.freeze([
  'score',
  'delta',
  'score_delta',
  'weight',
  'match_score',
  'match_decision',
  'decision',
  'recommendation'
])

const ROOT_FIELDS = Object.freeze([
  'artifact_type',
  'contract_version',
  'analysis_id',
  'candidate_id',
  'probe_cycle_id',
  'question_id',
  'response',
  'interpretations'
])

const RESPONSE_FIELDS = Object.freeze([
  'response_id',
  'text'
])

const INTERPRETATION_FIELDS = Object.freeze([
  'relation',
  'memory_item_id',
  'claim',
  'evidence'
])

const EVIDENCE_FIELDS = Object.freeze([
  'source_type',
  'source_id',
  'question_id',
  'response_hash'
])

function assertPlainObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`)
  }
}

function assertString(value, label) {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`${label} must be a non-empty string.`)
  }
}

function assertNullableString(value, label) {
  if (value !== null && (typeof value !== 'string' || value.length === 0)) {
    throw new Error(`${label} must be null or a non-empty string.`)
  }
}

function assertExactFields(object, allowedFields, label) {
  for (const field of Object.keys(object)) {
    if (FORBIDDEN_FIELDS.includes(field)) {
      throw new Error(`Forbidden semantic-analysis field: ${field}`)
    }
    if (!allowedFields.includes(field)) {
      throw new Error(`Unknown semantic-analysis field: ${label}.${field}`)
    }
  }
}

function assertRequiredFields(object, requiredFields, label) {
  for (const field of requiredFields) {
    if (!Object.prototype.hasOwnProperty.call(object, field)) {
      throw new Error(`Missing semantic-analysis field: ${label}.${field}`)
    }
  }
}

function validateResponse(response) {
  assertPlainObject(response, 'response')
  assertExactFields(response, RESPONSE_FIELDS, 'response')
  assertRequiredFields(response, RESPONSE_FIELDS, 'response')
  assertString(response.response_id, 'response.response_id')
  assertString(response.text, 'response.text')
}

function validateEvidence(evidence) {
  assertPlainObject(evidence, 'interpretation.evidence')
  assertExactFields(evidence, EVIDENCE_FIELDS, 'interpretation.evidence')
  assertRequiredFields(evidence, EVIDENCE_FIELDS, 'interpretation.evidence')
  assertString(evidence.source_type, 'interpretation.evidence.source_type')
  assertString(evidence.source_id, 'interpretation.evidence.source_id')
  assertString(evidence.question_id, 'interpretation.evidence.question_id')
  assertString(evidence.response_hash, 'interpretation.evidence.response_hash')
}

function validateInterpretation(interpretation, index) {
  const label = `interpretations[${index}]`
  assertPlainObject(interpretation, label)
  assertExactFields(interpretation, INTERPRETATION_FIELDS, label)
  assertRequiredFields(interpretation, ['relation', 'claim', 'evidence'], label)

  if (!ALLOWED_RELATIONS.includes(interpretation.relation)) {
    throw new Error(`Invalid semantic relation: ${interpretation.relation}`)
  }

  assertString(interpretation.claim, `${label}.claim`)
  validateEvidence(interpretation.evidence)

  const hasMemoryItemId = Object.prototype.hasOwnProperty.call(interpretation, 'memory_item_id')
  const memoryItemId = interpretation.memory_item_id

  if (['KNOWN', 'NUANCE', 'CONTRADICTION'].includes(interpretation.relation)) {
    if (!hasMemoryItemId || memoryItemId === undefined) {
      throw new Error(`${interpretation.relation} interpretation requires memory_item_id`)
    }
    assertString(memoryItemId, `${label}.memory_item_id`)
  }

  if (interpretation.relation === 'NEW') {
    if (memoryItemId !== undefined && memoryItemId !== null) {
      throw new Error('NEW interpretation must not invent memory_item_id')
    }
  }

  if (interpretation.relation === 'UNKNOWN') {
    if (memoryItemId !== undefined && memoryItemId !== null) {
      throw new Error('UNKNOWN interpretation must not reference memory_item_id')
    }
  }
}

export function validateProbeSemanticAnalysisState(state) {
  assertPlainObject(state, 'probe_semantic_analysis_state')
  assertExactFields(state, ROOT_FIELDS, 'state')
  assertRequiredFields(state, ROOT_FIELDS, 'state')

  if (state.artifact_type !== ARTIFACT_TYPE) {
    throw new Error(`Invalid artifact_type: ${state.artifact_type}`)
  }

  if (state.contract_version !== CONTRACT_VERSION) {
    throw new Error(`Invalid contract_version: ${state.contract_version}`)
  }

  assertString(state.analysis_id, 'analysis_id')
  assertString(state.candidate_id, 'candidate_id')
  assertString(state.probe_cycle_id, 'probe_cycle_id')
  assertString(state.question_id, 'question_id')
  validateResponse(state.response)

  if (!Array.isArray(state.interpretations)) {
    throw new Error('interpretations must be an array.')
  }

  state.interpretations.forEach(validateInterpretation)

  return true
}

export {
  ALLOWED_RELATIONS,
  ARTIFACT_TYPE,
  CONTRACT_VERSION,
  FORBIDDEN_FIELDS
}
