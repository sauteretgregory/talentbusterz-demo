import React, { useState } from 'react'
import candidate from './fixtures/doctrine/candidate.json'
import { createJobIntakeRequest } from './jobIntake.js'

const styles = {
  card: { border: '1px solid #d9e1ee', borderRadius: 18, padding: 28, background: '#fff' },
  button: { padding: '14px 18px', border: 0, borderRadius: 10, fontWeight: 800, cursor: 'pointer' },
  primary: { background: '#0b57d0', color: '#fff' }
}

function scoreOf(match) {
  const score = match?.match_state?.professional_compatibility?.professional_match_score
  return typeof score === 'number' ? Math.round(score) : null
}

function questionsOf(probePlan) {
  return [...(probePlan?.probe_plan?.critical_questions || []), ...(probePlan?.probe_plan?.secondary_questions || [])]
    .filter((question) => question?.question_id && question?.question)
    .slice(0, 5)
}

function firstNameOf() {
  return candidate?.candidate_data_state?.identity_state?.full_name?.value?.split(' ')?.[0] || 'candidat'
}

export default function V3Preview() {
  const [jobUrl, setJobUrl] = useState('')
  const [analysis, setAnalysis] = useState(null)
  const [answers, setAnswers] = useState({})
  const [skipped, setSkipped] = useState({})
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [previousScore, setPreviousScore] = useState(null)
  const [scoreDelta, setScoreDelta] = useState(null)
  const [cycleNumber, setCycleNumber] = useState(1)

  async function callProbe(body) {
    const response = await fetch('http://localhost:8787/api/probe-responses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })
    const result = await response.json()
    if (!response.ok || result.status !== 'completed') throw new Error(result.error || 'Échec du cycle d’enrichissement.')
    return result
  }

  async function handleJobSubmit(event) {
    event.preventDefault()
    setError('')
    setStatus('Chargement du profil candidat puis analyse de l’offre…')
    try {
      const request = createJobIntakeRequest(jobUrl)
      const response = await fetch('http://localhost:8787/api/job-intake', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: request.source_url, candidate })
      })
      const result = await response.json()
      if (!response.ok || result.status !== 'completed') throw new Error(result.error || 'Échec de l’analyse de l’offre.')
      setAnalysis({ candidate: result.canonical_candidate_data_state, job: result.canonical_job_data_state, match: result.canonical_match_state, probePlan: result.canonical_probe_plan })
      setPreviousScore(scoreOf(result.canonical_match_state))
      setScoreDelta(null)
      setCycleNumber(1)
      setStatus('Profil candidat chargé. Le MATCH initial est établi. Vous pouvez maintenant enrichir votre profil.')
      setAnswers({})
      setSkipped({})
    } catch (err) {
      setError(err.message)
      setStatus('')
    }
  }

  function updateAnswer(id, value) {
    setAnswers((current) => ({ ...current, [id]: value }))
    setSkipped((current) => ({ ...current, [id]: false }))
  }

  function skipQuestion(id) {
    setSkipped((current) => ({ ...current, [id]: true }))
    setAnswers((current) => ({ ...current, [id]: '' }))
  }

  async function submitCycle(event) {
    event.preventDefault()
    if (!analysis) return
    const responses = questionsOf(analysis.probePlan).map((question) => skipped[question.question_id]
      ? { question_id: question.question_id, skipped: true }
      : { question_id: question.question_id, answer: (answers[question.question_id] || '').trim() }
    ).filter((response) => response.skipped || response.answer)
    if (!responses.length) {
      setError('Répondez à au moins une question ou passez-en une explicitement.')
      return
    }

    setError('')
    setStatus('Chaque réponse enrichit le profil candidat puis repasse immédiatement par le MATCH…')
    const oldScore = scoreOf(analysis.match)
    try {
      const result = await callProbe({
        canonical_candidate_data_state: analysis.candidate,
        canonical_job_data_state: analysis.job,
        canonical_probe_plan: analysis.probePlan,
        previous_match_state: analysis.match,
        responses,
        cycle_number: cycleNumber
      })
      setAnalysis((current) => ({ ...current, candidate: result.canonical_candidate_data_state, match: result.canonical_match_state, probePlan: result.canonical_probe_plan }))
      setPreviousScore(oldScore)
      setScoreDelta(typeof result.score_delta === 'number' ? result.score_delta : null)
      setAnswers({})
      setSkipped({})
      setStatus(result.probe_cycle_status === 'needs_clarification'
        ? 'Certaines réponses nécessitent une clarification.'
        : 'Profil enrichi et MATCH recalculé. Chaque réponse est désormais intégrée au profil persistant.')
    } catch (err) {
      setError(err.message)
      setStatus('')
    }
  }

  async function chooseContinuation(decision) {
    if (!analysis) return
    setError('')
    setStatus(decision === 'continue_enrichment' ? 'Nouveau cycle d’enrichissement…' : 'Arrêt de l’enrichissement. Passage vers CV puis Render…')
    try {
      const result = await callProbe({
        canonical_candidate_data_state: analysis.candidate,
        canonical_job_data_state: analysis.job,
        canonical_probe_plan: analysis.probePlan,
        previous_match_state: analysis.match,
        responses: [{ control: decision }],
        cycle_number: cycleNumber
      })
      setAnalysis((current) => ({ ...current, candidate: result.canonical_candidate_data_state, match: result.canonical_match_state, probePlan: result.canonical_probe_plan }))
      if (decision === 'continue_enrichment') {
        setCycleNumber((value) => value + 1)
        setStatus('Nouveau cycle prêt : jusqu’à 5 questions. Les réponses seront à nouveau réinjectées dans le profil puis dans le MATCH.')
      } else {
        setStatus('Enrichissement arrêté. Handoff : CV ENGINE → RENDER ENGINE.')
      }
    } catch (err) {
      setError(err.message)
      setStatus('')
    }
  }

  const match = analysis?.match
  const probePlan = analysis?.probePlan
  const score = scoreOf(match)
  const questions = questionsOf(probePlan)
  const probeStatus = probePlan?.loop_closure?.status || probePlan?.probe_result?.loop_status
  const decision = probePlan?.loop_closure?.decision || probePlan?.probe_result?.adaptive_decision
  const cycle = probePlan?.probe_result?.enrichment_cycle
  const applicationReady = probeStatus === 'complete' && (decision === 'stop_enrichment' || decision === 'complete')

  return (
    <main style={{ maxWidth: 780, margin: '0 auto', padding: '44px 24px 80px', fontFamily: 'Arial, sans-serif' }}>
      <div style={{ fontWeight: 900, fontSize: 22, marginBottom: 32 }}>TalentBusterZ V3</div>

      <section style={styles.card}>
        <h1 style={{ marginTop: 0 }}>Votre profil candidat d’abord</h1>
        <p style={{ opacity: .72 }}>Le profil est la mémoire durable. Une offre sert à contextualiser le MATCH, pas à définir votre profil.</p>
        <p><strong>{firstNameOf()}</strong> — profil candidat canonique chargé.</p>
        <form onSubmit={handleJobSubmit} style={{ display: 'flex', gap: 10, marginTop: 18 }}>
          <input required type="url" value={jobUrl} onChange={(event) => setJobUrl(event.target.value)} placeholder="Lien de l’offre à comparer" style={{ flex: 1, padding: 14, borderRadius: 10, border: '1px solid #cbd5e1', fontSize: 16 }} />
          <button type="submit" style={{ ...styles.button, ...styles.primary }}>Analyser</button>
        </form>
      </section>

      {status && <p style={{ marginTop: 18, fontWeight: 700 }}>{status}</p>}
      {error && <p style={{ color: '#b42318', fontWeight: 700 }}>{error}</p>}

      {analysis && (
        <>
          <section style={{ ...styles.card, marginTop: 24 }}>
            <div style={{ fontSize: 14, opacity: .6 }}>MATCH — contexte de l’offre courante</div>
            <h2 style={{ marginBottom: 8 }}>{analysis.job?.job_data_state?.job_identity?.title || 'Offre analysée'}</h2>
            {score !== null && <div style={{ fontSize: 38, fontWeight: 900 }}>{score}%</div>}
            {scoreDelta !== null && <div style={{ fontWeight: 800 }}>Évolution après vos réponses : {scoreDelta >= 0 ? '+' : ''}{scoreDelta} point{Math.abs(scoreDelta) > 1 ? 's' : ''}</div>}
            {cycle && cycle.estimated_potential_score_gain > 0 && probeStatus === 'awaiting_continuation' && (
              <div style={{ marginTop: 16, padding: 16, borderRadius: 12, background: '#eff6ff', color: '#1d4ed8', fontWeight: 800 }}>
                Enrichir davantage le profil : gain potentiel estimé jusqu’à +{cycle.estimated_potential_score_gain} points sur le MATCH actuel.
              </div>
            )}
          </section>

          {probeStatus !== 'complete' && probeStatus !== 'awaiting_continuation' && questions.length > 0 && (
            <form onSubmit={submitCycle} style={{ marginTop: 24 }}>
              <section style={styles.card}>
                <h2 style={{ marginTop: 0 }}>Cycle {cycleNumber} — jusqu’à 5 questions</h2>
                <p style={{ opacity: .7 }}>Répondez, ou passez certaines questions. Après chaque réponse, le profil est enrichi et le MATCH est recalculé.</p>
                {questions.map((question, index) => (
                  <div key={question.question_id} style={{ marginTop: 18, padding: 18, border: '1px solid #d9e1ee', borderRadius: 12 }}>
                    <label style={{ display: 'block', fontWeight: 800, marginBottom: 10 }}>{index + 1}. {question.question}</label>
                    <textarea rows="3" disabled={skipped[question.question_id]} value={answers[question.question_id] || ''} onChange={(event) => updateAnswer(question.question_id, event.target.value)} placeholder="Votre réponse…" style={{ width: '100%', boxSizing: 'border-box', padding: 12, borderRadius: 8, border: '1px solid #cbd5e1' }} />
                    <button type="button" onClick={() => skipQuestion(question.question_id)} style={{ ...styles.button, marginTop: 8, background: '#f1f5f9' }}>{skipped[question.question_id] ? 'Question passée' : 'Passer cette question'}</button>
                  </div>
                ))}
                <button type="submit" style={{ ...styles.button, ...styles.primary, width: '100%', marginTop: 20 }}>Enregistrer mes réponses et recalculer le MATCH</button>
              </section>
            </form>
          )}

          {probeStatus === 'needs_clarification' && (
            <section style={{ ...styles.card, marginTop: 24 }}>
              <h2 style={{ marginTop: 0 }}>Clarification nécessaire</h2>
              <p>Une réponse insuffisante ou contradictoire doit être corrigée avant de poursuivre.</p>
            </section>
          )}

          {probeStatus === 'awaiting_continuation' && (
            <section style={{ ...styles.card, marginTop: 24 }}>
              <h2 style={{ marginTop: 0 }}>Continuer l’enrichissement ?</h2>
              <p>Les réponses viennent d’être intégrées au <strong>profil candidat persistant</strong> et le MATCH vient d’être recalculé.</p>
              <p><strong>Oui</strong> : nouveau cycle de 5 questions. <strong>Non</strong> : on arrête le PROBE et on passe au CV puis au Render.</p>
              <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
                <button type="button" onClick={() => chooseContinuation('continue_enrichment')} style={{ ...styles.button, ...styles.primary, flex: 1 }}>Oui, continuer</button>
                <button type="button" onClick={() => chooseContinuation('stop_enrichment')} style={{ ...styles.button, background: '#f1f5f9', flex: 1 }}>Non, passer au CV</button>
              </div>
            </section>
          )}

          {applicationReady && (
            <section style={{ ...styles.card, marginTop: 24 }}>
              <h2 style={{ marginTop: 0 }}>PROBE terminé</h2>
              <p>Le profil candidat est suffisamment enrichi pour quitter la boucle de questions.</p>
              <div style={{ padding: 16, borderRadius: 12, background: '#ecfdf3', color: '#166534', fontWeight: 800 }}>
                Étape suivante : <strong>CV ENGINE</strong> → <strong>RENDER ENGINE</strong>.
              </div>
            </section>
          )}
        </>
      )}
    </main>
  )
}
