import React, { useEffect, useMemo, useState } from 'react'
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
  Upload,
  UserRound,
  BriefcaseBusiness
} from 'lucide-react'
import JSZip from 'jszip'
import './styles.css'

const initialOffer = ''
const initialMemory = ''

const demoOffer = `Employé rayon poissonnerie — Intermarché

Missions :
- Préparer et mettre en valeur les produits de la mer.
- Participer à la découpe, au conditionnement et à la mise en rayon.
- Respecter les règles d’hygiène, de fraîcheur et de chaîne du froid.
- Conseiller les clients sur les produits.

Profil :
- Une première expérience en poissonnerie ou produits frais est appréciée.
- Débutants acceptés si motivation réelle et capacité à apprendre.
- Rigueur, sens du service et respect des règles d’hygiène attendus.`

const demoMemory = `Mémoire candidat locale :
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
      'Une expérience autour de la pêche, de la découpe ou de la transformation du poisson pourrait aider à défendre une candidature liée aux produits de la mer.',
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
      'Une expérience en recrutement, coordination, relation client ou structuration de process pourrait aider à défendre une candidature Talent Acquisition Lead.',
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
      'Une expérience non visible dans le CV pourrait être reliée à cette offre. Cette piste doit être vérifiée par des réponses concrètes.',
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

function cloneQuestions(scenarioKey) {
  return scenarios[scenarioKey].questions.map((question) => ({ ...question }))
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


// TODO V0.9.5:
// Le fuzzy matching, les synonymes, fautes légères et variantes lexicales
// seront gérés par TBZ_AI_GATEWAY.
// Cette logique locale est un garde-fou temporaire contre les réponses incohérentes,
// pas un vrai moteur d’évaluation sémantique.
function normalizeAnswer(text = '') {
  return String(text)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9+#.\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function looksSuspiciousAnswer(answer = '') {
  const normalized = normalizeAnswer(answer)
  if (!normalized) return true

  const words = normalized.split(/\s+/).filter(Boolean)
  if (!words.length) return true

  const negative = /\b(non|jamais|aucun|aucune|pas|no|never|none)\b/.test(normalized)
  if (negative && normalized.length < 80) return true

  // Très long, mais quasi aucune voyelle : typique du charabia clavier.
  const letters = normalized.replace(/[^a-z]/g, '')
  if (letters.length >= 25) {
    const vowels = (letters.match(/[aeiouy]/g) || []).length
    const vowelRatio = vowels / letters.length
    if (vowelRatio < 0.22) return true
  }

  // Beaucoup de mots longs sans voyelles ou avec motifs improbables.
  const oddWords = words.filter((w) => {
    if (w.length < 7) return false
    const hasVowel = /[aeiouy]/.test(w)
    const repeatedConsonants = /[bcdfghjklmnpqrstvwxz]{5,}/.test(w)
    const keyboardNoise = /(zq|qz|xk|kx|jz|zj|zd|dz|kj|jk|lkj|jkl)/.test(w)
    return !hasVowel || repeatedConsonants || keyboardNoise
  })

  if (words.length >= 3 && oddWords.length / words.length > 0.45) return true

  return false
}

function relevantSignals(answer = '') {
  const a = normalizeAnswer(answer)
  if (!a) return []

  const signalGroups = [
    ['linkedin recruiter', 'linkedin', 'linked in recruiter'],
    ['bullhorn', 'bull horn'],
    ['ashby', 'ashbyy'],
    ['modernloop', 'modern loop'],
    ['ats', 'applicant tracking'],
    ['reporting', 'dashboard', 'dashboards', 'kpi', 'data', 'analytics'],
    ['sourcing', 'boolean', 'approche directe', 'chasse'],
    ['international', 'mobilite', 'relocation', 'anglais', 'english'],
    ['recrutement', 'recruiting', 'talent acquisition', 'ta'],
    ['manager', 'management', 'lead', 'mentor', 'coach', 'coaching', 'equipe'],
    ['process', 'amelioration', 'harmonisation', 'structuration', 'outils'],
    ['client', 'hiring manager', 'stakeholder', 'business leader'],
    ['tech', 'it', 'java', 'python', 'react', 'salesforce', 'cobol', 'cyber'],
    ['poisson', 'poissonnerie', 'filet', 'decoupe', 'chaine du froid', 'hygiene', 'mer'],
    ['cro', 'clinical', 'gcp', 'ich', 'tmf', 'ctms', 'edc', 'audit', 'regulatory']
  ]

  const found = []
  for (const group of signalGroups) {
    if (group.some((term) => a.includes(term))) found.push(group[0])
  }
  return found
}

function evidenceValue(answer, questionText = '') {
  const a = normalizeAnswer(answer)
  if (!a) return 'none'

  if (looksSuspiciousAnswer(answer)) return 'none'

  const signals = relevantSignals(`${questionText} ${answer}`)
  const answerSignals = relevantSignals(answer)

  // Une réponse courte mais précise doit pouvoir compter.
  if (answerSignals.length >= 2) return 'strong'
  if (answerSignals.length === 1) return 'medium'

  // Réponses déclaratives simples : utiles, mais jamais fortes seules.
  if (/\b(oui|yes|deja|j ai|j'ai|experience|fait|utilise|used|worked)\b/.test(a)) {
    return signals.length ? 'weak' : 'weak'
  }

  // La longueur seule ne crée plus jamais un indice fort.
  if (a.length > 120 && signals.length >= 1) return 'weak'

  return 'none'
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
      'Plusieurs réponses concrètes sont absentes ou négatives.'
    ]
  }

  if (hypothesis === false) {
    return [
      'faible',
      'raw_only',
      'raw_only',
      'Le lien n’est pas confirmé : cette information reste dans la mémoire candidat locale.'
    ]
  }

  if (mediumPlus >= 3 && strong >= 2 && hypothesis === true) {
    return [
      'forte',
      'cv_argument',
      'eligible_cv_argument',
      'La piste est suffisamment concrète et confirmée pour être utilisée dans un CV ciblé.'
    ]
  }

  if (mediumPlus >= 2 && hypothesis !== false) {
    return [
      'moyenne',
      'interview_argument',
      'eligible_interview_argument',
      'La piste semble défendable en entretien, mais pas assez solide pour être intégrée automatiquement au CV.'
    ]
  }

  return [
    'faible',
    'needs_human_review',
    'needs_human_review',
    'Les réponses sont encore insuffisantes ou hétérogènes.'
  ]
}

function computeScore(questions, hypothesis, decision) {
  const values = questions.map((q) => evidenceValue(q.candidate_answer))
  const answered = values.filter((v) => v !== 'none').length
  const strong = values.filter((v) => v === 'strong').length
  const medium = values.filter((v) => v === 'medium').length

  let score = 38

  score += answered * 7
  score += medium * 5
  score += strong * 8

  if (hypothesis === true) score += 10
  if (hypothesis === false) score -= 10

  if (decision === 'cv_argument') score = Math.max(score, 86)
  if (decision === 'interview_argument') score = Math.max(score, 72)
  if (decision === 'raw_only') score = Math.min(score, 55)
  if (decision === 'do_not_use') score = Math.min(score, 42)

  return Math.max(0, Math.min(100, score))
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
    return 'Une phrase sera proposée ici lorsque la piste sera confirmée par des réponses concrètes.'
  }

  if (decision === 'needs_human_review') {
    return 'Une phrase pourra être proposée après vérification humaine ou réponses complémentaires.'
  }

  return 'Argument potentiel à formuler après validation des réponses concrètes.'
}

function cvPreview(decision, scenario) {
  const isConfirmed = decision === 'cv_argument' || decision === 'interview_argument'

  if (!isConfirmed) {
    return {
      ready: false,
      title: 'Prévisualisation non disponible',
      message:
        'TBZ ne prépare pas encore de CV adapté : la piste doit d’abord être confirmée par des réponses concrètes.',
      nextStep:
        'Répondez aux questions de l’assistant, puis confirmez ou écartez la piste détectée.'
    }
  }

  if (scenario === 'talent') {
    return {
      ready: true,
      title: 'Talent Acquisition / Recrutement IT international',
      intro:
        'Profil recrutement orienté accompagnement candidat, sourcing international, coordination avec les parties prenantes et amélioration de l’expérience candidat.',
      bullets: [
        'Recrutement de profils tech, business ou support dans des environnements exigeants.',
        'Coordination avec managers, clients internes ou parties prenantes opérationnelles.',
        'Utilisation d’outils de sourcing, ATS, reporting ou suivi candidat.',
        'Capacité à défendre une candidature avec des exemples concrets et vérifiables.'
      ],
      styleNote:
        'Style employeur à venir : adaptation visuelle inspirée de la charte ou du site de l’entreprise.'
    }
  }

  if (scenario === 'fish') {
    return {
      ready: true,
      title: 'Employé rayon produits de la mer / polyvalence produits frais',
      intro:
        'Profil terrain avec exposition à des environnements exigeants, rythme opérationnel, gestes de préparation et contraintes d’hygiène.',
      bullets: [
        'Expérience autour de la pêche, de la découpe ou de la transformation du poisson.',
        'Adaptation à des conditions physiques et horaires exigeantes.',
        'Sens du concret, du rythme et du respect des consignes.',
        'Argument à relier prudemment à l’offre ciblée selon les réponses confirmées.'
      ],
      styleNote:
        'Style employeur à venir : adaptation visuelle inspirée de la charte ou du site de l’entreprise.'
    }
  }

  return {
    ready: true,
    title: 'CV adapté à l’offre ciblée',
    intro:
      'Profil à structurer selon les expériences confirmées et les attentes de l’offre.',
    bullets: [
      'Forces confirmées à reprendre dans le CV.',
      'Arguments défendables à préparer.',
      'Points à clarifier avant envoi.',
      'Adaptation éditoriale selon l’employeur.'
    ],
    styleNote:
      'Style employeur à venir : adaptation visuelle inspirée de la charte ou du site de l’entreprise.'
  }
}

function decisionLabel(decision) {
  const labels = {
    cv_argument: 'Utilisable dans le CV ciblé',
    interview_argument: 'Préparable pour l’entretien',
    raw_only: 'À garder en mémoire locale',
    do_not_use: 'Pas encore utilisable',
    needs_human_review: 'À vérifier'
  }

  return labels[decision] || decision
}

function convictionLabel(conviction) {
  const labels = {
    non_concluant: 'Pas assez d’éléments',
    faible: 'Fragile',
    moyenne: 'Défendable avec prudence',
    forte: 'Solide'
  }

  return labels[conviction] || conviction
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

function Card({ title, icon, children, className = '' }) {
  return (
    <section className={`card ${className}`}>
      <h2>
        {icon}
        {title}
      </h2>
      {children}
    </section>
  )
}

function ScoreDonut({ score }) {
  return (
    <div className="scoreDonut" style={{ '--score': score }}>
      <span>{score}%</span>
    </div>
  )
}

function App() {
  const [offer, setOffer] = useState(initialOffer)
  const [candidateMemory, setCandidateMemory] = useState(initialMemory)
  const [cvFileName, setCvFileName] = useState('')
  const [memoryFileName, setMemoryFileName] = useState('')
  const [analysisStatus, setAnalysisStatus] = useState('empty')
  const [activeScenario, setActiveScenario] = useState('generic')
  const [questions, setQuestions] = useState(cloneQuestions('generic'))
  const [rating, setRating] = useState(5)
  const [hypothesis, setHypothesis] = useState(null)
  const [showCvPreview, setShowCvPreview] = useState(false)
  const [activeSection, setActiveSection] = useState('demo')

  useEffect(() => {
    const sectionIds = ['demo', 'assistant', 'resultat', 'methode']
    const sections = sectionIds
      .map((id) => document.getElementById(id))
      .filter(Boolean)

    if (!sections.length) return undefined

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0]

        if (visible?.target?.id) {
          setActiveSection(visible.target.id)
        }
      },
      {
        root: null,
        rootMargin: '-25% 0px -55% 0px',
        threshold: [0.1, 0.3, 0.6]
      }
    )

    sections.forEach((section) => observer.observe(section))

    return () => observer.disconnect()
  }, [])

  const [conviction, decision, result, explanation] = useMemo(
    () => aggregate(questions, hypothesis),
    [questions, hypothesis]
  )

  const matchingScore = useMemo(
    () => computeScore(questions, hypothesis, decision),
    [questions, hypothesis, decision]
  )

  const active = scenarios[activeScenario] || scenarios.generic
  const preview = cvPreview(decision, activeScenario)
  const answeredQuestionsCount = questions.filter((q) =>
    q.candidate_answer.trim()
  ).length
  const scoreNeedsWork =
    analysisStatus === 'analyzed' &&
    (answeredQuestionsCount === 0 || decision === 'do_not_use' || decision === 'needs_human_review')

  const flow = {
    conversation_id: active.conversation_id,
    candidate_id: 'CAND-DEMO-001',
    offer_id: active.offer_id,
    requirement_id: active.requirement_id,
    trigger_type: active.triggerType,
    trigger_source: activeScenario === 'fish' ? 'raw' : 'offer',
    trigger_status: 'hypothesis_to_verify',
    matching_score: matchingScore,
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

  function scrollToSection(sectionId) {
    document.getElementById(sectionId)?.scrollIntoView({
      behavior: 'smooth',
      block: 'start'
    })
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
    setAnalysisStatus(event.target.value.trim() ? 'dirty' : 'empty')
  }

  function handleMemoryChange(event) {
    setCandidateMemory(event.target.value)
    setAnalysisStatus(offer.trim() ? 'dirty' : analysisStatus)
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
      setAnalysisStatus(offer.trim() ? 'dirty' : analysisStatus)
      return
    }

    const text = await file.text()

    setCandidateMemory((previous) =>
      `${previous}

--- CV chargé : ${file.name} ---
${text}`.trim()
    )

    setAnalysisStatus(offer.trim() ? 'dirty' : analysisStatus)
  }

  async function handleJsonUpload(event) {
    const file = event.target.files?.[0]
    if (!file) return

    setMemoryFileName(file.name)

    try {
      const text = await file.text()
      const parsed = JSON.parse(text)

      if (parsed.offer_text) setOffer(parsed.offer_text)
      if (parsed.candidate_memory) setCandidateMemory(parsed.candidate_memory)
      if (parsed.questions) setQuestions(parsed.questions)
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
    setQuestions(cloneQuestions(nextScenario))
    setRating(5)
    setHypothesis(null)
    setAnalysisStatus('analyzed')
    setShowCvPreview(false)
    window.setTimeout(() => scrollToSection('resultat'), 80)
  }

  function resetOfferOnly() {
    setOffer('')
    setAnalysisStatus('empty')
    setShowCvPreview(false)
  }

  function resetProfileOnly() {
    setCandidateMemory('')
    setCvFileName('')
    setMemoryFileName('')
    setAnalysisStatus(offer.trim() ? 'dirty' : 'empty')
    setShowCvPreview(false)
  }

  function fillExample() {
    setOffer(demoOffer)
    setCandidateMemory(demoMemory)
    setActiveScenario('fish')
    setQuestions([
      { ...scenarios.fish.questions[0], candidate_answer: 'Oui' },
      { ...scenarios.fish.questions[1], candidate_answer: 'Oui' },
      {
        ...scenarios.fish.questions[2],
        candidate_answer: 'Bateau de pêche et usine de transformation'
      },
      {
        ...scenarios.fish.questions[3],
        candidate_answer:
          'Découpe de filets, emballage, contrôle qualité, nettoyage du poste'
      }
    ])
    setRating(7)
    setHypothesis(true)
    setAnalysisStatus('analyzed')
    setShowCvPreview(false)
    window.setTimeout(() => scrollToSection('resultat'), 80)
  }

  function resetDemo() {
    setOffer(initialOffer)
    setCandidateMemory(initialMemory)
    setCvFileName('')
    setMemoryFileName('')
    setActiveScenario('generic')
    setQuestions(cloneQuestions('generic'))
    setRating(5)
    setHypothesis(null)
    setAnalysisStatus('empty')
    setShowCvPreview(false)
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
        <div className="brand" aria-label="TalentBusterZ">
          <span className="brandCap">T</span>
          <span className="brandRest">alent</span>
          <span className="brandCap">B</span>
          <span className="brandRest">uster</span>
          <span className="brandZ">Z</span>
        </div>

        <nav aria-label="Navigation principale">
          <a
            href="#demo"
            className={activeSection === 'demo' ? 'active' : ''}
            onClick={() => setActiveSection('demo')}
          >
            Démo
          </a>
          <a
            href="#assistant"
            className={activeSection === 'assistant' ? 'active' : ''}
            onClick={() => setActiveSection('assistant')}
          >
            Assistant
          </a>
          <a
            href="#resultat"
            className={activeSection === 'resultat' ? 'active' : ''}
            onClick={() => setActiveSection('resultat')}
          >
            Résultat
          </a>
          <a
            href="#methode"
            className={activeSection === 'methode' ? 'active' : ''}
            onClick={() => setActiveSection('methode')}
          >
            Méthode
          </a>
        </nav>

        <div className="headerRight">
          <a className="proLink" href="#pro">
            TBZ Pro
          </a>
          <Badge type="green">V0.9.4.4</Badge>
        </div>
      </header>

      <section className="hero compactHero">
        <div className="heroText">
          <Badge type="orange">Version candidat — prototype privé</Badge>
          <h1>Le CV ne dit pas tout.</h1>
          <p>
            TalentBusterZ aide à relier une offre, un parcours et des arguments
            défendables, sans inventer d’expérience.
          </p>

          <div className="heroActions">
            <button onClick={fillExample}>
              <Sparkles size={18} /> Voir un exemple
            </button>

            <button className="secondary" onClick={resetDemo}>
              <RefreshCcw size={18} /> Réinitialiser
            </button>
          </div>
        </div>
      </section>

      <main id="demo" className="grid">
        <Card title="Offre ciblée" icon={<FileText />}>
          <p className="muted">
            Collez ici l’offre à analyser. L’IA viendra ensuite générer des
            questions plus fines ; cette version reste locale et exploratoire.
          </p>

          <textarea
            className="offerTextarea"
            value={offer}
            onChange={handleOfferChange}
            placeholder="Collez ici votre offre..."
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

          <div className="offerActions">
            <button className="primaryAction" onClick={handleAnalyzeOffer}>
              Analyser cette offre
            </button>
            <button className="secondaryAction" onClick={resetOfferOnly}>
              Réinitialiser l’offre
            </button>
          </div>
        </Card>

        <Card title="Profil candidat" icon={<UserRound />}>
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

          <button className="secondaryAction profileReset" onClick={resetProfileOnly}>
            Réinitialiser le profil candidat
          </button>
        </Card>

        <Card
          title="Piste détectée"
          icon={active.signalIcon === 'fish' ? <Fish /> : <Sparkles />}
        >
          <Badge type="blue">À vérifier</Badge>
          <h3>{active.signalTitle}</h3>
          <p>
            TBZ a repéré un lien possible avec l’offre. Cette piste doit être
            confirmée avant d’être utilisée dans le CV ou en entretien.
          </p>
        </Card>

        <Card title="Garde-fous" icon={<ShieldCheck />}>
          <ul>
            <li>Absence CV ≠ absence d’expérience.</li>
            <li>Autoévaluation = signal secondaire.</li>
            <li>Une piste détectée doit être confirmée.</li>
            <li>La décision finale reste humaine.</li>
          </ul>
        </Card>
      </main>

      <section id="assistant" className="assistant">
        <h2>
          <Bot /> Assistant d’enrichissement
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
          <h3>Piste détectée</h3>
          <p>{flow.transfer_hypothesis.hypothesis_text}</p>
          <p className="muted">
            Cette piste ne sera utilisée que si elle est confirmée par des
            éléments concrets.
          </p>

          <button
            className={hypothesis === true ? 'active' : 'secondary'}
            onClick={() => setHypothesis(true)}
          >
            Confirmer
          </button>

          <button
            className={hypothesis === false ? 'active danger' : 'secondary'}
            onClick={() => setHypothesis(false)}
          >
            Écarter
          </button>

          <button
            className={hypothesis === null ? 'active neutral' : 'secondary'}
            onClick={() => setHypothesis(null)}
          >
            Garder à vérifier
          </button>
        </div>
      </section>

      <section id="resultat" className="grid">
        <Card title="Score de matching" icon={<Sparkles />}>
          {analysisStatus === 'analyzed' ? (
            <>
              <div className="resultScoreBlock">
                <ScoreDonut score={matchingScore} />
                <div>
                  <strong>{matchingScore}% — score provisoire — mis à jour en direct</strong>
                  <p>
                    Ce score évolue selon l’offre analysée, les réponses
                    candidat et les pistes confirmées. Il aide à lire le
                    matching, sans décider à la place de l’humain.
                  </p>
                </div>
              </div>

              {scoreNeedsWork && (
                <div className="scoreCoach">
                  <strong>
                    Assistant : améliorez votre score en répondant à ces
                    questions.
                  </strong>
                  <p>
                    Le score est bas ou incomplet parce que les expériences ne
                    sont pas encore confirmées par des éléments concrets.
                  </p>
                  <button onClick={() => scrollToSection('assistant')}>
                    Répondre aux questions
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="scorePlaceholder">
              <strong>Score non disponible</strong>
              <p>
                Collez une offre puis cliquez sur “Analyser cette offre” pour
                obtenir une première lecture du matching.
              </p>
            </div>
          )}
        </Card>

        <Card title="Conclusion provisoire" icon={<Sparkles />}>
          <div className={`decision ${decision}`}>
            <strong>{decisionLabel(decision)}</strong>
            <span>{convictionLabel(conviction)}</span>
          </div>

          <p>
            <b>Pourquoi ?</b> {explanation}
          </p>

          <p>
            <b>Prochaine étape :</b> répondez aux questions de l’assistant pour
            faire évoluer cette conclusion.
          </p>

          {decision === 'needs_human_review' && (
            <p className="warn">
              <AlertTriangle /> Validation humaine recommandée.
            </p>
          )}
        </Card>

        <Card title="Phrase CV / argument proposé" icon={<FileText />}>
          <pre>{cvText(decision, activeScenario)}</pre>

          <button
            className="primaryAction previewButton"
            onClick={() => setShowCvPreview((current) => !current)}
          >
            Prévisualiser mon CV adapté
          </button>
        </Card>

        {showCvPreview && (
          <Card
            title="Prévisualisation CV adapté"
            icon={<FileText />}
            className={`wideCard cvPreviewCard ${preview.ready ? 'ready' : 'notReady'}`}
          >
            {!preview.ready ? (
              <div className="cvPreviewPlaceholder">
                <h3>{preview.title}</h3>
                <p>{preview.message}</p>
                <p>
                  <b>Prochaine étape :</b> {preview.nextStep}
                </p>
              </div>
            ) : (
              <div className="cvPreview">
                <div className="cvPreviewHeader">
                  <span>CV adapté — version provisoire</span>
                  <strong>{preview.title}</strong>
                </div>

                <p className="cvIntro">{preview.intro}</p>

                <h3>Arguments proposés</h3>
                <ul>
                  {preview.bullets.map((bullet) => (
                    <li key={bullet}>{bullet}</li>
                  ))}
                </ul>

                <div className="styleNote">{preview.styleNote}</div>
              </div>
            )}
          </Card>
        )}

        <Card title="Sauvegarde & mémoire locale" icon={<Download />} className="wideCard">
          <div className="exportPanel">
            <div className="exportBlock">
              <h3>Mémoire TBZ</h3>
              <p>
                Sauvegardez l’analyse en cours pour la reprendre plus tard sans
                repartir de zéro.
              </p>
              <button onClick={exportJson}>Exporter mémoire TBZ (.json)</button>
            </div>

            <div className="exportBlock">
              <h3>Dossier complet</h3>
              <p>
                Exportez l’offre, la mémoire candidat, la conclusion et la phrase
                proposée.
              </p>
              <button className="secondary" onClick={exportZip}>
                Exporter ZIP
              </button>
            </div>

            <div className="exportBlock technicalBlock">
              <h3>Détails techniques</h3>
              <p>
                Réservé aux tests : affiche la mémoire structurée utilisée par le
                moteur local.
              </p>

              <details>
                <summary>Afficher le JSON technique</summary>
                <pre className="json">{JSON.stringify(flow, null, 2)}</pre>
              </details>
            </div>
          </div>
        </Card>
      </section>

      <section id="methode" className="method">
        <h2>Méthode</h2>
        <p>
          <b>TalentBusterZ ne fabrique pas d’expérience.</b> Il repère un indice
          explicite, pose des questions concrètes, puis propose une conclusion
          provisoire et traçable.
        </p>
      </section>

      <section id="pro" className="proCallout">
        <BriefcaseBusiness />
        <div>
          <strong>Professionnel du recrutement ou employeur ?</strong>
          <p>
            La version candidat est pensée pour travailler son propre parcours.
            Un usage multi-candidats relèvera de TalentBusterZ Pro.
          </p>
        </div>
        <button>Découvrir TBZ Pro</button>
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
