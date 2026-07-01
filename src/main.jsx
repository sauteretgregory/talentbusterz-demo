import React, { useEffect, useMemo, useReducer, useState } from 'react';
import { createRoot } from 'react-dom/client';
import JSZip from 'jszip';
import { User, BookOpen, Target, Bot, Database, ShieldCheck, Palette, Download, RotateCw, Eye, AlertTriangle, CheckCircle2, Lock, FileArchive, Sparkles } from 'lucide-react';
import './styles.css';

const FALLBACK_PROFILE = {
  profileId: 'profile_b_demo', displayName: 'Profil B', headline: 'Business Consulting, CRM, Data, Transformation Digitale et Delivery',
  targetOffer: 'Engagement Manager R&D Business Consulting. Life Sciences transformation, strategic delivery, senior customer relationships, project budgets, cross-functional teams, clinical data/operations/regulatory domains.',
  profileStatus: 'discovery', base: { summary: [], tags: [] }, reading: { text: [], centralRule: '' },
  matching: { label: 'Alignement solide à clarifier', interpretation: '', strong: [], partial: [], gaps: [] }, questions: [], proofs: [], jobFamilies: []
};
const initialTbzState = {
  score: 0,
  subScores: { experience: 0, skills: 0, sector: 0, languages: 0, constraints: 0, evidence: 0 },
  mode: 'discovery',
  statusBadge: 'Mode découverte : données locales non validées',
  assistantState: 'idle',
  currentQuestionIndex: 0,
  rawDemo: [],
  qaLog: [],
  scoreLog: [],
  warnings: ['RAW local demo : ne pas confondre avec un profil candidat validé.'],
  lastImpact: null,
  seriousExportAllowed: false
};
const employerDnaDefaults = { url: '', colors: ['#005AA0', '#FFFFFF', '#003B73', '#1E73BE', '#F5F7FA'], font: 'Roboto, Arial, sans-serif', tone: 'Institutionnel, sobre, structuré, orienté clarté et confiance.', source: 'default' };
const scoreWeights = { experience: 35, skills: 30, sector: 20, languages: 10, constraints: 10, evidence: 15 };

function tbzReducer(state, action) {
  switch(action.type) {
    case 'INIT_SCORE': return { ...state, ...action.payload, assistantState: 'asking' };
    case 'SET_MODE': return { ...state, mode: action.mode, statusBadge: modeBadge(action.mode), seriousExportAllowed: action.mode === 'serious_allowed' };
    case 'SAVE_ANSWER': {
      const { profile, offer, answer, question } = action;
      const rawItem = {
        id: `raw_${Date.now()}`,
        questionId: question.id,
        question: question.label,
        targetField: question.targetField,
        answer,
        confidence: answer.length > 80 ? 'confirmed_by_user' : 'candidate_statement_to_clarify',
        createdAt: new Date().toISOString()
      };
      const nextRaw = [rawItem, ...state.rawDemo];
      const nextScorePack = computeScorePack(profile, offer, nextRaw);
      const delta = nextScorePack.score - state.score;
      const nextQuestionIndex = selectNextQuestion(profile.questions, state.currentQuestionIndex, nextRaw);
      return {
        ...state,
        score: nextScorePack.score,
        subScores: nextScorePack.subScores,
        currentQuestionIndex: nextQuestionIndex,
        rawDemo: nextRaw,
        qaLog: [{ questionId: question.id, answer, createdAt: rawItem.createdAt }, ...state.qaLog],
        scoreLog: [{ from: state.score, to: nextScorePack.score, delta, reason: `Réponse ajoutée sur ${question.targetField}`, createdAt: rawItem.createdAt }, ...state.scoreLog],
        lastImpact: { delta, reason: `Réponse ajoutée : ${question.targetField}`, score: nextScorePack.score },
        assistantState: nextRaw.length >= profile.questions.length ? 'completed' : 'asking',
        mode: nextRaw.length >= 4 ? 'profile_exploitable' : 'discovery',
        statusBadge: modeBadge(nextRaw.length >= 4 ? 'profile_exploitable' : 'discovery'),
        seriousExportAllowed: hasSeriousExport(profile, offer, nextRaw)
      };
    }
    case 'RESET_RAW': return { ...initialTbzState, score: state.score, subScores: state.subScores, assistantState: 'asking' };
    default: return state;
  }
}

function App() {
  const [profile, setProfile] = useState(FALLBACK_PROFILE);
  const [active, setActive] = useState('profile');
  const [offer, setOffer] = useState(FALLBACK_PROFILE.targetOffer);
  const [answer, setAnswer] = useState('');
  const [sourceInput, setSourceInput] = useState('');
  const [employerDna, setEmployerDna] = useState(employerDnaDefaults);
  const [previewOpen, setPreviewOpen] = useState(true);
  const [state, dispatch] = useReducer(tbzReducer, initialTbzState);

  useEffect(() => {
    fetch('/data/profile-b.json').then(r => r.json()).then(data => { setProfile(data); setOffer(data.targetOffer); }).catch(() => {});
  }, []);
  useEffect(() => {
    const pack = computeScorePack(profile, offer, state.rawDemo);
    dispatch({ type: 'INIT_SCORE', payload: { score: pack.score, subScores: pack.subScores, statusBadge: modeBadge(state.mode) } });
  }, [profile.profileId, offer]);

  const currentQuestion = profile.questions[state.currentQuestionIndex] || profile.questions[0];
  const cvPreview = useMemo(() => buildCvPreview(profile, offer, state, employerDna), [profile, offer, state, employerDna]);

  function submitAnswer() {
    if (!answer.trim() || !currentQuestion) return;
    dispatch({ type: 'SAVE_ANSWER', profile, offer, answer: answer.trim(), question: currentQuestion });
    setAnswer('');
  }
  function nextQuestion() { dispatch({ type: 'SAVE_ANSWER', profile, offer, answer: '[Question skipped by user]', question: currentQuestion }); }
  function analyzeEmployerSource() {
    const colors = Array.from(new Set((sourceInput.match(/#[0-9a-fA-F]{3,6}/g) || []).map(c => normalizeHex(c)))).slice(0, 6);
    const fontMatches = Array.from(new Set((sourceInput.match(/font-family\s*:\s*([^;{}]+)/gi) || []).map(v => v.split(':')[1]?.trim()).filter(Boolean))).slice(0, 3);
    const buttonRadius = (sourceInput.match(/border-radius\s*:\s*([^;{}]+)/i) || [])[1]?.trim();
    setEmployerDna({
      url: employerDna.url,
      colors: colors.length ? colors : employerDnaDefaults.colors,
      font: fontMatches[0] || employerDnaDefaults.font,
      tone: `${colors.length || fontMatches.length ? 'Indices publics détectés' : 'Aucun signal robuste détecté'} : palette, police${buttonRadius ? `, arrondis ${buttonRadius}` : ''}. Adaptation visuelle compatible, sans copie de marque.`,
      source: 'css_pasted_by_user'
    });
  }
  async function downloadDemoPack() { await downloadPack({ profile, offer, state, employerDna, cvPreview, serious: false }); }
  async function downloadSeriousPack() { await downloadPack({ profile, offer, state, employerDna, cvPreview, serious: true }); }

  return <div className="app" style={{ '--employer-font': employerDna.font }}>
    <TopBar active={active} setActive={setActive} profile={profile} state={state} />
    <Hero profile={profile} state={state} />
    <main className="shell">
      <section id="profile" className="section profile-grid">
        <Card icon={<User />} title="Profil socle anonymisé"><StatusBadge state={state}/>{profile.base.summary.map((p,i)=><p key={i}>{p}</p>)}<Tags tags={profile.base.tags}/></Card>
        <Card icon={<BookOpen />} title="Lecture TalentBusterZ">{profile.reading.text.map((p,i)=><p key={i}>{p}</p>)}<div className="rule"><strong>Règle centrale :</strong> {profile.reading.centralRule}</div></Card>
      </section>
      <section id="matching" className="section cockpit-grid">
        <Card title="Démo statique — lecture d’une fiche de poste" className="offer-card"><p className="muted">Collez une offre ou quelques mots-clés. Cette simulation locale détecte les signaux forts et les limites à cadrer.</p><textarea value={offer} onChange={e=>setOffer(e.target.value)}/><div className="actions wrap"><button className="primary">Analyser l’offre</button><button onClick={()=>setOffer(profile.targetOffer)}>Exemple Engagement Manager</button><button onClick={()=>setOffer('CRM Data Business Consultant. Customer data, dashboards, process optimization, user adoption, support and product teams.')}>Exemple CRM/Data</button><button onClick={()=>setOffer('Senior backend developer Python Kubernetes hands-on software architecture.')}>Test hors cible</button></div></Card>
        <Card icon={<Target />} title="Résultat de matching — Profil B vs offre analysée" className="result-card"><ScorePanel state={state} profile={profile}/></Card>
      </section>
      <section className="section evidence-grid"><Card title="Compétences / preuves à remonter"><CheckList items={profile.matching.strong} color="green"/></Card><Card title="Zones à arbitrer par l’utilisateur"><CheckList items={profile.matching.gaps} color="amber"/></Card><Card icon={<Bot />} title="Impact dernier enrichissement">{state.lastImpact ? <p><strong>{state.lastImpact.delta >= 0 ? '+' : ''}{state.lastImpact.delta} points</strong><br/>{state.lastImpact.reason}<br/>Nouveau score officiel : {state.score}%</p> : <p>Aucune réponse validée pour le moment. Le score officiel est lu uniquement depuis <code>state.score</code>.</p>}</Card></section>
      <section id="assistant" className="section assistant-grid"><Card icon={<Bot />} title="Assistant d’enrichissement du profil" className="wide"><p>Le moteur propose une donnée ou une question. L’utilisateur décide : utiliser dans ce CV, conserver dans le RAW local demo, modifier/préciser ou supprimer.</p><div className="notice"><strong>Machine d’état :</strong> {state.assistantState}. Chaque réponse déclenche : saveAnswer → updateRaw → recomputeScore → selectNextQuestion → refreshUI.</div><QuestionBox currentQuestion={currentQuestion} answer={answer} setAnswer={setAnswer} submitAnswer={submitAnswer} nextQuestion={nextQuestion}/><QuestionHistory questions={profile.questions} rawDemo={state.rawDemo}/></Card><Card icon={<Database />} title="RAW local demo"><p className="muted">Profil brouillon local. Les livrables sérieux exigent un CV/profil validé et une offre analysée.</p>{state.rawDemo.length===0?<p>Aucune donnée enrichie locale.</p>:state.rawDemo.map(item=><details key={item.id} open><summary>{item.targetField} — {item.confidence}</summary><p>{item.answer}</p></details>)}<button onClick={()=>dispatch({type:'RESET_RAW'})}>Réinitialiser RAW demo</button></Card></section>
      <section id="exports" className="section exports-grid"><Card icon={<Download />} title="Exports & mémoire locale"><div className="export-status"><Lock size={18}/><span>Export sérieux : {state.seriousExportAllowed ? 'autorisé' : 'bloqué — profil à valider'}</span></div><div className="actions vertical"><button onClick={downloadDemoPack}><FileArchive size={16}/> Export démo RAW (.zip)</button><button className="primary" disabled={!state.seriousExportAllowed} onClick={downloadSeriousPack}>CV + JSON sérieux (.zip)</button><button onClick={()=>setPreviewOpen(!previewOpen)}><Eye size={16}/> Prévisualiser le CV suggéré</button></div></Card><Card title="Prévisualisation du CV suggéré" className="preview-card">{previewOpen && <pre className="cv-preview">{cvPreview}</pre>}</Card></section>
      <section id="method" className="section method-grid"><Card icon={<Palette />} title="Employer Visual DNA Adapter"><p>Analyse les indices visuels publics fournis par l’utilisateur pour suggérer une direction graphique compatible avec l’employeur, sans copier son identité visuelle.</p><p><strong>Code source :</strong> recette visible d’une page web : HTML, CSS, couleurs, polices et structure. L’utilisateur colle ici un extrait public ou l’adresse du site, puis TBZ extrait ce qui peut l’être.</p><input value={employerDna.url} onChange={e=>setEmployerDna({...employerDna,url:e.target.value})} placeholder="URL du site employeur"/><textarea className="source" value={sourceInput} onChange={e=>setSourceInput(e.target.value)} placeholder="Collez un extrait CSS / code source public : couleurs #005AA0, font-family: Roboto..."/><div className="actions"><button className="primary" onClick={analyzeEmployerSource}><Palette size={16}/> Extraire palette & police</button></div><PalettePreview dna={employerDna}/></Card><Card icon={<ShieldCheck />} title="Méthode & garde-fous"><ul><li>Une seule source officielle : <code>state.score</code>.</li><li>Le donut explique le score par sous-scores.</li><li>Le RAW demo n’est jamais confondu avec un CV validé.</li><li>Le CV preview marque les éléments confirmés, déduits, à vérifier ou absents.</li><li>La promesse : “Je vous ressemble déjà, sans mentir ni copier.”</li></ul></Card></section>
    </main><Footer /></div>;
}
function TopBar({ active, setActive, profile, state }) { const items=[['profile','Profil B'],['matching','Démo matching'],['assistant','Assistant'],['exports','Exports & mémoire'],['method','Méthode']]; return <header className="topbar"><div className="brand">TalentBusterZ</div><span className="mini">Prototype non indexé • Données anonymisées • Static UX V0.9.1</span><nav>{items.map(([id,label])=><button key={id} onClick={()=>{setActive(id);document.getElementById(id)?.scrollIntoView({behavior:'smooth'});}} className={active===id?'active':''}>{label}</button>)}</nav><div className="score-chip">{state.score}%</div><div className="menu">{profile.displayName}</div></header> }
function Hero({profile,state}) { return <section className="hero"><span className="pill">{state.statusBadge}</span><h1>{profile.displayName} — CV augmenté</h1><p>Démonstrateur TalentBusterZ appliqué à un parcours {profile.headline}.</p><p>Continuité logique : réponse utilisateur → RAW mis à jour → score recalculé → question suivante → preview mise à jour → export cohérent.</p></section> }
function Card({icon,title,children,className=''}) { return <article className={`card ${className}`}>{title && <h2>{icon}{title}</h2>}{children}</article> }
function StatusBadge({state}) { return <div className={`status ${state.mode}`}>{state.statusBadge}</div> }
function Tags({tags}) { return <div className="tags">{tags.map(t=><span key={t}>{t}</span>)}</div> }
function ScorePanel({state,profile}) { return <div className="score-panel"><Donut score={state.score}/><div><h3>{state.score}% — Score de matching</h3><p><strong>{profile.matching.label}</strong></p><p>{profile.matching.interpretation}</p><SubScores subScores={state.subScores}/></div></div> }
function Donut({score}) { return <div className="donut" style={{'--score':`${score}%`}}><div><strong>{score}%</strong><span>Score de matching</span></div></div> }
function SubScores({subScores}) { return <div className="subscores">{Object.entries(subScores).map(([k,v])=><div key={k}><span>{labelFor(k)}</span><b>{v} / {scoreWeights[k]}</b><progress value={v} max={scoreWeights[k]} /></div>)}</div> }
function labelFor(k){ return ({experience:'Expérience',skills:'Compétences',sector:'Secteur',languages:'Langues',constraints:'Contraintes',evidence:'Preuves'})[k] || k; }
function CheckList({items,color}) { return <ul className={`checklist ${color}`}>{items.map(i=><li key={i}>{i}</li>)}</ul> }
function QuestionBox({currentQuestion,answer,setAnswer,submitAnswer,nextQuestion}) { if(!currentQuestion) return null; return <div className="question-box"><div className="question-head"><strong>Question Engine V0.9.1</strong><button onClick={nextQuestion}><RotateCw size={16}/> Question suivante</button></div><p className="question"><b>{currentQuestion.id}</b><br/>{currentQuestion.label}</p><p className="hint">Impact score potentiel : +{currentQuestion.impactOnScore}. Pour répondre : 1. contexte, 2. action personnelle, 3. résultat observable.</p><textarea value={answer} onChange={e=>setAnswer(e.target.value)} placeholder="Votre réponse..."/><div className="actions"><button className="primary" onClick={submitAnswer}>Répondre</button><button onClick={()=>setAnswer('Contexte : ...\nAction personnelle : ...\nRésultat observable : ...')}>M’aider avec un exemple</button></div></div> }
function QuestionHistory({questions,rawDemo}) { return <div className="history"><h3>Historique des questions</h3>{questions.map(q=>{const done=rawDemo.some(r=>r.questionId===q.id); return <div key={q.id} className="history-row"><CheckCircle2 size={16} className={done?'done':'todo'}/><span>{q.label}</span><small>{done?'répondu':'à venir'}</small></div>})}</div> }
function PalettePreview({dna}) { return <div><div className="palette">{dna.colors.map(c=><span key={c} style={{background:c}} title={c}/>)}</div><p><strong>Police :</strong> {dna.font}</p><p><strong>Lecture :</strong> {dna.tone}</p></div> }
function Footer(){ return <footer><span>TalentBusterZ — adapter sans inventer, valoriser sans maquiller, clarifier sans masquer.</span><b>Static UX V0.9.1</b></footer> }
function computeScorePack(profile, offer, rawDemo) { const text=(offer+' '+rawDemo.map(r=>r.answer).join(' ')).toLowerCase(); const hit=(arr)=>arr.filter(k=>text.includes(k)).length; const subScores={ experience: Math.min(35, 12+hit(['senior','manager','engagement','delivery','consulting','cross-functional'])*4), skills: Math.min(30, 8+hit(['crm','data','process','reporting','adoption','transformation','customer'])*3), sector: Math.min(20, 4+hit(['life sciences','r&d','clinical','operations','regulatory'])*4), languages: 8, constraints: Math.min(10, 4+rawDemo.length), evidence: Math.min(15, 2+rawDemo.filter(r=>r.answer.length>80).length*4) }; const score=Math.min(96, Math.round((Object.values(subScores).reduce((a,b)=>a+b,0)/120)*100)); return {score,subScores}; }
function selectNextQuestion(questions,currentIndex,rawDemo){ if(!questions?.length) return 0; const answered=new Set(rawDemo.map(r=>r.questionId)); const next=questions.findIndex((q,i)=>i>currentIndex && !answered.has(q.id)); if(next>=0) return next; const first=questions.findIndex(q=>!answered.has(q.id)); return first>=0?first:(currentIndex+1)%questions.length; }
function hasSeriousExport(profile,offer,rawDemo){ return offer.length>80 && rawDemo.filter(r=>r.answer.length>40).length>=4; }
function modeBadge(mode){ return { discovery:'Mode découverte : données locales non validées', profile_exploitable:'Profil exploitable : enrichissement en cours', serious_allowed:'Livrable sérieux autorisé' }[mode] || 'Mode découverte'; }
function normalizeHex(c){ return c.length===4 ? '#'+c[1]+c[1]+c[2]+c[2]+c[3]+c[3] : c.toUpperCase(); }
function buildCvPreview(profile, offer, state, dna) { const enriched=state.rawDemo.slice().reverse().map(r=>`- [${r.confidence === 'confirmed_by_user' ? 'confirmé' : 'à vérifier'}] ${r.targetField}: ${r.answer.replace(/\n/g,' ')}`).join('\n') || '- [absent] Aucun enrichissement validé.'; return `# ${profile.displayName} — CV suggéré\n\nPositionnement proposé : Engagement Manager / Business Consultant CRM-Data — R&D Transformation\nStatut : ${state.statusBadge}\nScore de matching : ${state.score}%\n\n## Style employeur suggéré\n- Statut : déduit depuis indices publics fournis par utilisateur\n- Police : ${dna.font}\n- Palette : ${dna.colors.join(', ')}\n- Garde-fou : inspiration compatible, sans copie d’identité visuelle\n\n## Profil\n[confirmé] Parcours senior à l’intersection du business consulting, de la transformation digitale, du CRM/data, du delivery et de l’amélioration des outils/process.\n\n## Forces mises en avant\n[confirmé] Business consulting et transformation digitale\n[confirmé] Structuration CRM / données client / reporting\n[confirmé] Coordination transverse entre métiers, clients, outils et delivery\n[à vérifier] Budget ownership et périmètre exact\n[absent] Management hiérarchique confirmé\n\n## Offre analysée\n${offer}\n\n## Réponses utilisateur intégrées\n${enriched}\n\n## Limites à cadrer\nNe pas inventer certification, profondeur technique, budget ownership ou management hiérarchique non confirmés.`; }
async function downloadPack({profile,offer,state,employerDna,cvPreview,serious}) { const zip=new JSZip(); const base=serious?'tbz-candidate-pack':'tbz-raw-demo'; const raw={ profileId:profile.profileId, displayName:profile.displayName, mode:state.mode, score:state.score, subScores:state.subScores, offer, rawDemo:state.rawDemo, qaLog:state.qaLog, scoreLog:state.scoreLog, warnings:state.warnings, employerVisualDna:employerDna, seriousExportAllowed:state.seriousExportAllowed, generatedAt:new Date().toISOString() }; zip.file('cv_suggere.md',cvPreview); zip.file('raw_profile.json',JSON.stringify(raw,null,2)); zip.file('match_report.json',JSON.stringify({score:state.score,subScores:state.subScores,interpretation:profile.matching.interpretation},null,2)); zip.file('questions_answers.json',JSON.stringify(state.qaLog,null,2)); zip.file('warnings.json',JSON.stringify(state.warnings,null,2)); zip.file('manifest.json',JSON.stringify({version:'0.9.1',type:serious?'serious_candidate_pack':'demo_raw_pack',files:['cv_suggere.md','raw_profile.json','match_report.json','questions_answers.json','warnings.json']},null,2)); const blob=await zip.generateAsync({type:'blob'}); downloadBlob(blob,`${base}_${profile.profileId}.zip`); }
function downloadBlob(blob,filename){ const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=filename; a.click(); URL.revokeObjectURL(a.href); }
createRoot(document.getElementById('root')).render(<App/>);
