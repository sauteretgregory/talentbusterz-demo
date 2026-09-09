import {
  evaluateDeterministicMatch
} from '../../src/tbz-v3/matching/deterministicMatch.js'

function getJobProvider(job) {
  return (
    job?.sources?.find(
      (source) => source?.provider
    )?.provider ||
    job?.source_metadata?.provider ||
    'unknown'
  )
}

function getJobId(job) {
  return (
    job?.job_data_state?.job_identity?.job_id ||
    job?.job_identity?.job_id ||
    job?.artifact_id?.replace(/^job_/, '') ||
    'unknown'
  )
}

function getCandidateSlug(candidate) {
  return candidate.artifact_id
    .replace(/^candidate_/, '')
    .replace(/_v1$/, '')
}

function buildMatchIdentity(candidate, job) {
  const candidateSlug =
    getCandidateSlug(candidate)

  const provider =
    getJobProvider(job)

  const jobId =
    getJobId(job)

  const artifactId =
    `match_${candidateSlug}_${provider}_${jobId}`

  return {
    artifactId,
    artifactFilename:
      `${artifactId}_v1.0.json`,
    matchId:
      `${artifactId}_v1`
  }
}

function buildInputValidation(candidate, job) {
  const candidateValidation =
    candidate?.validation_report?.validation_status ===
    'passed'

  const jobValidation =
    job?.validation_report?.validation_status ===
    'passed'

  return {
    status:
      candidateValidation && jobValidation
        ? 'passed'
        : 'failed',
    checks: {
      job_artifact_type:
        job?.artifact_type ===
        'canonical_job_data_state',

      job_engine:
        job?.engine_name ===
        'TBZ_JOB_DATA_ENGINE',

      job_state_version:
        typeof job?.state_version === 'string',

      job_validation:
        jobValidation,

      job_complete:
        Boolean(job?.job_data_state),

      candidate_artifact_type:
        candidate?.artifact_type ===
        'canonical_candidate_data_state',

      candidate_engine:
        candidate?.engine_name ===
        'TBZ_CANDIDATE_DATA_ENGINE',

      candidate_state_version:
        typeof candidate?.state_version === 'string',

      candidate_validation:
        candidateValidation,

      candidate_complete:
        Boolean(candidate?.candidate_data_state)
    }
  }
}

function calculateProfessionalMatchScore(evaluation) {
  const scoredRequirements =
    evaluation.requirements.filter(
      (requirement) =>
        requirement.weight > 0 &&
        requirement.status !== 'not_scored'
    )

  const maximumScore =
    scoredRequirements.reduce(
      (total, requirement) =>
        total + requirement.weight,
      0
    )

  const rawScore =
    scoredRequirements.reduce(
      (total, requirement) =>
        total +
        requirement.weight *
        requirement.factor,
      0
    )

  const professionalMatchScore =
    maximumScore > 0
      ? Math.round(
          (rawScore / maximumScore) * 100
        )
      : null

  return {
    professional_match_score:
      professionalMatchScore,
    maximum_score: 100,
    raw_score: Number(rawScore.toFixed(3)),
    maximum_weight: maximumScore,
    normalization_method:
      'weighted_requirement_factors_normalized_to_professional_score'
  }
}

export function createDeterministicMatchEngineProvider() {
  return async function deterministicMatchEngine(input) {
    if (!input || typeof input !== 'object') {
      throw new Error(
        'TBZ deterministic MATCH ENGINE: invalid input.'
      )
    }

    const candidate =
      input.candidate_data_state ||
      input.candidate ||
      null

    const job =
      input.job_data_state ||
      input.job ||
      null

    if (
      candidate?.artifact_type !==
        'canonical_candidate_data_state' ||
      job?.artifact_type !==
        'canonical_job_data_state'
    ) {
      throw new Error(
        'TBZ deterministic MATCH ENGINE: canonical candidate and job states are required.'
      )
    }

    const candidateState =
      candidate.candidate_data_state ||
      candidate

    const jobState =
      job.job_data_state ||
      job

    const evaluation =
      evaluateDeterministicMatch({
        candidateState,
        jobState
      })

    const professionalScoring =
      calculateProfessionalMatchScore(evaluation)

    const identity =
      buildMatchIdentity(candidate, job)

    const inputValidation =
      buildInputValidation(candidate, job)

    if (
      inputValidation.status !== 'passed'
    ) {
      throw new Error(
        'TBZ deterministic MATCH ENGINE: canonical input validation failed.'
      )
    }

    return {
      artifact_type:
        'canonical_match_state',

      artifact_id:
        identity.artifactId,

      artifact_filename:
        identity.artifactFilename,

      state_version:
        'v1.0',

      engine_name:
        'TBZ_MATCH_ENGINE',

      engine_version:
        'V1',

      processing_mode:
        'PRODUCTION',

      generated_at:
        new Date().toISOString(),

      match_id:
        identity.matchId,

      source_alignment: {
        source_job_artifact_id:
          job.artifact_id,

        source_job_data_state_version:
          job.state_version,

        source_candidate_artifact_id:
          candidate.artifact_id,

        source_candidate_data_state_version:
          candidate.state_version,

        source_states_modified:
          false
      },

      input_validation:
        inputValidation,

      match_state: {
        evaluation_mode:
          'deterministic_v1',

        requirements:
          evaluation.requirements,

        summary:
          evaluation.summary,

        professional_compatibility: {
          professional_match_score:
            professionalScoring.professional_match_score,
          score_scale: 100
        },

        professional_scoring:
          professionalScoring
      },

      validation_report: {
        validation_status:
          'passed'
      }
    }
  }
}
