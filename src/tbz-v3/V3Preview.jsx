import React, { useState } from 'react'
import candidate from './fixtures/doctrine/candidate.json'
import { createJobIntakeRequest } from './jobIntake.js'

const styles = { card: { border: '1px solid #d9e1ee', borderRadius: 18, padding: 28, background: '#fff' }, button: { padding: '14px 18px', border: 0, borderRadius: 10, fontWeight: 800, cursor: 'pointer' }, primary: { background: '#0b57d0', color: '#fff' } }
function scoreOf(match) { const score = match?.match_state?.professional_compatibility?.professional_match_score; return typeof score === 'number' ? Math.round(score) : null }
function questionsOf(plan) { return [...(plan?.probe_plan?.critical_questions || []), ...(plan?.probe_plan?.secondary_questions || [])].filter((q) => q?.question_id && q?.question).slice(0, 5) }
function firstNameOf() { return candidate?.candidate_data_state?.identity_state?.full_name?.value?.split(' ')?.[0] || 'candidat' }

export default function V3Preview() {
  const [jobUrl, setJobUrl] = useState('')
  const [analysis, setAnalysis] = useState(null)
  const [answer, setAnswer] = useState('')
  const [skipped, setSkipped] = useState(false)
  const [questionIndex, setQuestionIndex] = useState(0)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [previousScore, setPreviousScore] = useState(null)
  const [scoreDelta, setScoreDelta] = useState(null)
  const [cycleNumber, setCycleNumber] = useState(1)

  async function callProbe(body) {
    const response = await fetch('http://localhost:8787/api/probe-responses', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const result = await response.json()
    if (!response.ok || result.status !== 'completed') throw new Error(result.error || 'Échec du cycle d’enrichissement.')
    return result
  }

  async function handleJobSubmit(event) {
    event.preventDefault(); setError(''); setStatus('Chargement du profil candidat puis analyse de l’offre…')
    try {
      const request = createJobIntakeRequest(jobUrl)
      const response = await fetch('http://localhost:8787/api/job-intake', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: request.source_url, candidate }) })
      const result = await response.json()
      if (!response.ok || result.status !== 'completed') throw new Error(result.error || 'Échec de l’analyse de l’offre.')
      setAnalysis({ candidate: result.canonical_candidate_data_state, job: result.canonical_job_data_state, match: result.canonical_match_state, probePlan: result.canonical_probe_plan })
      setPreviousScore(scoreOf(result.canonical_match_state)); setScoreDelta(null); setCycleNumber(1); setQuestionIndex(0); setAnswer(''); setSkipped(false)
      setStatus('Profil candidat chargé. MATCH initial établi. Nous allons maintenant enrichir le profil, une réponse à la fois.')
    } catch (err) { setError(err.message); setStatus('') }
  }

  async function submitAnswer(event) {
    event.preventDefault()
    if (!analysis) return
    const questions = questionsOf(analysis.probePlan)
    const question = questions[questionIndex]
    if (!question) return
    if (!skipped && !answer.trim()) { setError('Répondez à la question ou passez-la.'); return }
    setError(''); setStatus('Réponse enregistrée : enrichissement du profil puis recalcul immédiat du MATCH…')
    const oldScore = scoreOf(analysis.match)
    try {
      const result = await callProbe({ canonical_candidate_data_state: analysis.candidate, canonical_job_data_state: analysis.job, canonical_probe_plan: analysis.probePlan, previous_match_state: analysis.match, responses: [{ question_id: question.question_id, ...(skipped ? { skipped: true } : { answer: answer.trim() }) }], cycle_number: cycleNumber })
      setAnalysis((current) => ({ ...current, candidate: result.canonical_candidate_data_state, match: result.canonical_match_state, probePlan: result.canonical_probe_plan }))
      setPreviousScore(oldScore); setScoreDelta(typeof result.score_delta === 'number' ? result.score_delta : null); setAnswer(''); setSkipped(false); setQuestionIndex(0)
      setStatus(result.probe_cycle_status === 'needs_clarification' ? 'Réponse à clarifier. Le MATCH a déjà été recalculé sur cette réponse ; corrigez-la pour poursuivre.' : 'MATCH recalculé après cette réponse. Le profil candidat est enrichi. Question suivante du cycle.')
    } catch (err) { setError(err.message); setStatus('') }
  }

  async function chooseContinuation(decision) {
    if (!analysis) return
    setError(''); setStatus(decision === 'continue_enrichment' ? 'Nouveau cycle de 5 questions…' : 'Arrêt du PROBE. Passage vers CV puis Render…')
    try {
      const result = await callProbe({ canonical_candidate_data_state: analysis.candidate, canonical_job_data_state: analysis.job, canonical_probe_plan: analysis.probePlan, previous_match_state: analysis.match, responses: [{ control: decision }], cycle_number: cycleNumber })
      setAnalysis((current) => ({ ...current, candidate: result.canonical_candidate_data_state, match: result.canonical_match_state, probePlan: result.canonical_probe_plan }))
      if (decision === 'continue_enrichment') { setCycleNumber((value) => value + 1); setQuestionIndex(0); setAnswer(''); setSkipped(false); setStatus('Nouveau cycle prêt : jusqu’à 5 questions. Chaque réponse repassera immédiatement par le MATCH.') } else setStatus('Enrichissement arrêté. Handoff : CV ENGINE → RENDER ENGINE.')
    } catch (err) { setError(err.message); setStatus('') }
  }

  const score = scoreOf(analysis?.match)
  const questions = questionsOf(analysis?.probePlan)
  const currentQuestion = questions[questionIndex]
  const probeStatus = analysis?.probePlan?.loop_closure?.status || analysis?.probePlan?.probe_result?.loop_status
  const decision = analysis?.probePlan?.loop_closure?.decision || analysis?.probePlan?.probe_result?.adaptive_decision
  const cycle = analysis?.probePlan?.probe_result?.enrichment_cycle
  const cycleFinished = probeStatus === 'awaiting_continuation' && !currentQuestion
  const applicationReady = probeStatus === 'complete' && decision === 'stop_enrichment'

  return (
    <main style={{ maxWidth: 780, margin: '0 auto', padding: '44px 24px 80px', fontFamily: 'Arial, sans-serif' }}>
      <div style={{ fontWeight: 900, fontSize: 22, marginBottom: 32 }}>TalentBusterZ V3</div>
      <section style={styles.card}>
        <h1 style={{ marginTop: 0 }}>Votre profil candidat d’abord</h1>
        <p style={{ opacity: .72 }}>Le profil est la mémoire durable. Une offre sert à contextualiser le MATCH, pas à définir votre profil.</p>
        <p><strong>{firstNameOf()}</strong> — profil candidat canonique chargé.</p>
        <form onSubmit={handleJobSubmit} style={{ display: 'flex', gap: 10, marginTop: 18 }}><input required type="url" value={jobUrl} onChange={(event) => setJobUrl(event.target.value)} placeholder="Lien de l’offre à comparer" style={{ flex: 1, padding: 14, borderRadius: 10, border: '1px solid #cbd5e1', fontSize: 16 }} /><button type="submit" style={{ ...styles.button, ...styles.primary }}>Analyser</button></form>
      </section>
      {status && <p style={{ marginTop: 18, fontWeight: 700 }}>{status}</p>}
      {error && <p style={{ color: '#b42318', fontWeight: 700 }}>{error}</p>}
      {analysis && <>
        <section style={{ ...styles.card, marginTop: 24 }}><div style={{ fontSize: 14, opacity: .6 }}>MATCH — offre courante</div><h2 style={{ marginBottom: 8 }}>{analysis.job?.job_data_state?.job_identity?.title || 'Offre analysée'}</h2>{score !== null && <div style={{ fontSize: 38, fontWeight: 900 }}>{score}%</div>}{scoreDelta !== null && <div style={{ fontWeight: 800 }}>Après la dernière réponse : {scoreDelta >= 0 ? '+' : ''}{scoreDelta} point{Math.abs(scoreDelta) > 1 ? 's' : ''}</div>}{cycle?.estimated_potential_score_gain > 0 && cycleFinished && <div style={{ marginTop: 16, padding: 16, borderRadius: 12, background: '#eff6ff', color: '#1d4ed8', fontWeight: 800 }}>Enrichir davantage le profil : gain potentiel estimé jusqu’à +{cycle.estimated_potential_score_gain} points sur le MATCH actuel.</div>}</section>

        {currentQuestion && <form onSubmit={submitAnswer} style={{ marginTop: 24 }}><section style={styles.card}><h2 style={{ marginTop: 0 }}>{probeStatus === 'needs_clarification' ? 'Clarification' : `Cycle ${cycleNumber}`} — question {questionIndex + 1}/5</h2><p style={{ opacity: .7 }}>Une seule réponse à la fois : chaque réponse enrichit le profil puis déclenche immédiatement un nouveau MATCH.</p><div style={{ marginTop: 18, padding: 20, border: '1px solid #d9e1ee', borderRadius: 14 }}><label style={{ display: 'block', fontWeight: 800, marginBottom: 12 }}>{currentQuestion.question}</label><textarea rows="5" disabled={skipped} value={answer} onChange={(event) => setAnswer(event.target.value)} placeholder="Votre réponse…" style={{ width: '100%', boxSizing: 'border-box', padding: 12, borderRadius: 8, border: '1px solid #cbd5e1' }} /><div style={{ display: 'flex', gap: 10, marginTop: 12 }}><button type="button" onClick={() => setSkipped((value) => !value)} style={{ ...styles.button, background: '#f1f5f9' }}>{skipped ? 'Question passée — cliquer pour répondre' : 'Passer cette question'}</button><button type="submit" style={{ ...styles.button, ...styles.primary, flex: 1 }}>{skipped ? 'Passer et recalculer le MATCH' : 'Répondre et recalculer le MATCH'}</button></div></div></section></form>}

        {cycleFinished && <section style={{ ...styles.card, marginTop: 24 }}><h2 style={{ marginTop: 0 }}>Cycle {cycleNumber} terminé</h2><p>Les réponses de ce cycle sont intégrées au <strong>profil candidat persistant</strong>. Le MATCH a été recalculé après chaque réponse.</p><p><strong>Oui</strong> : nouveau cycle de 5 questions. <strong>Non</strong> : stop PROBE → CV → Render.</p><div style={{ display: 'flex', gap: 10 }}><button type="button" onClick={() => chooseContinuation('continue_enrichment')} style={{ ...styles.button, ...styles.primary, flex: 1 }}>Oui, continuer</button><button type="button" onClick={() => chooseContinuation('stop_enrichment')} style={{ ...styles.button, background: '#f1f5f9', flex: 1 }}>Non, passer au CV</button></div></section>}
        {applicationReady && <section style={{ ...styles.card, marginTop: 24 }}><h2 style={{ marginTop: 0 }}>PROBE terminé</h2><div style={{ padding: 16, borderRadius: 12, background: '#ecfdf3', color: '#166534', fontWeight: 800 }}>Handoff : <strong>CV ENGINE</strong> → <strong>RENDER ENGINE</strong>.</div></section>}
      </>}
    </main>
  )
}
