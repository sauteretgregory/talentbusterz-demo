const IMPORTANCE_WEIGHTS = Object.freeze({
  critical: 4,
  high: 3,
  medium: 2,
  low: 1
})

const EVIDENCE_FACTORS = Object.freeze({
  confirmed: 1,
  partial: 0.75,
  contradictory: 0.35,
  missing: 0
})

export function getImportanceWeight(importance) {
  return IMPORTANCE_WEIGHTS[importance] ?? 1
}

export function getEvidenceFactor(status) {
  return EVIDENCE_FACTORS[status] ?? 0
}

export function normalizeText(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[’']/g, ' ')
    .replace(/[^a-z0-9+#.%]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function flattenCandidateEvidence(candidateState) {
  if (!candidateState) {
    throw new Error(
      'TBZ deterministic match: candidate state is required.'
    )
  }

  const evidence = []

  const push = ({
    value,
    source,
    evidenceStatus = 'partial',
    evidenceOriginType = null
  }) => {
    if (
      value === null ||
      value === undefined ||
      value === ''
    ) {
      return
    }

    evidence.push({
      text: normalizeText(value),
      raw: value,
      source,
      evidence_status: evidenceStatus,
      evidence_origin_type: evidenceOriginType
    })
  }

  for (const experience of candidateState.experience_state || []) {
    push({
      value: experience.role_title,
      source: experience.experience_id,
      evidenceStatus: experience.evidence_status,
      evidenceOriginType: experience.evidence_origin_type
    })

    for (const title of experience.role_titles || []) {
      push({
        value: title.value,
        source: experience.experience_id,
        evidenceStatus:
          title.evidence_status ||
          experience.evidence_status,
        evidenceOriginType:
          title.evidence_origin_type ||
          experience.evidence_origin_type
      })
    }

    for (const activity of experience.activities || []) {
      push({
        value:
          typeof activity === 'string'
            ? activity
            : activity.value,
        source: experience.experience_id,
        evidenceStatus:
          typeof activity === 'string'
            ? experience.evidence_status
            : activity.evidence_status,
        evidenceOriginType:
          typeof activity === 'string'
            ? experience.evidence_origin_type
            : activity.evidence_origin_type
      })
    }

    for (
      const domain of
      experience.technical_recruitment_domains?.values || []
    ) {
      push({
        value: domain,
        source: experience.experience_id,
        evidenceStatus:
          experience.technical_recruitment_domains
            ?.evidence_status,
        evidenceOriginType:
          experience.technical_recruitment_domains
            ?.evidence_origin_type
      })
    }
  }

  const skills = candidateState.skills_state || {}

  for (const value of skills.recruitment_practices || []) {
    push({
      value,
      source: 'skills.recruitment_practices',
      evidenceStatus: skills.global_evidence_status,
      evidenceOriginType:
        skills.primary_evidence_origin_type
    })
  }

  for (const value of skills.commercial_and_client_claims || []) {
    push({
      value,
      source: 'skills.commercial_and_client_claims',
      evidenceStatus: skills.global_evidence_status,
      evidenceOriginType:
        skills.primary_evidence_origin_type
    })
  }

  for (const education of candidateState.education_state || []) {
    push({
      value: education.program,
      source: education.education_id,
      evidenceStatus: education.evidence_status,
      evidenceOriginType: education.evidence_origin_type
    })
  }

  for (const language of candidateState.language_state || []) {
    push({
      value: language.language,
      source: `language:${language.language}`,
      evidenceStatus: language.evidence_status,
      evidenceOriginType: language.evidence_origin_type
    })

    push({
      value: language.claimed_level,
      source: `language:${language.language}`,
      evidenceStatus: language.evidence_status,
      evidenceOriginType: language.evidence_origin_type
    })

    for (const variant of language.variants || []) {
      push({
        value: `${language.language} ${variant.claimed_level}`,
        source: `language:${language.language}`,
        evidenceStatus: language.evidence_status,
        evidenceOriginType: variant.evidence_origin_type
      })
    }
  }

  return evidence.filter((item) => item.text)
}

export function prepareRequirements(jobState) {
  if (!jobState) {
    throw new Error(
      'TBZ deterministic match: job state is required.'
    )
  }

  return (jobState.requirements_explicit || [])
    .filter(
      (requirement) =>
        requirement.evidence_status === 'confirmed'
    )
    .map((requirement) => ({
      ...requirement,
      normalized_requirement:
        normalizeText(requirement.requirement),
      base_weight:
        getImportanceWeight(requirement.importance)
    }))
}

export function createDeterministicMatchContext({
  candidateState,
  jobState
}) {
  return {
    requirements: prepareRequirements(jobState),
    candidateEvidence:
      flattenCandidateEvidence(candidateState)
  }
}

const MATCH_FACTORS = Object.freeze({
  match: 1,
  partial_match: 0.65,
  unknown: 0.5,
  mismatch: 0
})

export function getMatchFactor(status) {
  return MATCH_FACTORS[status] ?? 0
}

function tokenize(value) {
  return normalizeText(value)
    .split(' ')
    .filter((token) => token.length >= 3)
}

function lexicalSimilarity(requirementText, evidenceText) {
  const requirementTokens = tokenize(requirementText)

  if (!requirementTokens.length) {
    return 0
  }

  const evidenceTokens = new Set(tokenize(evidenceText))

  const matches = requirementTokens.filter(
    (token) => evidenceTokens.has(token)
  ).length

  return matches / requirementTokens.length
}

export function evaluateRequirement(
  requirement,
  candidateEvidence
) {
  const rankedEvidence = candidateEvidence
    .map((evidence) => ({
      ...evidence,
      similarity: lexicalSimilarity(
        requirement.normalized_requirement,
        evidence.text
      )
    }))
    .filter((evidence) => evidence.similarity > 0)
    .sort((a, b) => b.similarity - a.similarity)

  const bestEvidence = rankedEvidence[0] || null

  if (!bestEvidence) {
    return {
      requirement_id: requirement.requirement_id,
      requirement: requirement.requirement,
      importance: requirement.importance,
      weight: requirement.base_weight,
      status: 'unknown',
      factor: getMatchFactor('unknown'),
      confidence: 0,
      evidence: null
    }
  }

  const evidenceFactor =
    getEvidenceFactor(bestEvidence.evidence_status)

  const combined =
    bestEvidence.similarity * evidenceFactor

  let status = 'unknown'

  if (combined >= 0.6) {
    status = 'match'
  } else if (combined >= 0.25) {
    status = 'partial_match'
  }

  return {
    requirement_id: requirement.requirement_id,
    requirement: requirement.requirement,
    importance: requirement.importance,
    weight: requirement.base_weight,
    status,
    factor: getMatchFactor(status),
    confidence: Number(combined.toFixed(3)),
    evidence: {
      source: bestEvidence.source,
      text: bestEvidence.raw,
      evidence_status:
        bestEvidence.evidence_status,
      evidence_origin_type:
        bestEvidence.evidence_origin_type,
      lexical_similarity:
        Number(bestEvidence.similarity.toFixed(3))
    }
  }
}

export const MATCH_ROUTE_POLICIES = Object.freeze({
  'structured_verifiable:current_education_status':
    'explicit_unknown',
  'evidence_supported:domain_experience':
    'evaluator',
  'self_declared:professional_interest':
    'self_declared',
  'evidence_supported:professional_practice':
    'evaluator',
  'evidence_supported:language_communication':
    'evaluator',
  'structured_verifiable:language_level':
    'evaluator',
  'evidence_supported:workload_capacity':
    'evaluator',
  'non_scoring:behavioral_traits':
    'non_scoring',
  'evidence_supported:digital_environment':
    'evaluator',
  'structured_verifiable:experience_duration':
    'evaluator',
  'structured_verifiable:education_level':
    'explicit_unknown',
  'structured_verifiable:education_field':
    'explicit_unknown',
  'structured_verifiable:professional_qualification':
    'explicit_unknown',
  'evidence_supported:technology_skill':
    'explicit_unknown',
  'evidence_supported:methodology_skill':
    'explicit_unknown',
  'structured_verifiable:regulatory_eligibility':
    'explicit_unknown',
  'unclassified:unclassified':
    'explicit_unknown'
})

export function getRequirementHandlingPolicy(
  requirement
) {
  const routeKey =
    getRequirementRouteKey(requirement)

  const policy =
    MATCH_ROUTE_POLICIES[routeKey]

  if (!policy) {
    throw new Error(
      `TBZ deterministic match: no handling policy for canonical route "${routeKey}".`
    )
  }

  return policy
}

export function evaluateDeterministicMatch({
  candidateState,
  jobState
}) {
  const context = createDeterministicMatchContext({
    candidateState,
    jobState
  })

  const requirements = context.requirements.map(
    (requirement) => {
      const routeKey =
        getRequirementRouteKey(requirement)

      if (
        routeKey ===
        'structured_verifiable:experience_duration'
      ) {
        return evaluateExperienceDurationRequirement(
          requirement,
          candidateState
        )
      }

      if (
        routeKey ===
        'evidence_supported:domain_experience'
      ) {
        return evaluateDomainExperienceRequirement(
          requirement,
          candidateState
        )
      }

      if (
        routeKey ===
        'evidence_supported:professional_practice'
      ) {
        return evaluateProfessionalPracticeRequirement(
          requirement,
          candidateState
        )
      }

      if (
        routeKey ===
        'evidence_supported:language_communication'
      ) {
        return evaluateLanguageCommunicationRequirement(
          requirement,
          candidateState
        )
      }

      if (
        routeKey ===
        'evidence_supported:workload_capacity'
      ) {
        return evaluateWorkloadCapacityRequirement(
          requirement,
          candidateState
        )
      }

      if (
        routeKey ===
        'evidence_supported:digital_environment'
      ) {
        return evaluateDigitalEnvironmentRequirement(
          requirement,
          candidateState
        )
      }

      if (
        requirement.evaluation_mode ===
        'non_scoring'
      ) {
        return buildNonScoringResult(requirement)
      }

      if (
        requirement.evaluation_mode ===
        'self_declared'
      ) {
        return buildSelfDeclaredResult(requirement)
      }

      if (
        routeKey ===
        'structured_verifiable:language_level'
      ) {
        return evaluateLanguageLevelRequirement(
          requirement,
          candidateState
        )
      }

      if (
        requirement.evaluation_mode ===
        'structured_verifiable'
      ) {
        return buildUnknownStructuredResult(
          requirement,
          'Candidate state does not yet expose the canonical structured value required for this evaluator.'
        )
      }

      const handlingPolicy =
        getRequirementHandlingPolicy(requirement)

      if (handlingPolicy === 'explicit_unknown') {
        return buildResult(
          requirement,
          'unknown',
          0,
          null,
          'Canonical MATCH route is recognized but does not yet have a resolvable evaluator for the current candidate schema.'
        )
      }

      throw new Error(
        `TBZ deterministic match: canonical route "${routeKey}" reached no executable handler.`
      )
    }
  )

  return {
    requirements,
    summary: requirements.reduce(
      (acc, requirement) => {
        acc[requirement.status] += 1
        return acc
      },
      {
        match: 0,
        partial_match: 0,
        unknown: 0,
        mismatch: 0,
        not_scored: 0
      }
    )
  }
}

function extractDateValue(value) {
  if (!value) {
    return null
  }

  if (typeof value === 'string') {
    return value
  }

  if (typeof value === 'object') {
    if (typeof value.value === 'string') {
      return value.value
    }
  }

  return null
}

function parseYearMonth(value) {
  const raw = extractDateValue(value)

  if (!raw) {
    return null
  }

  const match = raw.match(/^(\d{4})-(\d{2})$/)

  if (!match) {
    return null
  }

  return {
    year: Number(match[1]),
    month: Number(match[2])
  }
}

function monthsBetween(start, end) {
  if (!start || !end) {
    return 0
  }

  return (
    (end.year - start.year) * 12 +
    (end.month - start.month)
  )
}

export function calculateCandidateExperienceMonths(
  candidateState,
  predicate = () => true
) {
  let months = 0

  for (const experience of candidateState.experience_state || []) {
    if (!predicate(experience)) {
      continue
    }

    const start = parseYearMonth(experience.start_date)
    const end = parseYearMonth(experience.end_date)

    if (!start || !end) {
      continue
    }

    const duration = monthsBetween(start, end)

    if (duration > 0) {
      months += duration
    }
  }

  return months
}

function experienceText(experience) {
  const parts = []

  if (experience.role_title) {
    parts.push(experience.role_title)
  }

  for (const title of experience.role_titles || []) {
    parts.push(title.value)
  }

  for (const activity of experience.activities || []) {
    parts.push(
      typeof activity === 'string'
        ? activity
        : activity.value
    )
  }

  return normalizeText(parts.join(' '))
}

function candidateHasRecruitmentExperience(experience) {
  const text = experienceText(experience)

  return (
    text.includes('recrutement') ||
    text.includes('sourcing') ||
    text.includes('candidat')
  )
}

function candidateHasITRecruitmentEvidence(candidateState) {
  return (candidateState.experience_state || []).some(
    (experience) => {
      const text = experienceText(experience)

      return (
        text.includes('recrutement it') ||
        (
          candidateHasRecruitmentExperience(experience) &&
          (
            experience.technical_recruitment_domains?.values
              ?.length > 0
          )
        )
      )
    }
  )
}

function candidateHasExplicitESNEvidence(candidateState) {
  return (candidateState.experience_state || []).some(
    (experience) => {
      const text = experienceText(experience)

      return (
        text.includes('esn') ||
        text.includes('societe de services') ||
        text.includes('societes de services')
      )
    }
  )
}

function buildResult(
  requirement,
  status,
  confidence,
  evidence = null,
  rationale = null
) {
  return {
    requirement_id: requirement.requirement_id,
    requirement: requirement.requirement,
    requirement_type: requirement.requirement_type,
    evaluation_mode: requirement.evaluation_mode,
    importance: requirement.importance,
    weight: requirement.base_weight,
    status,
    factor: getMatchFactor(status),
    confidence,
    evidence,
    rationale
  }
}

function buildSelfDeclaredResult(
  requirement
) {
  return buildResult(
    requirement,
    'unknown',
    0,
    null,
    'Requirement requires an explicit candidate declaration and cannot be inferred from other evidence.'
  )
}

function buildNonScoringResult(
  requirement
) {
  return {
    requirement_id: requirement.requirement_id,
    requirement: requirement.requirement,
    requirement_type: requirement.requirement_type,
    evaluation_mode: requirement.evaluation_mode,
    importance: requirement.importance,
    weight: 0,
    status: 'not_scored',
    factor: 0,
    confidence: 0,
    evidence: null,
    rationale:
      'Requirement is explicitly classified as non_scoring.'
  }
}

function buildUnknownStructuredResult(
  requirement,
  reason
) {
  return buildResult(
    requirement,
    'unknown',
    0,
    null,
    reason
  )
}


const LANGUAGE_LEVEL_ORDER = {
  A1: 1,
  A2: 2,
  B1: 3,
  B2: 4,
  C1: 5,
  C2: 6
}

function normalizeLanguageCode(value) {
  const text = normalizeText(value)

  const aliases = {
    en: 'en',
    english: 'en',
    anglais: 'en',
    fr: 'fr',
    french: 'fr',
    francais: 'fr',
    français: 'fr',
    es: 'es',
    spanish: 'es',
    espagnol: 'es'
  }

  return aliases[text] || text
}

function candidateLanguageEntry(
  candidateState,
  languageCode
) {
  return (candidateState.language_state || []).find(
    (entry) =>
      normalizeLanguageCode(entry.language) ===
      normalizeLanguageCode(languageCode)
  )
}

function extractConfirmedCefrLevel(languageEntry) {
  if (!languageEntry) {
    return null
  }

  if (languageEntry.proficiency_confirmed !== true) {
    return null
  }

  const candidates = [
    languageEntry.cefr_level,
    languageEntry.confirmed_level,
    languageEntry.claimed_level
  ]

  for (const candidate of candidates) {
    if (typeof candidate !== 'string') {
      continue
    }

    const level = candidate.trim().toUpperCase()

    if (LANGUAGE_LEVEL_ORDER[level]) {
      return level
    }
  }

  return null
}

function evaluateLanguageLevelRequirement(
  requirement,
  candidateState
) {
  const language =
    requirement.structured_parameters?.language

  const minimumLevel =
    requirement.structured_parameters?.minimum_level

  if (
    typeof language !== 'string' ||
    !language.trim() ||
    typeof minimumLevel !== 'string' ||
    !LANGUAGE_LEVEL_ORDER[minimumLevel.toUpperCase()]
  ) {
    throw new Error(
      'TBZ deterministic match: language_level requires language and valid minimum_level.'
    )
  }

  const normalizedMinimum =
    minimumLevel.toUpperCase()

  const languageEntry =
    candidateLanguageEntry(candidateState, language)

  if (!languageEntry) {
    return buildResult(
      requirement,
      'unknown',
      0,
      {
        language,
        minimum_level: normalizedMinimum,
        candidate_language_entry: null
      },
      'Required language is not present in canonical candidate data.'
    )
  }

  const confirmedLevel =
    extractConfirmedCefrLevel(languageEntry)

  if (!confirmedLevel) {
    return buildResult(
      requirement,
      'unknown',
      0,
      {
        language,
        minimum_level: normalizedMinimum,
        proficiency_confirmed:
          languageEntry.proficiency_confirmed === true,
        evidence_status:
          languageEntry.evidence_status ?? null,
        resolution_status:
          languageEntry.resolution_status ?? null
      },
      'Candidate language level is not canonically confirmed at a comparable CEFR level.'
    )
  }

  if (
    LANGUAGE_LEVEL_ORDER[confirmedLevel] >=
    LANGUAGE_LEVEL_ORDER[normalizedMinimum]
  ) {
    return buildResult(
      requirement,
      'match',
      0.95,
      {
        language,
        candidate_level: confirmedLevel,
        minimum_level: normalizedMinimum
      },
      'Confirmed candidate language level meets or exceeds the requirement.'
    )
  }

  return buildResult(
    requirement,
    'mismatch',
    0.95,
    {
      language,
      candidate_level: confirmedLevel,
      minimum_level: normalizedMinimum
    },
    'Confirmed candidate language level is below the required minimum.'
  )
}

function evaluateExperienceDurationRequirement(
  requirement,
  candidateState
) {
  const minimumMonths =
    requirement.structured_parameters?.minimum_months

  if (!Number.isInteger(minimumMonths) || minimumMonths <= 0) {
    throw new Error(
      'TBZ deterministic match: experience_duration requires minimum_months.'
    )
  }

  const experienceScope =
    requirement.structured_parameters?.experience_scope

  if (experienceScope) {
    return buildUnknownStructuredResult(
      requirement,
      `Candidate evaluator does not yet support experience_scope "${experienceScope}".`
    )
  }

  const months =
    calculateCandidateExperienceMonths(candidateState)

  if (months >= minimumMonths) {
    return buildResult(
      requirement,
      'match',
      0.95,
      {
        experience_months: months,
        minimum_months: minimumMonths
      },
      `Candidate has at least ${minimumMonths} months of total documented experience.`
    )
  }

  if (months > 0) {
    return buildResult(
      requirement,
      'partial_match',
      0.8,
      {
        experience_months: months,
        minimum_months: minimumMonths
      },
      `Documented experience exists but is below ${minimumMonths} months.`
    )
  }

  return buildResult(
    requirement,
    'unknown',
    0,
    null,
    'Total documented experience duration could not be established.'
  )
}

function evaluateDomainExperienceComponent(
  component,
  candidateState
) {
  const key =
    `${component.component_type}:${component.value}`

  switch (key) {
    case 'professional_domain:recruitment_it':
      return {
        component_type: component.component_type,
        value: component.value,
        evidenced:
          candidateHasITRecruitmentEvidence(candidateState)
      }

    case 'employment_context:esn':
      return {
        component_type: component.component_type,
        value: component.value,
        evidenced:
          candidateHasExplicitESNEvidence(candidateState)
      }

    default:
      return {
        component_type: component.component_type,
        value: component.value,
        evidenced: null,
        unsupported: true
      }
  }
}

const PROFESSIONAL_PRACTICE_CONCEPT_PATTERNS =
  Object.freeze({
    sourcing: [
      'sourcing'
    ],
    prospecting: [
      'prospection'
    ],
    cold_calling: [
      'prospection telephonique',
      'appel a froid',
      'demarchage telephonique',
      'phoning',
      'appels sortants'
    ]
  })

function findProfessionalPracticeEvidence(
  concept,
  candidateState
) {
  const patterns =
    PROFESSIONAL_PRACTICE_CONCEPT_PATTERNS[concept]

  if (!patterns) {
    return {
      concept,
      evidenced: null,
      unsupported: true,
      evidence: null
    }
  }

  for (const experience of candidateState.experience_state || []) {
    for (const activity of experience.activities || []) {
      const raw =
        typeof activity === 'string'
          ? activity
          : activity.value

      const text = normalizeText(raw)

      if (
        patterns.some((pattern) =>
          text.includes(normalizeText(pattern))
        )
      ) {
        return {
          concept,
          evidenced: true,
          evidence: {
            source: experience.experience_id,
            text: raw,
            evidence_status:
              typeof activity === 'string'
                ? experience.evidence_status
                : activity.evidence_status,
            evidence_origin_type:
              typeof activity === 'string'
                ? experience.evidence_origin_type
                : activity.evidence_origin_type
          }
        }
      }
    }
  }

  const skills =
    candidateState.skills_state?.recruitment_practices || []

  for (const skill of skills) {
    const text = normalizeText(skill)

    if (
      patterns.some((pattern) =>
        text.includes(normalizeText(pattern))
      )
    ) {
      return {
        concept,
        evidenced: true,
        evidence: {
          source: 'skills.recruitment_practices',
          text: skill,
          evidence_status:
            candidateState.skills_state
              ?.global_evidence_status,
          evidence_origin_type:
            candidateState.skills_state
              ?.primary_evidence_origin_type
        }
      }
    }
  }

  return {
    concept,
    evidenced: false,
    evidence: null
  }
}

function findWorkloadCapacityEvidence(
  concept,
  candidateState
) {
  if (concept === 'high_volume') {
    const workloadMetrics = []

    for (const experience of candidateState.experience_state || []) {
      for (const claim of experience.quantified_claims || []) {
        const metric = claim.metric || ''

        if (
          metric.includes('entretiens_') ||
          metric.includes('recrutements_') ||
          metric.includes('placements_')
        ) {
          workloadMetrics.push({
            source: experience.experience_id,
            employer: experience.employer || null,
            metric: claim.metric,
            value: claim.value,
            evidence_status: claim.evidence_status || null,
            evidence_origin_type:
              claim.evidence_origin_type || null
          })
        }
      }
    }

    return {
      concept,
      evidenced: workloadMetrics.length > 0,
      evidence: workloadMetrics
    }
  }

  if (concept === 'fast_pace') {
    return {
      concept,
      evidenced: false,
      evidence: null
    }
  }

  return {
    concept,
    evidenced: null,
    unsupported: true,
    evidence: null
  }
}

function collectDigitalEnvironmentEvidence(
  candidateState
) {
  const evidence = []

  const skills = candidateState.skills_state || {}

  for (const tool of skills.tools_claimed || []) {
    evidence.push({
      source: 'skills.tools_claimed',
      text: tool,
      evidence_status:
        skills.global_evidence_status || null,
      evidence_origin_type:
        skills.primary_evidence_origin_type || null
    })
  }

  const channels =
    skills.recruitment_channels_declared || {}

  if (channels.primary_ats_type?.value) {
    evidence.push({
      source:
        'skills.recruitment_channels_declared.primary_ats_type',
      text: channels.primary_ats_type.value,
      evidence_status:
        channels.primary_ats_type.evidence_status || null,
      evidence_origin_type:
        channels.primary_ats_type.evidence_origin_type || null
    })
  }

  for (const platform of channels.platforms || []) {
    if (!platform?.name) {
      continue
    }

    evidence.push({
      source:
        'skills.recruitment_channels_declared.platforms',
      text: platform.name,
      evidence_status:
        platform.evidence_status || null,
      evidence_origin_type:
        platform.evidence_origin_type || null
    })
  }

  return evidence
}

function evaluateDigitalEnvironmentRequirement(
  requirement,
  candidateState
) {
  const concepts =
    requirement.structured_parameters?.target_concepts

  if (
    !Array.isArray(concepts) ||
    concepts.length !== 1 ||
    concepts[0] !== 'digital_environment'
  ) {
    return buildResult(
      requirement,
      'unknown',
      0,
      null,
      'Digital-environment requirement uses an unsupported canonical concept.'
    )
  }

  const evidence =
    collectDigitalEnvironmentEvidence(candidateState)

  if (evidence.length === 0) {
    return buildResult(
      requirement,
      'unknown',
      0,
      null,
      'No canonical professional digital-environment evidence is available.'
    )
  }

  return buildResult(
    requirement,
    'partial_match',
    0.8,
    {
      concept: 'digital_environment',
      evidence
    },
    'Professional digital-environment usage is evidenced, but explicit comfort or mastery is not canonically confirmed.'
  )
}

function evaluateWorkloadCapacityRequirement(
  requirement,
  candidateState
) {
  const params = requirement.structured_parameters || {}
  const concepts = params.target_concepts
  const logic = params.logic

  if (!Array.isArray(concepts) || concepts.length === 0) {
    throw new Error(
      'TBZ deterministic match: workload_capacity requires target_concepts.'
    )
  }

  if (concepts.length > 1 && logic !== 'all' && logic !== 'any') {
    throw new Error(
      'TBZ deterministic match: workload_capacity requires explicit logic for multiple concepts.'
    )
  }

  const evaluated =
    concepts.map((concept) =>
      findWorkloadCapacityEvidence(
        concept,
        candidateState
      )
    )

  if (evaluated.some((item) => item.unsupported)) {
    return buildResult(
      requirement,
      'unknown',
      0,
      { concepts: evaluated },
      'At least one workload-capacity concept has no canonical evaluator.'
    )
  }

  const matched =
    evaluated.filter((item) => item.evidenced === true)

  const satisfied =
    concepts.length === 1
      ? matched.length === 1
      : logic === 'all'
        ? matched.length === evaluated.length
        : matched.length > 0

  if (satisfied) {
    return buildResult(
      requirement,
      'match',
      0.95,
      {
        logic: concepts.length > 1 ? logic : null,
        concepts: evaluated
      },
      'Workload-capacity requirement is fully evidenced.'
    )
  }

  if (matched.length > 0) {
    return buildResult(
      requirement,
      'partial_match',
      0.8,
      {
        logic,
        concepts: evaluated
      },
      'High-volume work is evidenced, but fast pace is not independently established.'
    )
  }

  return buildResult(
    requirement,
    'unknown',
    0,
    {
      logic,
      concepts: evaluated
    },
    'Required workload-capacity evidence is not established.'
  )
}

function evaluateLanguageCommunicationRequirement(
  requirement,
  candidateState
) {
  const params = requirement.structured_parameters || {}
  const concepts = params.target_concepts

  if (!Array.isArray(concepts) || concepts.length === 0) {
    throw new Error(
      'TBZ deterministic match: language_communication requires target_concepts.'
    )
  }

  const french =
    (candidateState.language_state || []).find(
      (item) =>
        normalizeText(item.language) === 'francais'
    )

  if (!french) {
    return buildResult(
      requirement,
      'unknown',
      0,
      null,
      'No canonical French-language evidence is available in candidate state.'
    )
  }

  if (french.proficiency_confirmed !== true) {
    return buildResult(
      requirement,
      'unknown',
      0,
      {
        language: french.language,
        claimed_level: french.claimed_level || null,
        evidence_status: french.evidence_status || null,
        proficiency_confirmed:
          french.proficiency_confirmed === true
      },
      'French language is declared, but professional oral/written communication proficiency is not canonically confirmed.'
    )
  }

  return buildResult(
    requirement,
    'match',
    0.95,
    {
      language: french.language,
      claimed_level: french.claimed_level || null,
      evidence_status: french.evidence_status || null,
      proficiency_confirmed: true
    },
    'French professional communication proficiency is canonically confirmed.'
  )
}

function evaluateProfessionalPracticeRequirement(
  requirement,
  candidateState
) {
  const params = requirement.structured_parameters || {}
  const concepts = params.target_concepts
  const logic = params.logic

  if (!Array.isArray(concepts) || concepts.length === 0) {
    throw new Error(
      'TBZ deterministic match: professional_practice requires target_concepts.'
    )
  }

  if (concepts.length > 1 && logic !== 'all' && logic !== 'any') {
    throw new Error(
      'TBZ deterministic match: professional_practice requires explicit logic for multiple concepts.'
    )
  }

  const evaluated =
    concepts.map((concept) =>
      findProfessionalPracticeEvidence(
        concept,
        candidateState
      )
    )

  if (evaluated.some((item) => item.unsupported)) {
    return buildResult(
      requirement,
      'unknown',
      0,
      {
        concepts: evaluated
      },
      'At least one professional-practice concept has no canonical evaluator.'
    )
  }

  const matched =
    evaluated.filter((item) => item.evidenced === true)

  const satisfied =
    concepts.length === 1
      ? matched.length === 1
      : logic === 'all'
        ? matched.length === evaluated.length
        : matched.length > 0

  if (satisfied) {
    return buildResult(
      requirement,
      'match',
      0.95,
      {
        logic: concepts.length > 1 ? logic : null,
        concepts: evaluated
      },
      'Professional-practice requirement is fully evidenced.'
    )
  }

  if (matched.length > 0) {
    return buildResult(
      requirement,
      'partial_match',
      0.8,
      {
        logic,
        concepts: evaluated
      },
      'Only part of the required professional-practice evidence is established.'
    )
  }

  return buildResult(
    requirement,
    'unknown',
    0,
    {
      logic,
      concepts: evaluated
    },
    'Required professional-practice evidence is not established.'
  )
}

function evaluateDomainExperienceRequirement(
  requirement,
  candidateState
) {
  const params = requirement.structured_parameters || {}
  const components = params.required_components
  const logic = params.logic

  if (!Array.isArray(components) || components.length === 0) {
    throw new Error(
      'TBZ deterministic match: domain_experience requires required_components.'
    )
  }

  if (logic !== 'all' && logic !== 'any') {
    throw new Error(
      'TBZ deterministic match: domain_experience requires logic "all" or "any".'
    )
  }

  const evaluated = components.map(
    (component) =>
      evaluateDomainExperienceComponent(
        component,
        candidateState
      )
  )

  if (evaluated.some((item) => item.unsupported)) {
    return buildResult(
      requirement,
      'unknown',
      0,
      {
        components: evaluated
      },
      'At least one domain-experience component has no canonical evaluator.'
    )
  }

  const matched =
    evaluated.filter((item) => item.evidenced === true)

  const satisfied =
    logic === 'all'
      ? matched.length === evaluated.length
      : matched.length > 0

  if (satisfied) {
    return buildResult(
      requirement,
      'match',
      0.95,
      {
        logic,
        components: evaluated
      },
      'Domain-experience requirement is fully evidenced.'
    )
  }

  if (matched.length > 0) {
    return buildResult(
      requirement,
      'partial_match',
      0.8,
      {
        logic,
        components: evaluated
      },
      'Only part of the required domain-experience evidence is established.'
    )
  }

  return buildResult(
    requirement,
    'unknown',
    0,
    {
      logic,
      components: evaluated
    },
    'Required domain-experience evidence is not established.'
  )
}

export function getRequirementRouteKey(requirement) {
  if (
    !requirement?.evaluation_mode ||
    !requirement?.requirement_type
  ) {
    throw new Error(
      'TBZ deterministic match: requirement routing metadata is required.'
    )
  }

  return (
    requirement.evaluation_mode +
    ':' +
    requirement.requirement_type
  )
}
