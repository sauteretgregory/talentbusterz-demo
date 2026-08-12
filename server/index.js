import http from 'node:http'

import {
  fetchFranceTravailPublicJob
} from './providers/franceTravailPublic.js'

import {
  createJobEngineInputPayload,
  canJobEngineProcess
} from '../src/tbz-v3/jobEngineInput.js'

import {
  ENGINE_IDS,
  executeEngine
} from './engineGateway.js'

import {
  createTbzEngineRegistry
} from './engineRegistry.js'

const PORT = 8787

const engineRegistry = createTbzEngineRegistry()

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload)

  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  })

  res.end(body)
}

async function readJsonBody(req) {
  let body = ''

  for await (const chunk of req) {
    body += chunk
  }

  if (!body) {
    return {}
  }

  return JSON.parse(body)
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Methods': 'POST, OPTIONS'
    })

    res.end()
    return
  }

  if (
    req.method === 'POST' &&
    req.url === '/api/job-intake'
  ) {
    try {
      const body = await readJsonBody(req)
      const sourceUrl = body?.url

      if (
        !sourceUrl ||
        typeof sourceUrl !== 'string'
      ) {
        sendJson(res, 400, {
          status: 'failed',
          stage: 'job_url_validation',
          error: 'job_url_required'
        })
        return
      }

      const extraction =
        await fetchFranceTravailPublicJob(
          sourceUrl
        )

      const jobEngineInput =
        createJobEngineInputPayload({
          extractionResult: {
            extraction_status: 'completed',
            source_url: sourceUrl,
            detected_source: 'france_travail',
            provider_id: extraction.provider_id,
            provider_payload:
              extraction.provider_payload,
            raw_job_content:
              extraction.raw_job_content,
            structured_source_data:
              extraction.structured_source_data,
            error: null
          },
          requestId:
            `req_${extraction.provider_payload.offer_id}_${Date.now()}`
        })

      const jobEngineProcessable =
        canJobEngineProcess(jobEngineInput)

      if (!jobEngineProcessable) {
        sendJson(res, 422, {
          status: 'failed',
          stage: 'job_engine_input_validation',
          detected_source: 'france_travail',
          provider_payload:
            extraction.provider_payload,
          job_engine_processable: false,
          error:
            'job_engine_input_not_processable'
        })
        return
      }

      const jobEngineExecution =
        await executeEngine(
          engineRegistry,
          ENGINE_IDS.JOB_DATA,
          jobEngineInput
        )

      if (
        jobEngineExecution.status !==
          'completed' ||
        !jobEngineExecution.output_artifact
      ) {
        sendJson(res, 502, {
          status: 'failed',
          stage: 'job_data_engine',
          detected_source: 'france_travail',
          provider_payload:
            extraction.provider_payload,
          job_engine_processable: true,
          engine_status:
            jobEngineExecution.status,
          error:
            jobEngineExecution.error
        })
        return
      }

      sendJson(res, 200, {
        status: 'completed',
        stage:
          'canonical_job_data_state_generated',
        detected_source: 'france_travail',
        provider_id: extraction.provider_id,
        provider_payload:
          extraction.provider_payload,
        job_engine_processable: true,
        canonical_job_data_state:
          jobEngineExecution.output_artifact
      })
    } catch (error) {
      sendJson(res, 500, {
        status: 'failed',
        stage: 'unexpected_backend_error',
        error: error.message
      })
    }

    return
  }

  sendJson(res, 404, {
    status: 'failed',
    error: 'not_found'
  })
})

server.listen(PORT, () => {
  console.log(
    `TBZ backend listening on http://localhost:${PORT}`
  )

  console.log(
    'JOB DATA ENGINE configured:',
    engineRegistry.has(ENGINE_IDS.JOB_DATA)
  )
})
