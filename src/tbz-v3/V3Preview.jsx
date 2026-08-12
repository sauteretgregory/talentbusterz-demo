import React, { useState } from 'react'

import candidate from './fixtures/doctrine/candidate.json'
import job from './fixtures/doctrine/job.json'
import match from './fixtures/doctrine/match.json'
import probePlan from './fixtures/doctrine/probe-plan.json'

import { createJobIntakeRequest } from './jobIntake.js'

function getJobTitle() {
  return (
    job?.job_data_state?.job_identity?.title ||
    job?.job_data_state?.job_identity?.job_title ||
    'Offre détectée'
  )
}

function getCompanyName() {
  return (
    job?.job_data_state?.employer_identity?.name ||
    job?.job_data_state?.company_name ||
    'Employeur'
  )
}

function getCompatibilityScore() {
  const scoring =
    match?.match_state?.professional_compatibility?.scoring

  const candidates = [
    scoring?.final_score,
    scoring?.score,
    match?.match_state?.professional_compatibility?.score
  ]

  const direct = candidates.find(
    (value) => typeof value === 'number'
  )

  if (typeof direct === 'number') {
    return direct <= 1
      ? Math.round(direct * 100)
      : Math.round(direct)
  }

  const confidence =
    match?.match_state?.professional_compatibility?.confidence

  return typeof confidence === 'number'
    ? Math.round(confidence * 100)
    : null
}

function getCandidateQuestions() {
  const candidates = [
    probePlan?.probe_questions,
    probePlan?.questions,
    probePlan?.probe_plan?.questions,
    probePlan?.probe_result?.questions
  ]

  const questions = candidates.find(Array.isArray)

  if (questions?.length) {
    return questions
      .map((question, index) => ({
        id:
          question.question_id ||
          question.probe_candidate_id ||
          `question-${index}`,
        text:
          question.question_text ||
          question.question ||
          question.text ||
          question.label
      }))
      .filter((question) => question.text)
  }

  return (
    match?.match_state?.candidate_unknowns || []
  ).map((unknown, index) => ({
    id:
      unknown.probe_candidate_id ||
      unknown.unknown_id ||
      `unknown-${index}`,
    text:
      unknown.related_job_requirement
        ? `Pouvez-vous préciser votre expérience concernant : ${unknown.related_job_requirement} ?`
        : 'Une information complémentaire est nécessaire.'
  }))
}

export default function V3Preview() {
  const [jobUrl, setJobUrl] = useState('')
  const [jobIntake, setJobIntake] = useState(null)
  const [jobIntakeError, setJobIntakeError] = useState('')

  function handleJobUrlSubmit(event) {
    event.preventDefault()

    try {
      const request = createJobIntakeRequest(jobUrl)
      setJobIntake(request)
      setJobIntakeError('')
    } catch (error) {
      setJobIntake(null)
      setJobIntakeError(error.message)
    }
  }

  const score = getCompatibilityScore()
  const questions = getCandidateQuestions()

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
            Extraction : <strong>à connecter</strong>
          </div>
        )}

        {jobIntakeError && (
          <p style={{ color: '#b42318' }}>
            {jobIntakeError}
          </p>
        )}
      </section>

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
          Exemple actuellement chargé
        </p>

        <h2 style={{ marginBottom: 8 }}>
          {getJobTitle()}
        </h2>

        <p
          style={{
            marginTop: 0,
            fontSize: 18,
            opacity: 0.72
          }}
        >
          {getCompanyName()}
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

      {questions.length > 0 && (
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
    </main>
  )
}
