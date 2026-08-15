import candidateFixture from '../../src/tbz-v3/fixtures/doctrine/candidate.json' with {
  type: 'json'
}

function assertCanonicalCandidateDataState(artifact) {
  if (!artifact || typeof artifact !== 'object') throw new Error('TBZ fixture CANDIDATE DATA ENGINE: canonical candidate state is required.')
  if (artifact.artifact_type !== 'canonical_candidate_data_state') throw new Error('TBZ fixture CANDIDATE DATA ENGINE: invalid artifact_type.')
  if (artifact.engine_name !== 'TBZ_CANDIDATE_DATA_ENGINE') throw new Error('TBZ fixture CANDIDATE DATA ENGINE: invalid engine_name.')
  if (!artifact.artifact_filename) throw new Error('TBZ fixture CANDIDATE DATA ENGINE: artifact_filename is required.')
  if (!artifact.candidate_data_state?.candidate_id) throw new Error('TBZ fixture CANDIDATE DATA ENGINE: candidate_data_state.candidate_id is required.')
  return artifact
}

function normalize(value) {
  return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

function getAnswers(input) {
  return Array.isArray(input?.probe_responses)
    ? input.probe_responses.filter((item) => item && typeof item.question_id === 'string' && typeof item.answer === 'string' && item.answer.trim())
    : []
}

function upsertActivity(experience, value) {
  experience.activities = Array.isArray(experience.activities) ? experience.activities : []
  if (!experience.activities.some((activity) => normalize(typeof activity === 'string' ? activity : activity.value).includes(normalize(value)))) {
    experience.activities.push({ value, evidence_status: 'confirmed', evidence_origin_type: 'direct_user_statement', data_stability_level: 'volatile' })
  }
}

function updateEsnExperience(candidateState, answer) {
  const normalized = normalize(answer)
  const positive = /\b(oui|yes)\b/.test(normalized) && !/\bnon\b/.test(normalized)
  const experience = candidateState.experience_state?.find((item) => item.experience_id === 'exp_anywr_2022_2025')
  if (!experience) return
  if (positive) upsertActivity(experience, `Réponse PROBE confirmée : recrutement IT en contexte ESN / société de services. ${answer}`)
  experience.probe_response_state = { context_confirmed: positive, response: answer, evidence_status: 'confirmed', evidence_origin_type: 'direct_user_statement' }
}

function updateEducation(candidateState, answer) {
  const normalized = normalize(answer)
  let level = null
  if (/bac\s*\+\s*8|doctorat|phd/.test(normalized)) level = 'bac_plus_8'
  else if (/bac\s*\+\s*5|master|ingenieur|grade de master/.test(normalized)) level = 'bac_plus_5'
  else if (/bac\s*\+\s*4/.test(normalized)) level = 'bac_plus_4'
  else if (/bac\s*\+\s*3|licence/.test(normalized)) level = 'bac_plus_3'
  else if (/bac\s*\+\s*2|bts|dutf|dut/.test(normalized)) level = 'bac_plus_2'
  else if (/bac\b/.test(normalized)) level = 'bac'
  if (!level) return
  candidateState.highest_completed_education_level = { value: level, evidence_status: 'confirmed', evidence_origin_type: 'direct_user_statement', data_stability_level: 'stable', probe_response: answer }
}

function updateStudentStatus(candidateState, answer) {
  const normalized = normalize(answer)
  const active = !(/\bnon\b/.test(normalized) || /pas actuellement/.test(normalized))
  candidateState.current_student_status = { value: active ? 'active_training_status_declared' : 'not_currently_student_or_in_active_training', active, evidence_status: 'confirmed', evidence_origin_type: 'direct_user_statement', data_stability_level: 'volatile', probe_response: answer }
}

function updateEnglish(candidateState, answer) {
  const normalized = normalize(answer)
  const levels = ['C2', 'C1', 'B2', 'B1', 'A2', 'A1']
  const declaredLevel = levels.find((candidate) => normalized.includes(candidate.toLowerCase()))
  candidateState.language_state = Array.isArray(candidateState.language_state) ? candidateState.language_state : []
  const existing = candidateState.language_state.find((entry) => ['anglais', 'english', 'en'].includes(normalize(entry.language)))
  const entry = existing || { language: 'anglais' }

  entry.evidence_items = Array.isArray(entry.evidence_items) ? entry.evidence_items : []
  entry.evidence_items.push({
    claim_scope: 'english_professional_exposure',
    response: answer,
    evidence_status: 'confirmed',
    evidence_origin_type: 'direct_user_statement',
    interpretation_status: declaredLevel ? 'candidate_declared_cefr_level_present' : 'not_cefr_mapped',
    signals: {
      english_exam_score_20_20: /20\s*\/\s*20/.test(normalized) && /(anglais|english|exam|oral)/.test(normalized),
      australia_lived_or_worked: /(australie|australia)/.test(normalized),
      english_sales_experience: /(vente|sales|satellite)/.test(normalized) && /(anglais|english)/.test(normalized),
      english_international_recruitment: /(recrut|candidate|candidat|stakeholder|client)/.test(normalized) && /(anglais|english)/.test(normalized) && /(vietnam|canada|inde|india|pakistan)/.test(normalized)
    }
  })

  Object.assign(entry, {
    evidence_status: 'confirmed',
    evidence_origin_type: 'direct_user_statement',
    data_stability_level: 'volatile',
    probe_response: answer
  })

  if (declaredLevel) {
    Object.assign(entry, {
      claimed_level: declaredLevel,
      confirmed_level: declaredLevel,
      cefr_level: declaredLevel,
      proficiency_confirmed: true
    })
  } else {
    delete entry.claimed_level
    delete entry.confirmed_level
    delete entry.cefr_level
    delete entry.proficiency_confirmed
  }

  if (!existing) candidateState.language_state.push(entry)
}

function updateWorkload(candidateState, answer) {
  const experience = candidateState.experience_state?.find((item) => item.experience_id === 'exp_anywr_2022_2025')
  if (!experience) return
  experience.quantified_claims = Array.isArray(experience.quantified_claims) ? experience.quantified_claims : []
  const normalized = normalize(answer)
  const interviewMatch = normalized.match(/(\d+)\s*(?:entretiens?|interviews?)/)
  const recruitmentMatch = normalized.match(/(\d+)\s*(?:recrutements?|placements?)/)
  if (interviewMatch) experience.quantified_claims.push({ metric: 'entretiens_hebdomadaires', value: Number(interviewMatch[1]), evidence_status: 'confirmed', evidence_origin_type: 'direct_user_statement', value_type: 'probe_response', exactness: 'candidate_declared_approximate', must_not_be_presented_as_exact_kpi: true })
  if (recruitmentMatch) experience.quantified_claims.push({ metric: 'recrutements_mensuels', value: Number(recruitmentMatch[1]), evidence_status: 'confirmed', evidence_origin_type: 'direct_user_statement', value_type: 'probe_response', exactness: 'candidate_declared_approximate', must_not_be_presented_as_exact_kpi: true })
  experience.probe_workload_response = { response: answer, evidence_status: 'confirmed', evidence_origin_type: 'direct_user_statement' }
}

function nextProbeVersion(previousVersion) {
  const match = String(previousVersion).match(/^v(\d+)\.(\d+)_probe_response_integration$/)
  if (!match) return 'v1.4_probe_response_integration'
  return `v${match[1]}.${Number(match[2]) + 1}_probe_response_integration`
}

export function reingestProbeResponses(candidateArtifact, probeResponses) {
  const canonical = assertCanonicalCandidateDataState(candidateArtifact)
  const answers = getAnswers({ probe_responses: probeResponses })
  if (!answers.length) throw new Error('TBZ CANDIDATE DATA ENGINE: at least one non-empty probe response is required.')

  const next = structuredClone(canonical)
  const candidateState = next.candidate_data_state
  const handlers = { MPC_FT_001: updateEsnExperience, probe_ft_candidate_education_001: updateEducation, probe_ft_candidate_student_status_001: updateStudentStatus, MPC_FT_002: updateEnglish, MPC_FT_003: updateWorkload }
  const applied = []

  for (const answer of answers) {
    const handler = handlers[answer.question_id]
    if (!handler) continue
    handler(candidateState, answer.answer)
    applied.push(answer.question_id)
  }

  if (!applied.length) throw new Error('TBZ CANDIDATE DATA ENGINE: no supported probe question_id was supplied.')

  const previousVersion = candidateState.state_version || canonical.state_version || 'v1.3_probe_response_integration'
  const nextVersion = nextProbeVersion(previousVersion)
  const versionMatch = nextVersion.match(/^(v\d+\.\d+)_probe_response_integration$/)
  const artifactVersion = versionMatch ? versionMatch[1] : 'v1.4'
  const previousApplied = Array.isArray(candidateState.probe_response_state?.applied_question_ids)
    ? candidateState.probe_response_state.applied_question_ids
    : []
  const appliedHistory = [...new Set([...previousApplied, ...applied])]

  candidateState.state_version = nextVersion
  candidateState.profile_status = 'probe_enriched_with_candidate_answers'
  candidateState.probe_response_state = {
    source_probe_artifact_id: null,
    applied_question_ids: appliedHistory,
    last_applied_question_ids: applied,
    response_count: appliedHistory.length,
    updated_at: new Date().toISOString(),
    evidence_origin_type: 'direct_user_statement'
  }

  next.state_version = nextVersion
  next.artifact_filename = `candidate_gregory_sauteret_${artifactVersion}.json`
  next.materialization_status = 'updated_from_probe_responses'
  next.candidate_data_update_result = { engine: 'TBZ_CANDIDATE_DATA_ENGINE', engine_version: 'V1', candidate_id: candidateState.candidate_id, status: 'completed', previous_version: previousVersion, current_version: nextVersion, new_integration_performed: true, canonical_state_materialized: true, consistency_correction_applied: false, new_version_created: true, applied_probe_question_ids: applied, applied_probe_question_history: appliedHistory }

  return assertCanonicalCandidateDataState(next)
}

export function createFixtureCandidateDataEngineProvider() {
  return async function fixtureCandidateDataEngine(input = {}) {
    const candidate = input?.candidate_data_state || input?.candidate || candidateFixture
    if (candidate?.artifact_type !== 'canonical_candidate_data_state') throw new Error('TBZ fixture CANDIDATE DATA ENGINE: canonical candidate state is required.')
    const canonical = assertCanonicalCandidateDataState(candidate)
    const responses = getAnswers(input)
    return responses.length ? reingestProbeResponses(canonical, responses) : structuredClone(canonical)
  }
}