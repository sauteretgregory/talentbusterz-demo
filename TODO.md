# TalentBusterZ — TODO

## CANDIDATE_DATA_ENGINE — English evidence reingestion

Status: completed in `feature/candidate-english-evidence`
Owner: CANDIDATE_DATA_ENGINE
Consumer: MATCH / PROBE

Candidate-provided evidence now reingests into canonical `candidate_data_state` with provenance and interpretation boundaries preserved:

- English oral exam during BTS: candidate reports a score of 20/20.
- Approximately two years lived/worked in Australia.
- Satellite subscription sales conducted in English in Australia.
- Recruitment activity conducted in English with candidates/stakeholders involving Vietnam, Canada, India and Pakistan.

Current MATCH boundary:

- Statements are not injected directly into MATCH.
- Statements are not converted automatically into a CEFR level inside MATCH.
- CANDIDATE_DATA_ENGINE preserves the response as `direct_user_statement` evidence and records detected English-exposure signals.
- An explicitly candidate-declared CEFR level may remain canonical when the candidate states it directly.
- MATCH may reevaluate language evidence from the resulting canonical state.
- PROBE may request clarification if the canonical state still contains unresolved language evidence.
