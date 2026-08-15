import React, { useState } from 'react'

import candidate from './fixtures/doctrine/candidate.json'

import { createJobIntakeRequest } from './jobIntake.js'

function getJobTitle(job) {
  return (
    job?.job_data_state?.job_identity?.title ||
    job?.job_data_state?.job_identity?.job_title ||
    'Offre détectée'
  )
}

function getCompanyName(job) {
  return (
    job?.job_data_state?.employer_identity?.name ||
    job?.job_data_state?.company_name ||
    'Employeur'
  )
}

function getCompatibilityScore(match) {
  const score =
    match?.match_state?.professional_compatibility
      ?.professional_match_score

  return typeof score === 'number'
    ? Math.round(score)
    : null
}

function getCandidateQuestions(probePlan) {
  const critical =
    probePlan?.probe_plan?.critical_questions || []

  const secondary =
    probePlan?.probe_plan?.secondary_questions || []

  return [...critical, ...secondary]
    .map((question, index) => ({
      id:
        question.question_id ||
        `question-${index}`,
      text: question.question,
      priority:
        index < critical.length
          ? 'critical'
          : 'secondary'
    }))
    .filter((question) => question.text)
}

export default function V3Preview() {
  const [jobUrl, setJobUrl] = useState('')
  const [jobIntake, setJobIntake] = useState(null)
  const [jobIntakeError, setJobIntakeError] = useState('')
  const [analysis, setAnalysis] = useState(null)

  async function handleJobUrlSubmit(event) {
    event.preventDefault()

    setJobIntake(null)
    setJobIntakeError('')
    setAnalysis(null)

    try {
      const request = createJobIntakeRequest(jobUrl)

      setJobIntake({
        ...request,
        extraction_status: 'loading'
      })

      const response = await fetch(
        'http://localhost:8787/api/job-intake',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            url: request.source_url,
            candidate
          })
        }
      )

      const result = await response.json()

      if (!response.ok || result.status !== 'completed') {
        throw new Error(
          result.error || 'Échec de l’extraction de l’offre.'
        )
      }

      setJobIntake({
        ...request,
        extraction_status: 'completed',
        provider_id: result.provider_id,
        provider_payload: result.provider_payload
      })

      setAnalysis({
        job: result.canonical_job_data_state,
        match: result.canonical_match_state,
        probePlan: result.canonical_probe_plan
      })
    } catch (error) {
      setJobIntake(null)
      setJobIntakeError(error.message)
    }
  }


  const dynamicJob = analysis?.job || null
  const dynamicMatch = analysis?.match || null
  const dynamicProbePlan = analysis?.probePlan || null

  const score =
    getCompatibilityScore(dynamicMatch)

  const questions =
    getCandidateQuestions(dynamicProbePlan)

  const firstName =
    candidate?.candidate_data_state?.identity_state?.first_name ||
    candidate?.candidate_data_state?.identity?.first_name ||
    ''

  return (
    <main
      style={{
        maxWidth: 760,
        margin: '0 auto',
        padding: '48px 24px 80px',
        fontFamily: 'Arial, sans-serif'
      }}
    >
      <div
        style={{
          fontWeight: 800,
          fontSize: 22,
          marginBottom: 40
        }}
      >
        TalentBusterZ
      </div>

      <section style={{ marginBottom: 36 }}>
        <h1 style={{ marginBottom: 8 }}>
          Une offre vous intéresse ?
        </h1>

        <p style={{ opacity: 0.7 }}>
          Collez simplement son lien. TalentBusterZ s’occupe du reste.
        </p>

        <form
          onSubmit={handleJobUrlSubmit}
          style={{
            display: 'flex',
            gap: 10,
            marginTop: 18
          }}
        >
          <input
            type="url"
            value={jobUrl}
            onChange={(event) => setJobUrl(event.target.value)}
            placeholder="https://..."
            style={{
              flex: 1,
              padding: '12px 14px',
              border: '1px solid #ccc',
              borderRadius: 8
            }}
          />

          <button
            type="submit"
            style={{
              padding: '12px 18px',
              borderRadius: 8,
              border: 'none',
              cursor: 'pointer',
              fontWeight: 700
            }}
          >
            Analyser
          </button>
        </form>

        {jobIntake?.extraction_status === 'loading' && (
          <p style={{ marginTop: 16 }}>
            Analyse de l’offre en cours…
          </p>
        )}

        {jobIntakeError && (
          <p style={{ marginTop: 16 }}>
            {jobIntakeError}
          </p>
        )}
      </section>

      {dynamicJob && (
        <section
          style={{
            border: '1px solid #ddd',
            borderRadius: 12,
            padding: 24,
            marginBottom: 24
          }}
        >
          <h2 style={{ marginTop: 0 }}>
            {getJobTitle(dynamicJob)}
          </h2>

          <p>
            {getCompanyName(dynamicJob)}
          </p>

          {score !== null && (
            <p>
              Compatibilité : <strong>{score}/100</strong>
            </p>
          )}

          {firstName && (
            <p>
              Profil analysé : <strong>{firstName}</strong>
            </p>
          )}
        </section>
      )}

      {questions.length > 0 && (
        <section>
          <h2>Questions complémentaires</h2>
          {questions.map((question) => (
            <div
              key={question.id}
              style={{
                padding: '14px 0',
                borderBottom: '1px solid #eee'
              }}
            >
              <strong>
                {question.priority === 'critical'
                  ? 'Prioritaire'
                  : 'Complémentaire'}
              </strong>
              <p style={{ marginBottom: 0 }}>
                {question.text}
              </p>
            </div>
          ))}
        </section>
      )}
    </main>
  )
}
