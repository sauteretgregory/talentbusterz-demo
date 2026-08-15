import React, { useState } from 'react'

import candidate from './fixtures/doctrine/candidate.json'
import { createJobIntakeRequest } from './jobIntake.js'

function getJobTitle(job) {
  return job?.job_data_state?.job_identity?.title || job?.job_data_state?.job_identity?.job_title || 'Offre détectée'
}

function getCompanyName(job) {
  return job?.job_data_state?.employer_identity?.name || job?.job_data_state?.company_name || 'Employeur'
}

function getCompatibilityScore(match) {
  const score = match?.match_state?.professional_compatibility?.professional_match_score
  return typeof score === 'number' ? Math.round(score) : null
}

function getCandidateQuestions(probePlan) {
  const critical = probePlan?.probe_plan?.critical_questions || []
  const secondary = probePlan?.probe_plan?.secondary_questions || []
  return [...critical, ...secondary]
    .map((question, index) => ({
      id: question.question_id || `question-${index}`,
      text: question.question,
      priority: index < critical.length ? 'critical' : 'secondary'
    }))
    .filter((question) => question.text)
}

function getProbeState(probePlan, fallbackStatus = 'open') {
  const closure = probePlan?.loop_closure || {}
  const result = probePlan?.probe_result || {}
  const status = closure.status || result.loop_status || fallbackStatus
  const decision = closure.decision || result.adaptive_decision || (status === 'complete' ? 'complete' : 'continue_probe')
  return {
    status,
    decision,
    reason: closure.decision_reason || result.decision_reason || '',
    insufficientIds: closure.insufficient_question_ids || [],
    contradictoryIds: closure.contradictory_question_ids || [],
    remainingCount: typeof result.remaining_question_count === 'number' ? result.remaining_question_count : getCandidateQuestions(probePlan).length
  }
}

const styles = {
  card: {
    border: '1px solid #d9e1ee',
    borderRadius: 18,
    padding: 28,
    background: '#fff'
  },
  primaryButton: {
    width: '100%',
    padding: '17px 20px',
    border: 0,
    borderRadius: 12,
    fontSize: 18,
    fontWeight: 800,
    cursor: 'pointer',
    background: '#0b57d0',
    color: '#fff'
  }
}

export default function V3Preview() {
  const [jobUrl, setJobUrl] = useState('')
  const [jobIntake, setJobIntake] = useState(null)
  const [jobIntakeError, setJobIntakeError] = useState('')
  const [analysis, setAnalysis] = useState(null)
  const [answers, setAnswers] = useState({})
  const [rerunStatus, setRerunStatus] = useState('')
  const [rerunError, setRerunError] = useState('')
  const [previousScore, setPreviousScore] = useState(null)
  const [scoreDelta, setScoreDelta] = useState(null)
  const [probeCycleStatus, setProbeCycleStatus] = useState('')

  async function handleJobUrlSubmit(event) {
    event.preventDefault()
    setJobIntake(null)
    setJobIntakeError('')
    setAnalysis(null)
    setAnswers({})
    setRerunStatus('')
    setRerunError('')
    setPreviousScore(null)
    setScoreDelta(null)
    setProbeCycleStatus('')

    try {
      const request = createJobIntakeRequest(jobUrl)
      setJobIntake({ ...request, extraction_status: 'loading' })

      const response = await fetch('http://localhost:8787/api/job-intake', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: request.source_url, candidate })
      })

      const result = await response.json()
      if (!response.ok || result.status !== 'completed') {
        throw new Error(result.error || 'Échec de l’analyse de l’offre.')
      }

      setJobIntake({
        ...request,
        extraction_status: 'completed',
        provider_id: result.provider_id,
        provider_payload: result.provider_payload
      })

      setAnalysis({
        candidate: result.canonical_candidate_data_state,
        job: result.canonical_job_data_state,
        match: result.canonical_match_state,
        probePlan: result.canonical_probe_plan
      })
      setProbeCycleStatus(result.canonical_probe_plan?.loop_closure?.status || 'open')
    } catch (error) {
      setJobIntake(null)
      setJobIntakeError(error.message)
    }
  }

  function updateAnswer(questionId, value) {
    setAnswers((current) => ({ ...current, [questionId]: value }))
  }

  async function handleProbeSubmit(event) {
    event.preventDefault()
    if (!analysis) return

    const responses = Object.entries(answers)
      .map(([question_id, answer]) => ({ question_id, answer: answer.trim() }))
      .filter((response) => response.answer)

    if (!responses.length) {
      setRerunError('Répondez au moins à une question avant de continuer.')
      return
    }

    setRerunStatus('Mise à jour du profil et recalcul du MATCH…')
    setRerunError('')
    setPreviousScore(getCompatibilityScore(analysis.match))
    setScoreDelta(null)

    try {
      const response = await fetch('http://localhost:8787/api/probe-responses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          canonical_candidate_data_state: analysis.candidate,
          canonical_job_data_state: analysis.job,
          canonical_probe_plan: analysis.probePlan,
          responses
        })
      })

      const result = await response.json()
      if (!response.ok || result.status !== 'completed') {
        throw new Error(result.error || 'Échec de la réingestion des réponses.')
      }

      setAnalysis((current) => ({
        ...current,
        candidate: result.canonical_candidate_data_state,
        match: result.canonical_match_state,
        probePlan: result.canonical_probe_plan
      }))
      setProbeCycleStatus(result.probe_cycle_status || result.canonical_probe_plan?.loop_closure?.status || 'open')
      setScoreDelta(typeof result.score_delta === 'number' ? result.score_delta : null)
      setAnswers({})

      const state = getProbeState(result.canonical_probe_plan, result.probe_cycle_status)
      if (state.status === 'complete') {
        setRerunStatus('Profil enrichi, MATCH recalculé et boucle PROBE terminée.')
      } else if (state.status === 'needs_clarification') {
        setRerunStatus('Certaines réponses nécessitent une clarification avant de poursuivre.')
      } else {
        setRerunStatus('Profil enrichi et MATCH recalculé. De nouvelles précisions restent nécessaires.')
      }
    } catch (error) {
      setRerunStatus('')
      setRerunError(error.message)
    }
  }

  const dynamicJob = analysis?.job || null
  const dynamicMatch = analysis?.match || null
  const dynamicProbePlan = analysis?.probePlan || null
  const score = getCompatibilityScore(dynamicMatch)
  const questions = getCandidateQuestions(dynamicProbePlan)
  const firstName = candidate?.candidate_data_state?.identity_state?.full_name?.value?.split(' ')?.[0] || ''
  const probeState = getProbeState(dynamicProbePlan, probeCycleStatus)
  const displayedScoreDelta = scoreDelta !== null
    ? scoreDelta
    : previousScore !== null && score !== null
      ? score - previousScore
      : null

  const questionStatus = (questionId) => {
    if (probeState.insufficientIds.includes(questionId)) return 'Réponse insuffisante — précisez votre réponse.'
    if (probeState.contradictoryIds.includes(questionId)) return 'Réponse contradictoire — précisez votre réponse.'
    return ''
  }

  const showProbeForm = analysis && probeState.status !== 'complete' && questions.length > 0
  const showApplyButton = analysis && probeState.status === 'complete'

  return (
    <main style={{ maxWidth: 760, margin: '0 auto', padding: '48px 24px 80px', fontFamily: 'Arial, sans-serif' }}>
      <div style={{ fontWeight: 800, fontSize: 22, marginBottom: 40 }}>TalentBusterZ</div>

      <section style={{ marginBottom: 36 }}>
        <h1 style={{ marginBottom: 8 }}>Une offre vous intéresse ?</h1>
        <p style={{ opacity: 0.7 }}>Collez simplement son lien. TalentBusterZ s’occupe du reste.</p>

        <form onSubmit={handleJobUrlSubmit} style={{ display: 'flex', gap: 10, marginTop: 18 }}>
          <input type="url" required value={jobUrl} onChange={(event) => setJobUrl(event.target.value)} placeholder="https://..." style={{ flex: 1, padding: '14px 16px', borderRadius: 10, border: '1px solid #cbd5e1', fontSize: 16 }} />
          <button type="submit" style={{ padding: '14px 20px', border: 0, borderRadius: 10, fontWeight: 800, cursor: 'pointer', background: '#0b57d0', color: '#fff' }}>Analyser</button>
        </form>

        {jobIntake && (
          <div style={{ marginTop: 14, padding: 14, borderRadius: 10, background: '#f3f7ff' }}>
            Source détectée : <strong>{jobIntake.detected_source}</strong><br />
            Extraction : <strong>{jobIntake.extraction_status === 'loading' ? 'en cours…' : 'réussie'}</strong>
            {jobIntake.provider_payload?.offer_id && <><br />Offre détectée : <strong>{jobIntake.provider_payload.offer_id}</strong></>}
          </div>
        )}
        {jobIntakeError && <p style={{ color: '#b42318' }}>{jobIntakeError}</p>}
      </section>

      {analysis && (
        <section style={styles.card}>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 700, opacity: 0.65 }}>Analyse TalentBusterZ</p>
          <h2 style={{ marginBottom: 8 }}>{getJobTitle(dynamicJob)}</h2>
          <p style={{ marginTop: 0, fontSize: 18, opacity: 0.72 }}>{getCompanyName(dynamicJob)}</p>

          {score !== null && (
            <div style={{ marginTop: 28, padding: 20, borderRadius: 14, background: '#f3f7ff' }}>
              <strong style={{ display: 'block', fontSize: 32 }}>{score} %</strong>
              <span>compatibilité professionnelle estimée par TalentBusterZ</span>
              {displayedScoreDelta !== null && <div style={{ marginTop: 8, fontWeight: 700 }}>Évolution depuis vos réponses : {displayedScoreDelta >= 0 ? '+' : ''}{displayedScoreDelta} point{Math.abs(displayedScoreDelta) > 1 ? 's' : ''}</div>}
            </div>
          )}

          {probeState.decision === 'continue_probe' && (
            <div style={{ marginTop: 20, padding: 16, borderRadius: 12, background: '#eff6ff', color: '#1d4ed8', fontWeight: 700 }}>
              De nouvelles précisions peuvent encore améliorer l’évaluation. {probeState.remainingCount > 0 && `${probeState.remainingCount} question${probeState.remainingCount > 1 ? 's' : ''} reste${probeState.remainingCount > 1 ? 'nt' : ''} à traiter.`}
            </div>
          )}

          {probeState.status === 'needs_clarification' && (
            <div style={{ marginTop: 20, padding: 16, borderRadius: 12, background: '#fff7ed', color: '#9a3412', fontWeight: 700 }}>
              Une clarification est nécessaire avant de poursuivre l’évaluation.
              {probeState.insufficientIds.length > 0 && <div style={{ marginTop: 8 }}>Réponse insuffisante : {probeState.insufficientIds.length} question{probeState.insufficientIds.length > 1 ? 's' : ''}.</div>}
              {probeState.contradictoryIds.length > 0 && <div style={{ marginTop: 4 }}>Réponse contradictoire : {probeState.contradictoryIds.length} question{probeState.contradictoryIds.length > 1 ? 's' : ''}.</div>}
            </div>
          )}

          {probeState.status === 'complete' && (
            <div style={{ marginTop: 20, padding: 16, borderRadius: 12, background: '#ecfdf3', color: '#166534', fontWeight: 700 }}>
              La boucle de clarification candidat est terminée : toutes les questions PROBE actuellement actionnables ont été traitées.
            </div>
          )}
        </section>
      )}

      {showProbeForm && (
        <form onSubmit={handleProbeSubmit} style={{ marginTop: 32 }}>
          <section>
            <h2>{probeState.status === 'needs_clarification' ? 'Précisez vos réponses' : 'Quelques précisions avant de préparer votre candidature'}</h2>
            <p style={{ opacity: 0.7 }}>Vos réponses enrichissent votre profil candidat. Elles sont ensuite réinjectées dans le CANDIDATE DATA ENGINE avant de recalculer le MATCH.</p>

            {questions.map((question, index) => {
              const statusMessage = questionStatus(question.id)
              return (
                <div key={question.id} style={{ marginTop: 18, padding: 20, border: '1px solid #d9e1ee', borderRadius: 14, background: '#fff' }}>
                  <label style={{ display: 'block', fontWeight: 700, marginBottom: 12 }}>{index + 1}. {question.text}</label>
                  {statusMessage && <p style={{ marginTop: 0, color: '#9a3412', fontWeight: 700 }}>{statusMessage}</p>}
                  <textarea rows="4" value={answers[question.id] || ''} onChange={(event) => updateAnswer(question.id, event.target.value)} placeholder="Votre réponse…" style={{ width: '100%', boxSizing: 'border-box', padding: 12, borderRadius: 10, border: '1px solid #cbd5e1', resize: 'vertical' }} />
                </div>
              )
            })}
          </section>

          <section style={{ marginTop: 24 }}>
            <button type="submit" style={styles.primaryButton}>{probeState.status === 'needs_clarification' ? 'Corriger mes réponses et recalculer le MATCH' : 'Mettre à jour mon profil et recalculer le MATCH'}</button>
            {rerunStatus && <p style={{ marginTop: 12, color: '#166534', fontWeight: 700 }}>{rerunStatus}</p>}
            {rerunError && <p style={{ marginTop: 12, color: '#b42318', fontWeight: 700 }}>{rerunError}</p>}
          </section>
        </form>
      )}

      {analysis && !showProbeForm && !showApplyButton && rerunError && (
        <p style={{ marginTop: 24, color: '#b42318', fontWeight: 700 }}>{rerunError}</p>
      )}

      {showApplyButton && (
        <section style={{ marginTop: 36 }}>
          <button type="button" style={styles.primaryButton}>Je souhaite postuler</button>
        </section>
      )}
    </main>
  )
}
