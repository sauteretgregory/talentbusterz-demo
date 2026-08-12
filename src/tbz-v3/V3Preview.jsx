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
            url: request.source_url
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
              padding: '14px 16px',
              borderRadius: 10,
              border: '1px solid #cbd5e1',
              fontSize: 16
            }}
          />

          <button
            type="submit"
            style={{
              padding: '14px 20px',
              border: 0,
              borderRadius: 10,
              fontWeight: 800,
              cursor: 'pointer',
              background: '#0b57d0',
              color: '#fff'
            }}
          >
            Analyser
          </button>
        </form>

        {jobIntake && (
          <div
            style={{
              marginTop: 14,
              padding: 14,
              borderRadius: 10,
              background: '#f3f7ff'
            }}
          >
            Source détectée : <strong>{jobIntake.detected_source}</strong>
            <br />
            Extraction :{' '}
            <strong>
              {jobIntake.extraction_status === 'loading'
                ? 'en cours…'
                : jobIntake.extraction_status === 'completed'
                  ? 'réussie'
                  : jobIntake.extraction_status}
            </strong>

            {jobIntake.provider_payload?.offer_id && (
              <>
                <br />
                Offre détectée :{' '}
                <strong>{jobIntake.provider_payload.offer_id}</strong>
              </>
            )}
          </div>
        )}

        {jobIntakeError && (
          <p style={{ color: '#b42318' }}>
            {jobIntakeError}
          </p>
        )}
      </section>

      {analysis && (
      <section
        style={{
          border: '1px solid #d9e1ee',
          borderRadius: 18,
          padding: 28,
          background: '#fff'
        }}
      >
        <p
          style={{
            margin: 0,
            fontSize: 14,
            fontWeight: 700,
            opacity: 0.65
          }}
        >
          {analysis
            ? 'Analyse TalentBusterZ'
            : 'En attente d’une offre'}
        </p>

        <h2 style={{ marginBottom: 8 }}>
          {getJobTitle(dynamicJob)}
        </h2>

        <p
          style={{
            marginTop: 0,
            fontSize: 18,
            opacity: 0.72
          }}
        >
          {getCompanyName(dynamicJob)}
        </p>

        {score !== null && (
          <div
            style={{
              marginTop: 28,
              padding: 20,
              borderRadius: 14,
              background: '#f3f7ff'
            }}
          >
            <strong
              style={{
                display: 'block',
                fontSize: 32
              }}
            >
              {score} %
            </strong>

            <span>
              compatibilité professionnelle estimée par TalentBusterZ
            </span>
          </div>
        )}

        <p style={{ marginTop: 24, lineHeight: 1.55 }}>
          {firstName ? `${firstName}, ` : ''}
          votre profil correspond déjà à plusieurs éléments importants
          de cette offre.
        </p>
      </section>
      )}

      {analysis && questions.length > 0 && (
        <section style={{ marginTop: 32 }}>
          <h2>
            Quelques précisions avant de préparer votre candidature
          </h2>

          <p style={{ opacity: 0.7 }}>
            TalentBusterZ ne vous demande que les informations
            qu’il ne connaît pas encore.
          </p>

          {questions.map((question, index) => (
            <div
              key={question.id}
              style={{
                marginTop: 18,
                padding: 20,
                border: '1px solid #d9e1ee',
                borderRadius: 14,
                background: '#fff'
              }}
            >
              <label
                style={{
                  display: 'block',
                  fontWeight: 700,
                  marginBottom: 12
                }}
              >
                {index + 1}. {question.text}
              </label>

              <textarea
                rows="3"
                placeholder="Votre réponse..."
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  padding: 12,
                  borderRadius: 10,
                  border: '1px solid #cbd5e1',
                  resize: 'vertical'
                }}
              />
            </div>
          ))}
        </section>
      )}

      {analysis && (
      <section style={{ marginTop: 36 }}>
        <button
          type="button"
          style={{
            width: '100%',
            padding: '17px 20px',
            border: 0,
            borderRadius: 12,
            fontSize: 18,
            fontWeight: 800,
            cursor: 'pointer',
            background: '#0b57d0',
            color: '#fff'
          }}
        >
          Je souhaite postuler
        </button>
      </section>
      )}
    </main>
  )
}
