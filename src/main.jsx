import React, { useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import {
  AlertTriangle,
  Bot,
  Database,
  Download,
  FileText,
  Fish,
  RefreshCcw,
  ShieldCheck,
  Sparkles,
  Upload
} from 'lucide-react'
import JSZip from 'jszip'
import './styles.css'

const initialOffer = `Employé rayon poissonnerie — Intermarché

Missions :
- Préparer et mettre en valeur les produits de la mer.
- Participer à la découpe, au conditionnement et à la mise en rayon.
- Respecter les règles d’hygiène, de fraîcheur et de chaîne du froid.
- Conseiller les clients sur les produits.

Profil :
- Une première expérience en poissonnerie ou produits frais est appréciée.
- Débutants acceptés si motivation réelle et capacité à apprendre.
- Rigueur, sens du service et respect des règles d’hygiène attendus.`

const initialMemory = `Mémoire candidat locale :
- Expérience principale : recrutement / relation client / coordination.
- Australie : travail sur bateau de pêche, usine de transformation, découpe de poisson, conditions difficiles.
- Expériences diverses : adaptation, travail terrain, horaires atypiques, environnement physique exigeant.
- Cette expérience n’est pas visible dans le CV classique.`

const scenarios = {
  fish: {
    conversation_id: 'CONV-DEMO-INTERMARCHE-001',
    offer_id: 'OFF-INTERMARCHE-2026-001',
    requirement_id: 'REQ-INTERMARCHE-001',
    signalTitle: 'Australie — pêche / découpe / usine / bateau',
    signalIcon: 'fish',
    triggerType: 'dormant_experience',
    hypothesisText:
      'L’expérience autour de la pêche et de la découpe de poisson pourrait être reliée à la préparation, aux produits de la mer et aux contraintes d’hygiène.',
    questions: [
      {
        question_id: 'Q1',
        question_type: 'yes_no',
        question_text:
          'Avez-vous déjà travaillé dans un environnement lié à la pêche, au poisson ou aux produits de la mer ?',
        candidate_answer: ''
      },
      {
        question_id: 'Q2',
        question_type: 'yes_no',
        question_text:
          'Avez-vous déjà découpé, préparé ou conditionné du poisson ?',
        candidate_answer: ''
      },
      {
        question_id: 'Q3',
        question_type: 'context',
        question_text:
          'Dans quel contexte : bateau, usine, cuisine, rayon, transformation, autre ?',
        candidate_answer: ''
      },
      {
        question_id: 'Q4',
        question_type: 'evidence_detail',
        question_text: 'Quelles tâches faisiez-vous concrètement ?',
        candidate_answer: ''
      }
    ]
  },

  talent: {
    conversation_id: 'CONV-DEMO-TALENT-001',
    offer_id: 'OFF-TALENT-2026-001',
    requirement_id: 'REQ-TALENT-001',
    signalTitle: 'Recrutement — leadership / process / international',
    signalIcon: 'talent',
    triggerType: 'missing_information',
    hypothesisText:
      'L’expérience en recrutement, coordination, relation client ou structuration de process pourrait être reliée à un rôle de Talent Acquisition Lead.',
    questions: [
      {
        question_id: 'Q1',
        question_type: 'yes_no',
        question_text:
          'Avez-vous déjà recruté dans des environnements compétitifs, exigeants ou en forte croissance ?',
        candidate_answer: ''
      },
      {
        question_id: 'Q2',
        question_type: 'context',
        question_text:
          'Quels types de profils avez-vous recrutés : tech, business, sales, produit, support, autre ?',
        candidate_answer: ''
      },
      {
        question_id: 'Q3',
        question_type: 'evidence_detail',
        question_text:
          'Avez-vous déjà structuré, amélioré ou harmonisé un processus de recrutement ? Donnez un exemple concret.',
        candidate_answer: ''
      },
      {
        question_id: 'Q4',
        question_type: 'evidence_detail',
        question_text:
          'Avez-vous déjà accompagné, formé ou mentoré d’autres recruteurs ?',
        candidate_answer: ''
      },
      {
        question_id: 'Q5',
        question_type: 'context',
        question_text:
          'Quels outils avez-vous utilisés : ATS, LinkedIn Recruiter, Ashby, Modernloop, reporting, dashboards ?',
        candidate_answer: ''
      }
    ]
  },

  generic: {
    conversation_id: 'CONV-DEMO-GENERIC-001',
    offer_id: 'OFF-GENERIC-2026-001',
    requirement_id: 'REQ-GENERIC-001',
    signalTitle: 'Piste à vérifier — expérience non visible dans le CV',
    signalIcon: 'generic',
    triggerType: 'missing_information',
    hypothesisText:
      'Une expérience non visible dans le CV pourrait être reliée à cette offre. Cette piste doit être vérifiée par des réponses factuelles.',
    questions: [
      {
        question_id: 'Q1',
        question_type: 'yes_no',
        question_text:
          'Avez-vous déjà exercé une expérience proche de cette offre, même brièvement ?',
        candidate_answer: ''
      },
      {
        question_id: 'Q2',
        question_type: 'context',
        question_text:
          'Dans quel contexte avez-vous acquis cette expérience ?',
        candidate_answer: ''
      },
      {
        question_id: 'Q3',
        question_type: 'evidence_detail',
        question_text: 'Quelles tâches concrètes faisiez-vous ?',
        candidate_answer: ''
      },
      {
        question_id: 'Q4',
        question_type: 'evidence_detail',
        question_text:
          'Qu’est-ce que vous pourriez défendre honnêtement en entretien ?',
        candidate_answer: ''
      }
    ]
  }
}

function detectScenario(offerText) {
  const text = (offerText || '').toLowerCase()

  const talentWords = [
    'talent acquisition',
    'recruiting',
    'recruitment',
    'hiring',
    'recruiter',
    'recruteur',
    'recrutement',
    'candidate experience',
    'ats',
    'linkedin recruiter',
    'ashby',
    'modernloop'
  ]

  const fishWords = [
    'poisson',
    'poissonnerie',
    'produits de la mer',
    'pêche',
    'peche',
    'filet',
    'frais',
    'chaîne du froid',
    'chaine du froid'
  ]

  if (talentWords.some((word) => text.includes(word))) return 'talent'
  if (fishWords.some((word) => text.includes(word))) return 'fish'
  return 'generic'
}

function evidenceValue(answer) {
  const a = (answer || '').toLowerCase().trim()

  if (!a) return 'none'
  if (['non', 'no', 'n', 'jamais'].includes(a)) return 'none'
  if (['oui', 'yes', 'y'].includes(a)) return 'medium'

  const strongTerms = [
    'bateau',
    'usine',
    'découpe',
    'decoupe',
    'filet',
    'emballage',
    'conditionnement',
    'contrôle',
    'controle',
    'qualité',
    'qualite',
    'hygiène',
    'hygiene',
    'chaîne du froid',
    'chaine du froid',
    'ats',
    'linkedin recruiter',
    'ashby',
    'modernloop',
    'bullhorn',
    'recrutement',
    'sourcing',
    'process',
    'reporting',
    'dashboard',
    'international',
    'tech',
    'développeur',
    'developpeur',
    'hiring manager',
    'candidate experience',
    'coordination',
    'leadership',
    'mentor',
    'formation'
  ]

  const hits = strongTerms.filter((term) => a.includes(term)).length

  if (hits >= 2 || a.length > 90) return 'strong'
  if (hits === 1 || a.length > 30) return 'medium'
  return 'weak'
}

function aggregate(questions, hypothesis) {
  const values = questions.map((q) => evidenceValue(q.candidate_answer))
  const strong = values.filter((v) => v === 'strong').length
  const mediumPlus = values.filter((v) => v === 'medium' || v === 'strong').length
  const none = values.filter((v) => v === 'none').length

  if (questions.length > 0 && none >= Math.ceil(questions.length / 2)) {
    return [
      'non_concluant',
      'do_not_use',
      'do_not_use',
      'Plusieurs réponses factuelles sont absentes ou négatives : ne pas utiliser cette piste.'
    ]
  }

  if (hypothesis === false) {
    return [
      'faible',
      'raw_only',
      'raw_only',
      'Le candidat ne valide pas le lien : conserver cette information en mémoire locale seulement.'
    ]
  }

  if (mediumPlus >= 3 && strong >= 2 && hypothesis === true) {
    return [
      'forte',
      'cv_argument',
      'eligible_cv_argument',
      'Réponses factuelles fortes et hypothèse validée : piste intégrable comme argument de CV ciblé.'
    ]
  }

  if (mediumPlus >= 2 && hypothesis !== false) {
    return [
      'moyenne',
      'interview_argument',
      'eligible_interview_argument',
      'Piste défendable en entretien, mais pas assez solide pour être automatiquement intégrée au CV.'
    ]
  }

  return [
    'faible',
    'needs_human_review',
    'needs_human_review',
    'Réponses insuffisantes ou hétérogènes : validation humaine recommandée.'
  ]
}

function cvText(decision, scenario) {
  if (scenario === 'talent') {
    if (decision === 'cv_argument') {
      return 'Expérience en recrutement et coordination de processus talent : contribution à la structuration des recrutements, relation avec les parties prenantes et amélioration de l’expérience candidat.'
    }

    if (decision === 'interview_argument') {
      return 'Argument entretien à préparer : expérience en recrutement, coordination et relation client pouvant être reliée à un rôle Talent Acquisition selon les exemples factuels fournis.'
    }
  }

  if (scenario === 'fish') {
    if (decision === 'cv_argument') {
      return 'Expérience terrain en environnement produits de la mer : participation à des activités de pêche, découpe, transformation et conditionnement du poisson, avec exposition aux contraintes d’hygiène, de qualité et de rythme opérationnel.'
    }

    if (decision === 'interview_argument') {
      return 'Argument entretien à préparer : expérience terrain autour de la pêche / transformation du poisson, à relier prudemment aux produits frais et aux gestes de préparation.'
    }
  }

  if (decision === 'raw_only') {
    return 'À conserver dans la mémoire candidat locale : information utile pour comprendre le parcours, non utilisée dans le CV à ce stade.'
  }

  if (decision === 'do_not_use') {
    return 'Ne pas utiliser cette piste : expérience non confirmée ou non défendable pour l’offre visée.'
  }

  if (decision === 'needs_human_review') {
    return 'À revoir : éléments insuffisants pour décider si cette expérience doit aller dans le CV, rester en argument d’entretien ou être conservée en mémoire locale.'
  }

  return 'Argument potentiel à formuler après validation des réponses factuelles.'
}

function decisionLabel(decision) {
  const labels = {
    cv_argument: 'À intégrer au CV ciblé',
    interview_argument: 'À préparer pour l’entretien',
    raw_only: 'À garder en mémoire locale',
    do_not_use: 'Ne pas utiliser cette piste',
    needs_human_review: 'À vérifier'
  }

  return labels[decision] || decision
}

function questionTypeLabel(type) {
  const labels = {
    yes_no: 'Oui / Non',
    context: 'Contexte',
    evidence_detail: 'Détail concret'
  }

  return labels[type] || type
}

function evidenceLabel(value) {
  const labels = {
    none: 'aucun indice',
    weak: 'indice faible',
    medium: 'indice moyen',
    strong: 'indice fort'
  }

  return labels[value] || value
}

function Badge({ children, type = 'neutral' }) {
  return <span className={`badge ${type}`}>{children}</span>
}

function Card({ title, icon, children }) {
  return (
    <section className="card">
      <h2>
        {icon}
        {title}
      </h2>
      {children}
    </section>
  )
}

function App() {
  const [offer, setOffer] = useState(initialOffer)
  const [candidateMemory, setCandidateMemory] = useState(initialMemory)
  const [cvFileName, setCvFileName] = useState('')
  const [memoryFileName, setMemoryFileName] = useState('')
  const [analysisStatus, setAnalysisStatus] = useState('empty')
  const [activeScenario, setActiveScenario] = useState('fish')
  const [questions, setQuestions] = useState(scenarios.fish.questions)
  const [rating, setRating] = useState(5)
  const [hypothesis, setHypothesis] = useState(null)

  const [conviction, decision, result, explanation] = useMemo(
    () => aggregate(questions, hypothesis),
    [questions, hypothesis]
  )

  const active = scenarios[activeScenario] || scenarios.generic

  const flow = {
    conversation_id: active.conversation_id,
    candidate_id: 'CAND-DEMO-001',
    offer_id: active.offer_id,
    requirement_id: active.requirement_id,
    trigger_type: active.triggerType,
    trigger_source: activeScenario === 'fish' ? 'raw' : 'offer',
    trigger_status: 'hypothesis_to_verify',
    questions: questions.map((q) => ({
      ...q,
      evidence_value: evidenceValue(q.candidate_answer)
    })),
    self_rating_0_10: rating,
    self_rating_role: 'declarative_comfort_signal',
    self_rating_weight: 'secondary',
    transfer_hypothesis: {
      hypothesis_text: active.hypothesisText,
      candidate_validated: hypothesis,
      human_review_required: hypothesis !== true
    },
    aggregation_rule_applied: 'v1_factuel_majoritaire',
    aggregation_rule_version: '1.0',
    aggregation_result: result,
    aggregation_explanation: explanation,
    final_conviction_level: conviction,
    final_usage_decision: decision,
    decision_basis: explanation,
    offer_text: offer,
    candidate_memory: candidateMemory,
    updated_at: new Date().toISOString()
  }

  function updateQuestion(questionId, value) {
    setQuestions((current) =>
      current.map((q) =>
        q.question_id === questionId ? { ...q, candidate_answer: value } : q
      )
    )
  }

  function handleOfferChange(event) {
    setOffer(event.target.value)
    setAnalysisStatus('dirty')
  }

  function handleMemoryChange(event) {
    setCandidateMemory(event.target.value)
    setAnalysisStatus('dirty')
  }

  async function handleCvUpload(event) {
    const file = event.target.files?.[0]
    if (!file) return

    setCvFileName(file.name)

    const isReadableText =
      file.type.startsWith('text/') ||
      file.name.endsWith('.txt') ||
      file.name.endsWith('.md') ||
      file.name.endsWith('.json')

    if (!isReadableText) {
      setCandidateMemory((previous) =>
        `${previous}

--- CV chargé : ${file.name} ---
Fichier chargé. La lecture automatique du contenu PDF/Word sera ajoutée avec l’intégration IA.`.trim()
      )
      setAnalysisStatus('dirty')
      return
    }

    const text = await file.text()

    setCandidateMemory((previous) =>
      `${previous}

--- CV chargé : ${file.name} ---
${text}`.trim()
    )

    setAnalysisStatus('dirty')
  }

  async function handleJsonUpload(event) {
    const file = event.target.files?.[0]
    if (!file) return

    setMemoryFileName(file.name)

    try {
      const text = await file.text()
      const parsed = JSON.parse(text)

      if (parsed.offer_text) {
        setOffer(parsed.offer_text)
      }

      if (parsed.candidate_memory) {
        setCandidateMemory(parsed.candidate_memory)
      }

      if (parsed.questions) {
        setQuestions(parsed.questions)
      }

      if (typeof parsed.self_rating_0_10 === 'number') {
        setRating(parsed.self_rating_0_10)
      }

      if (parsed.transfer_hypothesis) {
        setHypothesis(parsed.transfer_hypothesis.candidate_validated ?? null)
      }

      setAnalysisStatus('dirty')
    } catch (error) {
      alert(
        'Le fichier .json n’est pas lisible ou n’est pas une mémoire TalentBusterZ valide.'
      )
    }
  }

  function handleAnalyzeOffer() {
    if (!offer.trim()) {
      alert('Colle d’abord une offre à analyser.')
      return
    }

    const nextScenario = detectScenario(offer)
    setActiveScenario(nextScenario)
    setQuestions(scenarios[nextScenario].questions)
    setRating(5)
    setHypothesis(null)
    setAnalysisStatus('analyzed')
  }

  function fillExample() {
    const nextScenario = activeScenario

    if (nextScenario === 'talent') {
      setQuestions([
        {
          ...questions[0],
          candidate_answer:
            'Oui, recrutement IT international sur des profils tech et business dans des environnements exigeants.'
        },
        {
          ...questions[1],
          candidate_answer:
            'Profils développeurs, infrastructure, cybersécurité, Salesforce, business et support.'
        },
        {
          ...questions[2],
          candidate_answer:
            'Structuration de priorités, requalification des besoins, amélioration du suivi candidat et harmonisation des échanges avec les managers.'
        },
        {
          ...questions[3],
          candidate_answer:
            'Accompagnement de collègues et partage de méthodes de sourcing, qualification et suivi candidat.'
        },
        {
          ...questions[4],
          candidate_answer:
            'Bullhorn, LinkedIn Recruiter, reporting, suivi ATS, coordination avec hiring managers.'
        }
      ])
    } else if (nextScenario === 'fish') {
      setQuestions([
        { ...questions[0], candidate_answer: 'Oui' },
        { ...questions[1], candidate_answer: 'Oui' },
        {
          ...questions[2],
          candidate_answer: 'Bateau de pêche et usine de transformation'
        },
        {
          ...questions[3],
          candidate_answer:
            'Découpe de filets, emballage, contrôle qualité, nettoyage du poste'
        }
      ])
    } else {
      setQuestions(
        questions.map((q, index) => ({
          ...q,
          candidate_answer:
            index === 0
              ? 'Oui'
              : index === 1
                ? 'Contexte professionnel proche, avec responsabilités comparables.'
                : 'Tâches concrètes à préciser selon l’offre.'
        }))
      )
    }

    setRating(7)
    setHypothesis(true)
    setAnalysisStatus('analyzed')
  }

  function resetDemo() {
    setOffer(initialOffer)
    setCandidateMemory(initialMemory)
    setCvFileName('')
    setMemoryFileName('')
    setActiveScenario('fish')
    setQuestions(scenarios.fish.questions)
    setRating(5)
    setHypothesis(null)
    setAnalysisStatus('empty')
  }

  function exportJson() {
    const blob = new Blob([JSON.stringify(flow, null, 2)], {
      type: 'application/json'
    })

    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'memoire-talentbusterz.json'
    link.click()
    URL.revokeObjectURL(url)
  }

  async function exportZip() {
    const zip = new JSZip()

    zip.file('conversationflow.json', JSON.stringify(flow, null, 2))
    zip.file('cv-suggestion.md', cvText(decision, activeScenario))
    zip.file('offer.txt', offer)
    zip.file('memoire-candidat.txt', candidateMemory)

    const blob = await zip.generateAsync({ type: 'blob' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'talentbusterz-export.zip'
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="app">
      <header>
        <div className="brand">TalentBusterZ</div>

        <nav>
          <a href="#demo">Démo</a>
          <a href="#assistant">Assistant</a>
          <a href="#resultat">Résultat</a>
          <a href="#methode">Méthode</a>
        </nav>

        <Badge type="green">V0.9.3</Badge>
      </header>

      <section className="hero">
        <Badge type="orange">Version exploratoire privée</Badge>
        <h1>Le CV ne dit pas tout.</h1>
        <p>
          TalentBusterZ pose les bonnes questions pour révéler les expériences
          utiles, construire un CV ciblé et préparer un argumentaire honnête.
        </p>

        <div className="heroActions">
          <button onClick={fillExample}>
            <Sparkles size={18} /> Remplir l’exemple
          </button>

          <button className="secondary" onClick={resetDemo}>
            <RefreshCcw size={18} /> Réinitialiser
          </button>
        </div>
      </section>

      <main id="demo" className="grid">
        <Card title="Offre ciblée" icon={<FileText />}>
          <p className="muted">
            Collez ici l’offre à analyser. En V0.9.3, l’analyse est locale et
            provisoire. L’IA viendra ensuite générer des questions plus fines.
          </p>

          <textarea
            className="offerTextarea"
            value={offer}
            onChange={handleOfferChange}
            placeholder="Collez ici l’offre d’emploi..."
          />

          {analysisStatus === 'dirty' && (
            <div className="statusWarning">
              Offre ou mémoire modifiée — analyse non relancée.
            </div>
          )}

          {analysisStatus === 'analyzed' && (
            <div className="statusSuccess">
              Offre analysée — assistant mis à jour.
            </div>
          )}

          <button className="primaryAction" onClick={handleAnalyzeOffer}>
            Analyser cette offre
          </button>
        </Card>

        <Card title="Profil candidat" icon={<Database />}>
          <p className="muted">
            Le CV ne dit pas toujours tout. Ajoutez ici les expériences
            anciennes, projets personnels, missions courtes ou compétences
            oubliées qui pourraient compter selon l’offre.
          </p>

          <div className="uploadGrid">
            <label className="uploadButton">
              <Upload size={18} /> Charger un CV
              <input
                type="file"
                accept=".txt,.md,.json,.pdf,.doc,.docx"
                onChange={handleCvUpload}
                hidden
              />
            </label>

            <label className="uploadButton secondaryUpload">
              <Database size={18} /> Charger une mémoire TBZ (.json)
              <input
                type="file"
                accept=".json"
                onChange={handleJsonUpload}
                hidden
              />
            </label>
          </div>

          {cvFileName && <p className="fileHint">CV chargé : {cvFileName}</p>}
          {memoryFileName && (
            <p className="fileHint">Mémoire chargée : {memoryFileName}</p>
          )}

          <label className="fieldLabel">Mémoire candidat locale</label>

          <textarea
            value={candidateMemory}
            onChange={handleMemoryChange}
            placeholder="Ajoutez ici ce que le CV ne raconte pas toujours : expériences anciennes, projets, missions courtes, compétences oubliées..."
          />
        </Card>

        <Card
          title="Signal ou piste à vérifier"
          icon={active.signalIcon === 'fish' ? <Fish /> : <Sparkles />}
        >
          <Badge type="blue">hypothesis_to_verify</Badge>
          <h3>{active.signalTitle}</h3>
          <p>
            TBZ ne conclut pas. Il interroge pour vérifier si cette piste est
            défendable.
          </p>
        </Card>

        <Card title="Garde-fous" icon={<ShieldCheck />}>
          <ul>
            <li>Absence CV ≠ absence d’expérience.</li>
            <li>Autoévaluation = signal secondaire.</li>
            <li>Hypothèse de transfert à valider.</li>
            <li>Décision d’usage traçable.</li>
          </ul>
        </Card>
      </main>

      <section id="assistant" className="assistant">
        <h2>
          <Bot /> Assistant conversationnel
        </h2>

        {questions.map((q) => {
          const value = evidenceValue(q.candidate_answer)
          const badgeType =
            value === 'strong'
              ? 'green'
              : value === 'medium'
                ? 'blue'
                : value === 'weak'
                  ? 'orange'
                  : 'neutral'

          return (
            <div className="question" key={q.question_id}>
              <div>
                <Badge>{questionTypeLabel(q.question_type)}</Badge>
                <Badge type={badgeType}>{evidenceLabel(value)}</Badge>
              </div>

              <label>{q.question_text}</label>

              <input
                value={q.candidate_answer}
                onChange={(event) =>
                  updateQuestion(q.question_id, event.target.value)
                }
                placeholder="Réponse candidat..."
              />
            </div>
          )
        })}

        <div className="question">
          <label>
            Sur 0 à 10, à quel point vous vous sentez capable d’en parler
            clairement en entretien ?
          </label>

          <input
            type="range"
            min="0"
            max="10"
            value={rating}
            onChange={(event) => setRating(Number(event.target.value))}
          />

          <strong>{rating}/10</strong>
          <p>Signal de confort déclaratif, poids secondaire.</p>
        </div>

        <div className="hypothesis">
          <h3>Hypothèse de transfert</h3>
          <p>{flow.transfer_hypothesis.hypothesis_text}</p>

          <button
            className={hypothesis === true ? 'active' : 'secondary'}
            onClick={() => setHypothesis(true)}
          >
            Validée
          </button>

          <button
            className={hypothesis === false ? 'active danger' : 'secondary'}
            onClick={() => setHypothesis(false)}
          >
            Non validée
          </button>

          <button
            className={hypothesis === null ? 'active neutral' : 'secondary'}
            onClick={() => setHypothesis(null)}
          >
            À vérifier
          </button>
        </div>
      </section>

      <section id="resultat" className="grid">
        <Card title="Décision d’usage" icon={<Sparkles />}>
          <div className={`decision ${decision}`}>
            <strong>{decisionLabel(decision)}</strong>
            <span>Niveau de conviction : {conviction}</span>
          </div>

          <p>
            <b>Règle :</b> {flow.aggregation_rule_applied} v
            {flow.aggregation_rule_version}
          </p>

          <p>{explanation}</p>

          {decision === 'needs_human_review' && (
            <p className="warn">
              <AlertTriangle /> Validation humaine recommandée.
            </p>
          )}
        </Card>

        <Card title="Phrase CV / argument proposé" icon={<FileText />}>
          <pre>{cvText(decision, activeScenario)}</pre>
        </Card>

        <Card title="Export local" icon={<Download />}>
          <button onClick={exportJson}>Exporter mémoire TBZ (.json)</button>
          <button className="secondary" onClick={exportZip}>
            Exporter ZIP
          </button>
        </Card>

        <Card title="JSON vivant" icon={<Database />}>
          <pre className="json">{JSON.stringify(flow, null, 2)}</pre>
        </Card>
      </section>

      <section id="methode" className="method">
        <h2>Méthode</h2>
        <p>
          <b>TalentBusterZ ne fabrique pas d’expérience.</b> Il repère un indice
          explicite, pose des questions factuelles, puis propose une décision
          d’usage traçable.
        </p>
      </section>

      <div className="mobileStickyAction">
        <button onClick={handleAnalyzeOffer}>Analyser cette offre</button>
      </div>

      <footer>
        TalentBusterZ — assistant conversationnel recruteur & constructeur de CV
      </footer>
    </div>
  )
}

createRoot(document.getElementById('root')).render(<App />)
