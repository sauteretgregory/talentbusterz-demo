import React, { useEffect, useMemo, useState } from 'react'
import candidate from './fixtures/doctrine/candidate.json'
import { createJobIntakeRequest } from './jobIntake.js'
import { resolveInitialCandidateState } from './candidateMemoryClient.js'

const styles = {
  page: { maxWidth: 900, margin: '0 auto', padding: '44px 24px 80px', fontFamily: 'Arial, sans-serif', color: '#172033' },
  card: { border: '1px solid #d9e1ee', borderRadius: 18, padding: 28, background: '#fff', boxShadow: '0 8px 30px rgba(20, 35, 60, .05)' },
  button: { padding: '14px 18px', border: 0, borderRadius: 10, fontWeight: 800, cursor: 'pointer' },
  primary: { background: '#0b57d0', color: '#fff' },
  secondary: { background: '#f1f5f9', color: '#172033' }
}

function scoreOf(match) {
  const score = match?.match_state?.professional_compatibility?.professional_match_score
  return typeof score === 'number' ? Math.round(score) : null
}

function questionsOf(plan) {
  return [...(plan?.probe_plan?.critical_questions || []), ...(plan?.probe_plan?.secondary_questions || [])]
    .filter((q) => q?.question_id && q?.question)
    .slice(0, 5)
}

function candidateIdOf(state) {
  return state?.candidate_data_state?.candidate_id || candidate?.candidate_data_state?.candidate_id || null
}

function firstNameOf(state) {
  return state?.candidate_data_state?.identity_state?.full_name?.value?.split(' ')?.[0]
    || candidate?.candidate_data_state?.identity_state?.full_name?.value?.split(' ')?.[0]
    || 'candidat'
}

function candidateEvidenceCount(state) {
  const evidence = state?.candidate_data_state?.evidence_state
  if (!evidence || typeof evidence !== 'object') return null
  return Object.keys(evidence).length
}

function titleOf(job) {
  return job?.job_data_state?.job_identity?.title || 'Offre analysée'
}

export default function V3Preview() {
  const [jobUrl, setJobUrl] = useState('')
  const [analysis, setAnalysis] = useState(null)
  const [candidateState, setCandidateState] = useState(candidate)
  const [candidateLoaded, setCandidateLoaded] = useState(false)
  const [answer, setAnswer] = useState('')
  const [skipped, setSkipped] = useState(false)
  const [questionIndex, setQuestionIndex] = useState(0)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [scoreDelta, setScoreDelta] = useState(null)
  const [cycleNumber, setCycleNumber] = useState(1)
  const [offerHistory, setOfferHistory] = useState([])

  const candidateId = candidateIdOf(candidateState)
  const candidateName = firstNameOf(candidateState)

  // Rehydrate the persistent candidate profile on mount (e.g. after a page
  // reload) instead of silently starting over from the bundled fixture.
  useEffect(() => {
    let cancelled = false

    async function rehydrate() {
      const result = await resolveInitialCandidateState({
        candidateId: candidateIdOf(candidate),
        fallbackCandidate: candidate
      })

      if (cancelled) return

      setCandidateState(result.candidateState)
      setCandidateLoaded(result.candidateLoaded)

      if (result.rehydratedOnMount) {
        setStatus('Mémoire candidat persistante retrouvée automatiquement au chargement de la page.')
      }
    }

    rehydrate()

    return () => {
      cancelled = true
    }
  }, [])

  async function callProbe(body) {
    const response = await fetch('http://localhost:8787/api/probe-responses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })
    const result = await response.json()
    if (!response.ok || result.status !== 'completed') {
      throw new Error(result.error || 'Échec du cycle d’enrichissement.')
    }
    return result
  }

  async function handleJobSubmit(event) {
    event.preventDefault()
    setError('')
    setStatus(candidateLoaded
      ? 'Chargement de la mémoire candidat persistante puis analyse de la nouvelle offre…'
      : 'Initialisation de la mémoire candidat puis analyse de la première offre…')

    try {
      const request = createJobIntakeRequest(jobUrl)
      const body = { url: request.source_url }

      if (candidateLoaded && candidateId) {
        body.candidate_id = candidateId
      } else {
        body.candidate = candidate
      }

      const response = await fetch('http://localhost:8787/api/job-intake', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
      const result = await response.json()
      if (!response.ok || result.status !== 'completed') {
        throw new Error(result.error || 'Échec de l’analyse de l’offre.')
      }

      const nextCandidate = result.canonical_candidate_data_state
      const nextMatch = result.canonical_match_state
      const nextProbe = result.canonical_probe_plan

      setCandidateState(nextCandidate)
      setCandidateLoaded(true)
      setAnalysis({
        candidate: nextCandidate,
        job: result.canonical_job_data_state,
        match: nextMatch,
        probePlan: nextProbe,
        readiness: result.canonical_application_readiness_state,
        memorySource: result.candidate_memory_source
      })
      setOfferHistory((current) => [
        {
          title: titleOf(result.canonical_job_data_state),
          score: scoreOf(nextMatch),
          memorySource: result.candidate_memory_source,
          offerUrl: request.source_url,
          analyzedAt: new Date().toISOString()
        },
        ...current.filter((item) => item.offerUrl !== request.source_url)
      ])
      setScoreDelta(null)
      setCycleNumber(1)
      setQuestionIndex(0)
      setAnswer('')
      setSkipped(false)
      setJobUrl('')
      setStatus(result.candidate_memory_source === 'persistent_memory'
        ? 'Mémoire candidat retrouvée. MATCH recalculé sur la nouvelle offre avec le profil enrichi.'
        : 'Profil candidat initialisé. MATCH établi. Nous allons maintenant enrichir le profil, une réponse à la fois.')
    } catch (err) {
      setError(err.message)
      setStatus('')
    }
  }

  async function submitAnswer(event) {
    event.preventDefault()
    if (!analysis) return

    const questions = questionsOf(analysis.probePlan)
    const question = questions[questionIndex]
    if (!question) return
    if (!skipped && !answer.trim()) {
      setError('Répondez à la question ou passez-la.')
      return
    }

    setError('')
    setStatus('Réponse enregistrée : enrichissement du profil puis recalcul immédiat du MATCH…')
    try {
      const result = await callProbe({
        canonical_candidate_data_state: analysis.candidate,
        canonical_job_data_state: analysis.job,
        canonical_probe_plan: analysis.probePlan,
        previous_match_state: analysis.match,
        responses: [{
          question_id: question.question_id,
          ...(skipped ? { skipped: true } : { answer: answer.trim() })
        }],
        cycle_number: cycleNumber
      })

      setCandidateState(result.canonical_candidate_data_state)
      setAnalysis((current) => ({
        ...current,
        candidate: result.canonical_candidate_data_state,
        match: result.canonical_match_state,
        probePlan: result.canonical_probe_plan,
        readiness: result.canonical_application_readiness_state,
        memorySource: 'persistent_memory'
      }))
      setScoreDelta(typeof result.score_delta === 'number' ? result.score_delta : null)
      setAnswer('')
      setSkipped(false)
      setQuestionIndex(0)
      setStatus(result.probe_cycle_status === 'needs_clarification'
        ? 'Réponse à clarifier. Le MATCH a déjà été recalculé sur cette réponse ; corrigez-la pour poursuivre.'
        : 'MATCH recalculé après cette réponse. Le profil candidat est enrichi et sauvegardé. Question suivante du cycle.')
    } catch (err) {
      setError(err.message)
      setStatus('')
    }
  }

  async function chooseContinuation(decision) {
    if (!analysis) return

    setError('')
    setStatus(decision === 'continue_enrichment'
      ? 'Nouveau cycle de 5 questions…'
      : 'Arrêt du PROBE pour cette offre. Le profil candidat reste enrichi pour les prochaines candidatures…')

    try {
      const result = await callProbe({
        canonical_candidate_data_state: analysis.candidate,
        canonical_job_data_state: analysis.job,
        canonical_probe_plan: analysis.probePlan,
        previous_match_state: analysis.match,
        responses: [{ control: decision }],
        cycle_number: cycleNumber
      })

      setCandidateState(result.canonical_candidate_data_state)
      setAnalysis((current) => ({
        ...current,
        candidate: result.canonical_candidate_data_state,
        match: result.canonical_match_state,
        probePlan: result.canonical_probe_plan,
        readiness: result.canonical_application_readiness_state,
        memorySource: 'persistent_memory'
      }))

      if (decision === 'continue_enrichment') {
        setCycleNumber((value) => value + 1)
        setQuestionIndex(0)
        setAnswer('')
        setSkipped(false)
        setStatus('Nouveau cycle prêt : jusqu’à 5 questions. Les réponses enrichissent le profil global, puis repassent par le MATCH de cette offre.')
      } else {
        setStatus('Enrichissement arrêté pour cette offre. Le profil candidat persistant reste disponible pour la prochaine candidature.')
      }
    } catch (err) {
      setError(err.message)
      setStatus('')
    }
  }

  const score = scoreOf(analysis?.match)
  const questions = questionsOf(analysis?.probePlan)
  const currentQuestion = questions[questionIndex]
  const probeStatus = analysis?.probePlan?.loop_closure?.status || analysis?.probePlan?.probe_result?.loop_status
  const decision = analysis?.probePlan?.loop_closure?.decision || analysis?.probePlan?.probe_result?.adaptive_decision
  const cycle = analysis?.probePlan?.probe_result?.enrichment_cycle
  const cycleFinished = probeStatus === 'awaiting_continuation' && !currentQuestion
  const applicationReady = probeStatus === 'complete' && decision === 'stop_enrichment'
  const evidenceCount = candidateEvidenceCount(candidateState)

  const memoryMessage = useMemo(() => {
    if (!candidateLoaded) return 'Mémoire initiale prête à être chargée lors de la première offre.'
    if (analysis?.memorySource === 'persistent_memory') return 'Profil global récupéré depuis la mémoire persistante.'
    return 'Profil candidat canonique actif.'
  }, [analysis?.memorySource, candidateLoaded])

  return (
    <main style={styles.page}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 20, alignItems: 'center', marginBottom: 32 }}>
        <div>
          <div style={{ fontWeight: 900, fontSize: 22 }}>TalentBusterZ V3</div>
          <div style={{ opacity: .65, marginTop: 4 }}>Persistent Candidate Memory</div>
        </div>
        <div style={{ padding: '8px 12px', borderRadius: 999, background: '#ecfdf3', color: '#166534', fontWeight: 800 }}>Profil-first</div>
      </div>

      <section style={styles.card}>
        <h1 style={{ marginTop: 0 }}>Votre profil candidat d’abord</h1>
        <p style={{ opacity: .72 }}>
          Le profil est la mémoire durable. Chaque offre crée son propre contexte MATCH / PROBE ; les réponses utiles enrichissent le profil candidat pour les candidatures suivantes.
        </p>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 18 }}>
          <div style={{ padding: 14, borderRadius: 12, background: '#f8fafc' }}><strong>{candidateName}</strong><br /><span style={{ opacity: .65 }}>candidate_id : {candidateId || 'non défini'}</span></div>
          <div style={{ padding: 14, borderRadius: 12, background: '#f8fafc' }}><strong>Mémoire candidat</strong><br /><span style={{ opacity: .65 }}>{memoryMessage}</span></div>
          {evidenceCount !== null && <div style={{ padding: 14, borderRadius: 12, background: '#f8fafc' }}><strong>{evidenceCount}</strong><br /><span style={{ opacity: .65 }}>éléments d’évidence</span></div>}
        </div>

        <form onSubmit={handleJobSubmit} style={{ display: 'flex', gap: 10, marginTop: 22 }}>
          <input required type="url" value={jobUrl} onChange={(event) => setJobUrl(event.target.value)} placeholder="Lien de la nouvelle offre à comparer" style={{ flex: 1, padding: 14, borderRadius: 10, border: '1px solid #cbd5e1', fontSize: 16 }} />
          <button type="submit" style={{ ...styles.button, ...styles.primary }}>{candidateLoaded ? 'Analyser une nouvelle offre' : 'Charger le profil et analyser'}</button>
        </form>
      </section>

      {status && <p style={{ marginTop: 18, fontWeight: 700 }}>{status}</p>}
      {error && <p style={{ color: '#b42318', fontWeight: 700 }}>{error}</p>}

      {offerHistory.length > 0 && (
        <section style={{ ...styles.card, marginTop: 24 }}>
          <div style={{ fontSize: 14, opacity: .6 }}>HISTORIQUE DES CANDIDATURES</div>
          <h2 style={{ margin: '6px 0 16px' }}>Le profil apprend d’une offre à l’autre</h2>
          <div style={{ display: 'grid', gap: 10 }}>
            {offerHistory.map((item) => (
              <div key={`${item.offerUrl}-${item.analyzedAt}`} style={{ display: 'flex', justifyContent: 'space-between', gap: 16, padding: 14, border: '1px solid #e2e8f0', borderRadius: 12 }}>
                <div><strong>{item.title}</strong><div style={{ fontSize: 13, opacity: .6 }}>{item.memorySource === 'persistent_memory' ? 'mémoire persistante' : 'profil initial'} · {new Date(item.analyzedAt).toLocaleString('fr-FR')}</div></div>
                <strong>{item.score === null ? '—' : `${item.score}%`}</strong>
              </div>
            ))}
          </div>
        </section>
      )}

      {analysis && <>
        <section style={{ ...styles.card, marginTop: 24 }}>
          <div style={{ fontSize: 14, opacity: .6 }}>MATCH — OFFRE COURANTE</div>
          <h2 style={{ marginBottom: 8 }}>{titleOf(analysis.job)}</h2>
          {score !== null && <div style={{ fontSize: 38, fontWeight: 900 }}>{score}%</div>}
          {scoreDelta !== null && <div style={{ fontWeight: 800 }}>Après la dernière réponse : {scoreDelta >= 0 ? '+' : ''}{scoreDelta} point{Math.abs(scoreDelta) > 1 ? 's' : ''}</div>}
          {analysis.memorySource === 'persistent_memory' && <div style={{ marginTop: 12, color: '#166534', fontWeight: 800 }}>Ce MATCH utilise le profil candidat enrichi par les candidatures précédentes.</div>}
          {cycle?.estimated_potential_score_gain > 0 && cycleFinished && <div style={{ marginTop: 16, padding: 16, borderRadius: 12, background: '#eff6ff', color: '#1d4ed8', fontWeight: 800 }}>Enrichir davantage le profil : gain potentiel estimé jusqu’à +{cycle.estimated_potential_score_gain} points sur le MATCH actuel.</div>}
        </section>

        {currentQuestion && <form onSubmit={submitAnswer} style={{ marginTop: 24 }}><section style={styles.card}><h2 style={{ marginTop: 0 }}>{probeStatus === 'needs_clarification' ? 'Clarification' : `Cycle ${cycleNumber}`} — question {questionIndex + 1}/5</h2><p style={{ opacity: .7 }}>Une seule réponse à la fois : chaque réponse enrichit le profil global puis déclenche immédiatement un nouveau MATCH pour cette offre.</p><div style={{ marginTop: 18, padding: 20, border: '1px solid #d9e1ee', borderRadius: 14 }}><label style={{ display: 'block', fontWeight: 800, marginBottom: 12 }}>{currentQuestion.question}</label><textarea rows="5" disabled={skipped} value={answer} onChange={(event) => setAnswer(event.target.value)} placeholder="Votre réponse…" style={{ width: '100%', boxSizing: 'border-box', padding: 12, borderRadius: 8, border: '1px solid #cbd5e1' }} /><div style={{ display: 'flex', gap: 10, marginTop: 12 }}><button type="button" onClick={() => setSkipped((value) => !value)} style={{ ...styles.button, ...styles.secondary }}>{skipped ? 'Question passée — cliquer pour répondre' : 'Passer cette question'}</button><button type="submit" style={{ ...styles.button, ...styles.primary, flex: 1 }}>{skipped ? 'Passer et recalculer le MATCH' : 'Répondre et recalculer le MATCH'}</button></div></div></section></form>}

        {cycleFinished && <section style={{ ...styles.card, marginTop: 24 }}><h2 style={{ marginTop: 0 }}>Cycle {cycleNumber} terminé</h2><p>Les réponses de ce cycle sont intégrées au <strong>profil candidat persistant</strong>. Le MATCH a été recalculé après chaque réponse, mais ce cycle reste rattaché à l’offre courante.</p><p><strong>Oui</strong> : nouveau cycle de 5 questions. <strong>Non</strong> : terminer le PROBE de cette offre.</p><div style={{ display: 'flex', gap: 10 }}><button type="button" onClick={() => chooseContinuation('continue_enrichment')} style={{ ...styles.button, ...styles.primary, flex: 1 }}>Oui, continuer</button><button type="button" onClick={() => chooseContinuation('stop_enrichment')} style={{ ...styles.button, ...styles.secondary, flex: 1 }}>Non, terminer cette offre</button></div></section>}
        {applicationReady && <section style={{ ...styles.card, marginTop: 24 }}><h2 style={{ marginTop: 0 }}>PROBE terminé pour cette offre</h2><div style={{ padding: 16, borderRadius: 12, background: '#ecfdf3', color: '#166534', fontWeight: 800 }}>Le contexte de cette candidature est terminé. Le profil candidat persistant reste disponible pour la prochaine offre.</div></section>}
      </>}
    </main>
  )
}
