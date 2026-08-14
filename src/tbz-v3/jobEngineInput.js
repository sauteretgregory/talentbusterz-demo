import { EXTRACTION_STATUS } from './extractorGateway.js'

import {
  JOB_ENGINE_INPUT_ARTIFACT_TYPE,
  JOB_ENGINE_INPUT_CONTRACT_VERSION
} from './contracts/jobEngineInputContract.js'

function mapExtractionStatus(status) {
  switch (status) {
    case EXTRACTION_STATUS.COMPLETED:
      return 'success'
    case EXTRACTION_STATUS.REQUIRES_FALLBACK:
      return 'partial'
    case EXTRACTION_STATUS.FAILED:
      return 'failed'
    case EXTRACTION_STATUS.PENDING:
    default:
      return 'not_attempted'
  }
}

function assertExtractionResult(result) {
  if (!result || typeof result !== 'object') {
    throw new Error('TBZ V3: extraction result is required.')
  }

  if (!result.source_url) {
    throw new Error('TBZ V3: extraction source_url is missing.')
  }

  if (!result.detected_source) {
    throw new Error('TBZ V3: detected source is missing.')
  }

  if (!result.extraction_status) {
    throw new Error('TBZ V3: extraction status is missing.')
  }
}

function hasUsableEvidence(result) {
  return Boolean(
    result.raw_job_content ||
    result.structured_source_data
  )
}

export function createJobEngineInputPayload({
  extractionResult,
  requestId,
  operation = 'create',
  retrievedAt = new Date().toISOString(),
  gatewayName = 'TBZ_EXTRACTOR_GATEWAY',
  gatewayVersion = 'v1'
}) {
  assertExtractionResult(extractionResult)

  if (!requestId || typeof requestId !== 'string') {
    throw new Error('TBZ V3: request_id is required.')
  }

  const extractionStatus =
    mapExtractionStatus(extractionResult.extraction_status)

  const payload = {
    artifact_type: JOB_ENGINE_INPUT_ARTIFACT_TYPE,
    input_contract_version:
      JOB_ENGINE_INPUT_CONTRACT_VERSION,
    request_id: requestId,
    operation,
    source: {
      source_id: `source_${requestId}`,
      source_type: 'url',
      provider: extractionResult.detected_source,
      provenance: {
        url: extractionResult.source_url,
        retrieval_method: 'extractor_gateway',
        retrieved_at: retrievedAt
      }
    },
    extraction: {
      status: extractionStatus,
      gateway: {
        gateway_name: gatewayName,
        gateway_version: gatewayVersion
      }
    }
  }

  if (extractionResult.provider_id) {
    payload.extraction.provider = extractionResult.provider_id
  }

  if (extractionResult.error) {
    payload.extraction.error_message = extractionResult.error
  }

  if (extractionResult.provider_payload) {
    payload.provider_payload =
      extractionResult.provider_payload
  }

  if (extractionResult.raw_job_content) {
    payload.raw_job_content =
      extractionResult.raw_job_content
  }

  if (extractionResult.structured_source_data) {
    payload.structured_extraction =
      extractionResult.structured_source_data
  }

  payload.trace = {
    usable_evidence_present: hasUsableEvidence(extractionResult)
  }

  return payload
}

export function canJobEngineProcess(payload) {
  if (!payload || typeof payload !== 'object') {
    return false
  }

  const extractionStatus = payload?.extraction?.status

  const hasEvidence = Boolean(
    payload.raw_job_content ||
    payload.structured_extraction
  )

  if (
    extractionStatus === 'failed' ||
    extractionStatus === 'inaccessible'
  ) {
    return hasEvidence
  }

  if (extractionStatus === 'partial') {
    return hasEvidence
  }

  if (extractionStatus === 'not_attempted') {
    return hasEvidence
  }

  return extractionStatus === 'success' && hasEvidence
}
