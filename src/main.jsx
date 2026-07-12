import React, { useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { Bot, Database, Download, FileText, Fish, RefreshCcw, ShieldCheck, Sparkles, AlertTriangle } from 'lucide-react'
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

const initialRaw = `Parcours brut candidat :
- Expérience principale : recrutement / relation client / coordination.
- Australie : travail sur bateau de pêche, usine de transformation, découpe de poisson, conditions difficiles.
- Expériences diverses : adaptation, travail terrain, horaires atypiques, environnement physique exigeant.
- Cette expérience n’est pas visible dans le CV classique.`

const initialQuestions = [
  ['Q1','yes_no','Avez-vous déjà travaillé dans un environnement lié à la pêche, au poisson ou aux produits de la mer ?'],
  ['Q2','yes_no','Avez-vous déjà découpé, préparé ou conditionné du poisson ?'],
  ['Q3','context','Dans quel contexte : bateau, usine, cuisine, rayon, transformation, autre ?'],
  ['Q4','evidence_detail','Quelles tâches faisiez-vous concrètement ?']
].map(([id,type,text])=>({question_id:id, question_type:type, question_text:text, candidate_answer:''}))

function evidenceValue(answer){
  const a=(answer||'').toLowerCase().trim()
  if(!a || ['non','no'].includes(a)) return 'none'
  if(['oui','yes'].includes(a)) return 'medium'
  const terms=['bateau','usine','découpe','decoupe','filet','emballage','conditionnement','contrôle','controle','qualité','qualite','hygiène','hygiene','chaîne du froid','chaine du froid']
  const hits=terms.filter(t=>a.includes(t)).length
  if(hits>=2 || a.length>70) return 'strong'
  if(hits===1 || a.length>25) return 'medium'
  return 'weak'
}

function aggregate(questions, rating, hypothesis){
  const values=questions.map(q=>evidenceValue(q.candidate_answer))
  const strong=values.filter(v=>v==='strong').length
  const medPlus=values.filter(v=>v==='medium'||v==='strong').length
  const none=values.filter(v=>v==='none').length
  if(none>=2) return ['non_concluant','do_not_use','do_not_use','Plusieurs réponses factuelles sont absentes ou négatives : ne pas utiliser cette piste.']
  if(medPlus>=3 && strong>=2 && hypothesis===true) return ['forte','cv_argument','eligible_cv_argument','Réponses factuelles fortes + hypothèse validée : intégrable comme argument CV ciblé.']
  if(medPlus>=2 && hypothesis!==false) return ['moyenne','interview_argument','eligible_interview_argument','Piste défendable en entretien, mais pas assez solide pour être automatiquement intégrée au CV.']
  if(hypothesis===false) return ['faible','raw_only','raw_only','Le candidat ne valide pas le lien : conserver en RAW seulement.']
  return ['faible','needs_human_review','needs_human_review','Réponses insuffisantes ou hétérogènes : validation humaine requise.']
}

function cvText(decision){
  if(decision==='cv_argument') return 'Expérience terrain en environnement produits de la mer : participation à des activités de pêche, découpe, transformation et conditionnement du poisson, avec exposition aux contraintes d’hygiène, de qualité et de rythme opérationnel.'
  if(decision==='interview_argument') return 'Argument entretien à préparer : expérience terrain en Australie autour de la pêche / transformation du poisson, à relier prudemment aux produits frais et aux gestes de préparation.'
  if(decision==='raw_only') return 'À conserver dans le RAW : information utile pour comprendre le parcours, non utilisée dans le CV à ce stade.'
  if(decision==='do_not_use') return 'Ne pas utiliser cette piste : expérience non confirmée ou non défendable pour l’offre visée.'
  return 'À revoir : éléments insuffisants pour décider si cette expérience doit aller dans le CV ou rester en argument d’entretien.'
}

function Badge({children,type='neutral'}){return <span className={'badge '+type}>{children}</span>}
function Card({title,icon,children}){return <section className="card"><h2>{icon}{title}</h2>{children}</section>}

function App(){
  const [offer,setOffer]=useState(initialOffer)
  const [raw,setRaw]=useState(initialRaw)
  const [questions,setQuestions]=useState(initialQuestions)
  const [rating,setRating]=useState(5)
  const [hypothesis,setHypothesis]=useState(null)
  const [conviction, decision, result, explanation]=useMemo(()=>aggregate(questions,rating,hypothesis),[questions,rating,hypothesis])
  const flow={conversation_id:'CONV-DEMO-INTERMARCHE-001',candidate_id:'CAND-DEMO-001',offer_id:'OFF-INTERMARCHE-2026-001',requirement_id:'REQ-INTERMARCHE-001',trigger_type:'dormant_experience',trigger_source:'raw',trigger_status:'hypothesis_to_verify',questions:questions.map(q=>({...q,evidence_value:evidenceValue(q.candidate_answer)})),self_rating_0_10:rating,self_rating_role:'declarative_comfort_signal',self_rating_weight:'secondary',transfer_hypothesis:{hypothesis_text:'L’expérience autour de la pêche et de la découpe de poisson pourrait être reliée à la préparation, aux produits de la mer et aux contraintes d’hygiène.',candidate_validated:hypothesis,human_review_required:hypothesis!==true},aggregation_rule_applied:'v1_factuel_majoritaire',aggregation_rule_version:'1.0',aggregation_result:result,aggregation_explanation:explanation,final_conviction_level:conviction,final_usage_decision:decision,decision_basis:explanation,updated_at:new Date().toISOString()}
  const update=(id,value)=>setQuestions(qs=>qs.map(q=>q.question_id===id?{...q,candidate_answer:value}:q))
  const fill=()=>{setQuestions([{...questions[0],candidate_answer:'Oui'},{...questions[1],candidate_answer:'Oui'},{...questions[2],candidate_answer:'Bateau de pêche et usine de transformation'},{...questions[3],candidate_answer:'Découpe de filets, emballage, contrôle qualité, nettoyage du poste'}]);setRating(7);setHypothesis(true)}
  const reset=()=>{setOffer(initialOffer);setRaw(initialRaw);setQuestions(initialQuestions);setRating(5);setHypothesis(null)}
  const exportJson=()=>{const blob=new Blob([JSON.stringify(flow,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='conversationflow-talentbusterz.json';a.click();URL.revokeObjectURL(url)}
  const exportZip=async()=>{const zip=new JSZip();zip.file('conversationflow.json',JSON.stringify(flow,null,2));zip.file('cv-suggestion.md',cvText(decision));zip.file('offer.txt',offer);zip.file('raw.txt',raw);const blob=await zip.generateAsync({type:'blob'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='talentbusterz-export.zip';a.click();URL.revokeObjectURL(url)}
  return <div className="app">
    <header><div className="brand">TalentBusterZ</div><nav><a href="#demo">Démo</a><a href="#assistant">Assistant</a><a href="#resultat">Résultat</a><a href="#methode">Méthode</a></nav><Badge type="green">V0.9.2</Badge></header>
    <section className="hero"><Badge type="orange">Version exploratoire privée</Badge><h1>Le CV ne dit pas tout.</h1><p>TalentBusterZ pose les bonnes questions pour révéler les expériences utiles, construire un CV ciblé et préparer un argumentaire honnête.</p><div><button onClick={fill}><Sparkles size={18}/> Remplir l’exemple</button><button className="secondary" onClick={reset}><RefreshCcw size={18}/> Réinitialiser</button></div></section>
    <main id="demo" className="grid"><Card title="Offre analysée" icon={<FileText/>}><textarea value={offer} onChange={e=>setOffer(e.target.value)}/></Card><Card title="RAW candidat local" icon={<Database/>}><textarea value={raw} onChange={e=>setRaw(e.target.value)}/></Card><Card title="Signal dormant détecté" icon={<Fish/>}><Badge type="blue">hypothesis_to_verify</Badge><h3>Australie — pêche / découpe / usine / bateau</h3><p>TBZ ne conclut pas. Il interroge pour vérifier si cette piste est défendable.</p></Card><Card title="Garde-fous" icon={<ShieldCheck/>}><ul><li>Absence CV ≠ absence d’expérience.</li><li>Autoévaluation = signal secondaire.</li><li>Hypothèse de transfert à valider.</li><li>Décision d’usage traçable.</li></ul></Card></main>
    <section id="assistant" className="assistant"><h2><Bot/> Assistant conversationnel</h2>{questions.map(q=><div className="question" key={q.question_id}><div><Badge>{q.question_type}</Badge><Badge type={evidenceValue(q.candidate_answer)==='strong'?'green':evidenceValue(q.candidate_answer)==='medium'?'blue':'neutral'}>evidence: {evidenceValue(q.candidate_answer)}</Badge></div><label>{q.question_text}</label><input value={q.candidate_answer} onChange={e=>update(q.question_id,e.target.value)} placeholder="Réponse candidat..."/></div>)}<div className="question"><label>Sur 0 à 10, à quel point vous vous sentez capable d’en parler clairement en entretien ?</label><input type="range" min="0" max="10" value={rating} onChange={e=>setRating(Number(e.target.value))}/><strong>{rating}/10</strong><p>Signal de confort déclaratif, poids secondaire.</p></div><div className="hypothesis"><h3>Hypothèse de transfert</h3><p>{flow.transfer_hypothesis.hypothesis_text}</p><button className={hypothesis===true?'active':'secondary'} onClick={()=>setHypothesis(true)}>Validée</button><button className={hypothesis===false?'active danger':'secondary'} onClick={()=>setHypothesis(false)}>Non validée</button><button className={hypothesis===null?'active neutral':'secondary'} onClick={()=>setHypothesis(null)}>À vérifier</button></div></section>
    <section id="resultat" className="grid"><Card title="Décision d’usage" icon={<Sparkles/>}><div className={'decision '+decision}><strong>{decision}</strong><span>Niveau de conviction : {conviction}</span></div><p><b>Règle :</b> {flow.aggregation_rule_applied} v{flow.aggregation_rule_version}</p><p>{explanation}</p>{decision==='needs_human_review'&&<p className="warn"><AlertTriangle/> Validation humaine recommandée.</p>}</Card><Card title="Phrase CV / argument proposé" icon={<FileText/>}><pre>{cvText(decision)}</pre></Card><Card title="Export local" icon={<Download/>}><button onClick={exportJson}>Exporter JSON</button><button className="secondary" onClick={exportZip}>Exporter ZIP</button></Card><Card title="JSON vivant" icon={<Database/>}><pre className="json">{JSON.stringify(flow,null,2)}</pre></Card></section>
    <section id="methode" className="method"><h2>Méthode</h2><p><b>TalentBusterZ ne fabrique pas d’expérience.</b> Il repère un indice explicite, pose des questions factuelles, puis propose une décision d’usage traçable.</p></section>
    <footer>TalentBusterZ — assistant conversationnel recruteur & constructeur de CV</footer>
  </div>
}

createRoot(document.getElementById('root')).render(<App />)
