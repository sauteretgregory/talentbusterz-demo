export const EXTRACTION_STATUS = Object.freeze({
  PENDING: 'pending',
  COMPLETED: 'completed',
  FAILED: 'failed',
  REQUIRES_FALLBACK: 'requires_fallback'
})

function assertIntakeRequest(request) {
  if (!request || typeof request !== 'object') {
    throw new Error('TBZ V3: extractor requires a job intake request.')
  }

  if (request.request_type !== 'job_url_intake') {
    throw new Error('TBZ V3: unsupported intake request type.')
  }

  if (!request.source_url) {
    throw new Error('TBZ V3: source_url is missing.')
  }

  if (!request.detected_source) {
    throw new Error('TBZ V3: detected_source is missing.')
  }
}

export function createExtractorRegistry() {
  return new Map()
}

export function registerExtractor(registry, source, extractor) {
  if (!(registry instanceof Map)) {
    throw new Error('TBZ V3: invalid extractor registry.')
  }

  if (!source || typeof source !== 'string') {
    throw new Error('TBZ V3: extractor source is required.')
  }

  if (typeof extractor !== 'function') {
    throw new Error('TBZ V3: extractor must be a function.')
  }

  registry.set(source, extractor)

  return registry
}

export async function extractJobFromIntake(
  request,
  registry
) {
  assertIntakeRequest(request)

  if (!(registry instanceof Map)) {
    throw new Error('TBZ V3: invalid extractor registry.')
  }

  const extractor = registry.get(request.detected_source)

  if (!extractor) {
    return {
      extraction_status: EXTRACTION_STATUS.REQUIRES_FALLBACK,
      source_url: request.source_url,
      detected_source: request.detected_source,
      provider_id: null,
      raw_job_content: null,
      structured_source_data: null,
      error: 'no_extractor_available'
    }
  }

  try {
    const result = await extractor({
      source_url: request.source_url,
      detected_source: request.detected_source
    })

    if (!result || typeof result !== 'object') {
      throw new Error('Extractor returned an invalid result.')
    }

    const hasContent =
      Boolean(result.raw_job_content) ||
      Boolean(result.structured_source_data)

    if (!hasContent) {
      return {
        extraction_status: EXTRACTION_STATUS.REQUIRES_FALLBACK,
        source_url: request.source_url,
        detected_source: request.detected_source,
        provider_id: result.provider_id || null,
        raw_job_content: null,
        structured_source_data: null,
        error: 'no_job_content_extracted'
      }
    }

    return {
      extraction_status: EXTRACTION_STATUS.COMPLETED,
      source_url: request.source_url,
      detected_source: request.detected_source,
      provider_id: result.provider_id || 'unknown_provider',
      raw_job_content: result.raw_job_content || null,
      structured_source_data:
        result.structured_source_data || null,
      error: null
    }
  } catch (error) {
    return {
      extraction_status: EXTRACTION_STATUS.FAILED,
      source_url: request.source_url,
      detected_source: request.detected_source,
      provider_id: null,
      raw_job_content: null,
      structured_source_data: null,
      error: error.message
    }
  }
}
