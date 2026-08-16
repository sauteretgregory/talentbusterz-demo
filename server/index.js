import fs from 'node:fs/promises'
import path from 'node:path'
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

import {
  processProbeResponses
} from './probeResponseLoop.js'

import {
  createProbeFinalState
} from '../src/tbz-v3/contracts/probeFinalStateContract.js'

import {
  createApplicationReadinessState,
  assertApplicationReadinessState
} from '../src/tbz-v3/contracts/applicationReadinessContract.js'

import {
  candidateMemoryStore
} from './candidateMemoryStore.js'

const PORT = 8787

const engineRegistry = createTbzEngineRegistry()

const OUTPUT_DIR =
  path.resolve('server/output')

async function persistCanonicalArtifact(
  artifact
) {
  if (
    !artifact ||
    typeof artifact !== 'object'
  ) {
    throw new Error(
      'TBZ: cannot persist invalid canonical artifact.'
    )
  }

  if (
    !artifact.artifact_filename ||
    typeof artifact.artifact_filename !== 'string'
  ) {
    throw new Error(
      'TBZ: canonical artifact_filename is required.'
    )
  }

  await fs.mkdir(
    OUTPUT_DIR,
    { recursive: true }
  )

  const outputPath =
    path.join(
      OUTPUT_DIR,
      artifact.artifact_filename
    )

  await fs.writeFile(
    outputPath,
    JSON.stringify(
      artifact,
      null,
      2
    ) + '\n',
    'utf8'
  )

  return outputPath
}

function createReadinessFromProbePlan({
  candidateDataState,
  jobDataState,
  matchState,
  probePlan
}) {
  const probeFinalState = createProbeFinalState(probePlan)

  return assertApplicationReadinessState(
    createApplicationReadinessState({
      candidateDataState,
      jobDataState,
      matchState,
      probeFinalState
    })
  )
}

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
    req.url === '/api/probe-responses'
  ) {
    try {
      const body = await readJsonBody(req)

      const result = await processProbeResponses({
        engineRegistry,
        candidateDataState:
          body?.canonical_candidate_data_state,
        jobDataState:
          body?.canonical_job_data_state,
        probePlan:
          body?.canonical_probe_plan,
        previousMatchState:
          body?.previous_match_state,
        responses:
          body?.responses,
        continueEnrichment:
          body?.continue_enrichment,
        cycleNumber:
          body?.cycle_number || 1
      })

      const applicationReadiness =
        createReadinessFromProbePlan({
          candidateDataState:
            result.canonical_candidate_data_state,
          jobDataState:
            body?.canonical_job_data_state,
          matchState:
            result.canonical_match_state,
          probePlan:
            result.canonical_probe_plan
        })

      await Promise.all([
        persistCanonicalArtifact(
          result.canonical_candidate_data_state
        ),
        candidateMemoryStore.save(
          result.canonical_candidate_data_state
        ),
        persistCanonicalArtifact(
          result.canonical_match_state
        ),
        persistCanonicalArtifact(
          result.canonical_probe_plan
        ),
        persistCanonicalArtifact(
          applicationReadiness
        )
      ])

      sendJson(res, 200, {
        status: 'completed',
        stage: 'probe_responses_reingested_and_application_readiness_updated',
        ...result,
        candidate_memory_persisted: true,
        canonical_application_readiness_state:
          applicationReadiness
      })
    } catch (error) {
      sendJson(res, 500, {
        status: 'failed',
        stage: 'probe_response_loop',
        error: error.message
      })
    }

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

      const candidateMemory = await candidateMemoryStore.resolve({
        candidate: body?.candidate || null,
        candidateId: body?.candidate_id || null
      })

      if (!candidateMemory.candidate) {
        sendJson(res, 400, {
          status: 'failed',
          stage: 'candidate_memory_resolution',
          error: 'candidate_memory_not_found',
          candidate_id: body?.candidate_id || null
        })
        return
      }

      const candidateExecution =
        await executeEngine(
          engineRegistry,
          ENGINE_IDS.CANDIDATE,
          { candidate_data_state: candidateMemory.candidate }
        )

      if (
        candidateExecution.status !== 'completed' ||
        !candidateExecution.output_artifact
      ) {
        sendJson(res, 502, {
          status: 'failed',
          stage: 'candidate_data_engine',
          error: candidateExecution.error,
          engine_status:
            candidateExecution.status
        })
        return
      }

      const canonicalCandidate =
        candidateExecution.output_artifact

      await Promise.all([
        persistCanonicalArtifact(canonicalCandidate),
        candidateMemoryStore.save(canonicalCandidate)
      ])

      let extraction

      const deterministicMode =
        process.env.TBZ_ENGINE_MODE === 'deterministic'

      if (
        deterministicMode &&
        sourceUrl.includes('/210SDTY')
      ) {
        extraction = {
          provider_id: 'france_travail_fixture',
          provider_payload: {
            offer_id: '210SDTY',
            source_url: sourceUrl,
            http_status: 200,
            content_type: 'application/json',
            parser_id: 'fixture',
            parser_version: 'v1'
          },
          raw_job_content: 'fixture',
          structured_source_data: {}
        }
      } else {
        extraction =
          await fetchFranceTravailPublicJob(
            sourceUrl
          )
      }

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

      const canonicalJob =
        jobEngineExecution.output_artifact

      await persistCanonicalArtifact(
        canonicalJob
      )

      const matchExecution =
        await executeEngine(
          engineRegistry,
          ENGINE_IDS.MATCH,
          {
            candidate_data_state:
              canonicalCandidate,
            job_data_state:
              canonicalJob
          }
        )

      if (
        matchExecution.status !== 'completed' ||
        !matchExecution.output_artifact
      ) {
        sendJson(res, 502, {
          status: 'failed',
          stage: 'match_engine',
          error: matchExecution.error,
          engine_status:
            matchExecution.status
        })
        return
      }

      const canonicalMatch =
        matchExecution.output_artifact

      await persistCanonicalArtifact(
        canonicalMatch
      )

      const probeExecution =
        await executeEngine(
          engineRegistry,
          ENGINE_IDS.PROBE,
          canonicalMatch
        )

      if (
        probeExecution.status !== 'completed' ||
        !probeExecution.output_artifact
      ) {
        sendJson(res, 502, {
          status: 'failed',
          stage: 'probe_engine',
          error: probeExecution.error,
          engine_status:
            probeExecution.status
        })
        return
      }

      const canonicalProbe =
        probeExecution.output_artifact

      await persistCanonicalArtifact(
        canonicalProbe
      )

      const applicationReadiness =
        createReadinessFromProbePlan({
          candidateDataState:
            canonicalCandidate,
          jobDataState:
            canonicalJob,
          matchState:
            canonicalMatch,
          probePlan:
            canonicalProbe
        })

      await persistCanonicalArtifact(
        applicationReadiness
      )

      sendJson(res, 200, {
        status: 'completed',
        stage:
          'candidate_application_analysis_generated',
        detected_source: 'france_travail',
        provider_id: extraction.provider_id,
        provider_payload:
          extraction.provider_payload,
        candidate_memory_source:
          candidateMemory.source,
        candidate_memory_persisted: true,
        job_engine_processable: true,
        canonical_candidate_data_state:
          canonicalCandidate,
        canonical_job_data_state:
          canonicalJob,
        canonical_match_state:
          canonicalMatch,
        canonical_probe_plan:
          canonicalProbe,
        canonical_application_readiness_state:
          applicationReadiness
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
    `TBZ backend listening on http://localhost:8787`
  )

  console.log(
    'CANDIDATE DATA ENGINE configured:',
    engineRegistry.has(ENGINE_IDS.CANDIDATE)
  )

  console.log(
    'JOB DATA ENGINE configured:',
    engineRegistry.has(ENGINE_IDS.JOB_DATA)
  )
})
