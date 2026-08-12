import React from 'react'

import candidate from './fixtures/doctrine/candidate.json'
import job from './fixtures/doctrine/job.json'
import match from './fixtures/doctrine/match.json'
import probePlan from './fixtures/doctrine/probe-plan.json'

const artifacts = [
  ['Candidat', candidate],
  ['Offre', job],
  ['Match', match],
  ['Probe', probePlan]
]

export default function V3Preview() {
  const candidateUnknowns =
    match?.match_state?.candidate_unknowns?.length ?? 0

  const jobUnknowns =
    match?.match_state?.job_unknowns?.length ?? 0

  const compatibility =
    match?.match_state?.professional_compatibility

  return (
    <main style={{
      maxWidth: 1000,
      margin: '40px auto',
      padding: 24,
      fontFamily: 'Arial, sans-serif'
    }}>
      <p style={{ fontWeight: 700 }}>TalentBusterZ V3 — integration preview</p>

      <h1>Chaîne canonique réelle</h1>

      <p>
        Cette vue lit directement les artifacts produits par les engines.
        Aucun matching n'est recalculé dans React.
      </p>

      <section style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: 16,
        marginTop: 30
      }}>
        {artifacts.map(([label, artifact]) => (
          <article
            key={label}
            style={{
              border: '1px solid #ddd',
              borderRadius: 12,
              padding: 18
            }}
          >
            <strong>{label}</strong>
            <p>{artifact.artifact_type}</p>
            <small>{artifact.state_version}</small>
            <p style={{ wordBreak: 'break-word' }}>
              {artifact.artifact_id || artifact.match_id || artifact.probe_id}
            </p>
          </article>
        ))}
      </section>

      <section style={{
        marginTop: 28,
        border: '1px solid #ddd',
        borderRadius: 12,
        padding: 20
      }}>
        <h2>Lecture du MATCH ENGINE</h2>

        <p>
          Confiance professionnelle :
          {' '}
          <strong>
            {compatibility?.confidence != null
              ? `${Math.round(compatibility.confidence * 100)} %`
              : 'non exposée'}
          </strong>
        </p>

        <p>
          Informations candidat à clarifier :
          {' '}
          <strong>{candidateUnknowns}</strong>
        </p>

        <p>
          Informations employeur inconnues :
          {' '}
          <strong>{jobUnknowns}</strong>
        </p>
      </section>
    </main>
  )
}
