import React, { useEffect, useState } from 'react';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api';
const studyInputs = [
  ['minParticipantAge', 'Study participant min age', 'number'], ['maxParticipantAge', 'Study participant max age', 'number'],
  ['sampleSize', 'Sample size', 'number'], ['location', 'Study location'], ['duration', 'Study duration'],
  ['studyType', 'Study type'], ['studyConditions', 'Study conditions'], ['outcomeMeasure', 'Outcome measure'],
  ['genderDistribution', 'Gender distribution'], ['skinType', 'Skin type'], ['season', 'Season'], ['measurementMethod', 'Measurement method'],
];
const blankStudy = Object.fromEntries(studyInputs.map(([key]) => [key, '']));

async function api(path, options) {
  const response = await fetch(`${API_URL}${path}`, options);
  const payload = await response.json();
  if (!response.ok) {
    const error = new Error(payload.message ?? 'Request failed');
    error.claimId = payload.claimId;
    throw error;
  }
  return payload;
}

export default function App() {
  const [claimText, setClaimText] = useState('Reduces wrinkles by 20% in 4 weeks');
  const [productName, setProductName] = useState('Revitalift Clinical Serum');
  const [audience, setAudience] = useState({ minAge: '40', maxAge: '65', description: 'Adults with visible facial wrinkles' });
  const [evidence, setEvidence] = useState('A randomized, double-blind, vehicle-controlled study enrolled 120 adults aged 40–65. After 4 weeks, the active group showed a mean 18% reduction in wrinkle area versus baseline, measured by 3D imaging. The vehicle group showed a 5% reduction. The between-group difference was statistically significant (p=0.03).');
  const [study, setStudy] = useState({ ...blankStudy, minParticipantAge: '40', maxParticipantAge: '65', sampleSize: '120', duration: '4 weeks', studyType: 'Randomized, double-blind, vehicle-controlled', outcomeMeasure: 'Wrinkle area reduction', measurementMethod: '3D imaging' });
  const [studyVersion, setStudyVersion] = useState('');
  const [claimId, setClaimId] = useState('');
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);
  const [audit, setAudit] = useState([]);
  const [selected, setSelected] = useState('');
  const [comparison, setComparison] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [review, setReview] = useState({ reviewerName: '', decision: 'ACCEPTED', comments: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function refreshClaim(id) {
    const [assessments, auditHistory] = await Promise.all([
      api(`/claims/${id}/assessments`), api(`/claims/${id}/audit-history`),
    ]);
    setHistory(assessments);
    setAudit(auditHistory);
  }

  useEffect(() => {
    if (!selected) { setReviews([]); return; }
    api(`/assessments/${selected}/reviews`).then(setReviews).catch((err) => setError(err.message));
  }, [selected]);

  async function submit(event) {
    event.preventDefault(); setLoading(true); setError(''); setComparison(null);
    try {
      const payload = await api('/claims/assess', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(claimId ? { claimId } : {}), claimText, productName: productName || undefined,
          targetAudience: { minAge: audience.minAge === '' ? undefined : Number(audience.minAge), maxAge: audience.maxAge === '' ? undefined : Number(audience.maxAge), description: audience.description || undefined },
          evidence, studyVersion: studyVersion || undefined,
          studyMetadata: Object.fromEntries(Object.entries(study).map(([key, value]) => [key, value === '' ? undefined : ['minParticipantAge', 'maxParticipantAge', 'sampleSize'].includes(key) ? Number(value) : value])),
        }),
      });
      setClaimId(payload.claim.id); setResult(payload); setSelected(payload.assessment.id);
      await refreshClaim(payload.claim.id);
    } catch (err) { if (err.claimId) { setClaimId(err.claimId); refreshClaim(err.claimId).catch(() => {}); } setError(err.message || 'Could not reach the API. Check that the backend is running.'); }
    finally { setLoading(false); }
  }

  function startNewClaim() {
    setClaimId(''); setResult(null); setHistory([]); setAudit([]); setSelected(''); setComparison(null); setError('');
  }

  async function compareWithPrevious() {
    if (history.length < 2 || !selected) return;
    const previous = history.find((item) => item.id !== selected);
    if (!previous) return;
    try { setComparison(await api(`/claims/${claimId}/assessments/compare?previousId=${previous.id}&currentId=${selected}`)); }
    catch (err) { setError(err.message); }
  }

  async function submitReview(event) {
    event.preventDefault(); setError('');
    try {
      await api(`/assessments/${selected}/reviews`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(review) });
      setReviews(await api(`/assessments/${selected}/reviews`));
      await refreshClaim(claimId);
      setReview({ reviewerName: '', decision: 'ACCEPTED', comments: '' });
    } catch (err) { setError(err.message); }
  }

  const assessment = history.find((item) => item.id === selected) ?? result?.assessment;
  const statusClass = (status) => status === 'MATCHED' ? 'matched' : status === 'DIFFERENCE_FOUND' ? 'different' : 'missing';

  return <main className="shell">
    <header className="topbar"><span className="brand-mark">L</span><span>L’ORÉAL <i>R&I</i></span><span className="topbar-label">CLAIMS INTELLIGENCE</span></header>
    <section className="intro"><p className="eyebrow">EVIDENCE REVIEW · PARIS R&I</p><h1>Does the evidence<br/><em>support the claim?</em></h1><p className="lede">Compare a proposed product claim with clinical study evidence. AI provides advisory decision support; an evaluator makes the final determination.</p></section>
    <div className="workspace">
      <form className="form-card" onSubmit={submit}>
        <div className="card-heading"><span className="step">01</span><div><h2>Study submission</h2><p>Claim and study information are saved as a versioned record.</p></div></div>
        {claimId && <div className="active-claim">ADDING A STUDY TO THIS CLAIM <button type="button" onClick={startNewClaim}>Start new claim</button></div>}
        <label>PRODUCT NAME <span>OPTIONAL</span><input value={productName} onChange={(e) => setProductName(e.target.value)} maxLength={200} /></label>
        <label>PROPOSED CLAIM<textarea required minLength={10} maxLength={1000} rows={2} value={claimText} onChange={(e) => setClaimText(e.target.value)} /></label>
        <div className="subheading">TARGET AUDIENCE</div>
        <div className="field-grid"><label>MINIMUM AGE<input type="number" min="0" max="120" value={audience.minAge} onChange={(e) => setAudience({ ...audience, minAge: e.target.value })}/></label><label>MAXIMUM AGE<input type="number" min="0" max="120" value={audience.maxAge} onChange={(e) => setAudience({ ...audience, maxAge: e.target.value })}/></label></div>
        <label>AUDIENCE DESCRIPTION<input value={audience.description} onChange={(e) => setAudience({ ...audience, description: e.target.value })} maxLength={500}/></label>
        <div className="subheading">STUDY DETAILS <span>OPTIONAL WHEN UNKNOWN</span></div>
        <div className="field-grid">{studyInputs.map(([key, label, type = 'text']) => <label key={key}>{label.toUpperCase()}<input type={type} min={type === 'number' ? '0' : undefined} value={study[key]} onChange={(e) => setStudy({ ...study, [key]: e.target.value })}/></label>)}</div>
        <label>STUDY VERSION <span>OPTIONAL</span><input value={studyVersion} onChange={(e) => setStudyVersion(e.target.value)} placeholder="e.g. Protocol 2" maxLength={120}/></label>
        <label>CLINICAL STUDY EVIDENCE<textarea required minLength={30} maxLength={12000} rows={7} value={evidence} onChange={(e) => setEvidence(e.target.value)} placeholder="Study design, results, duration, and limitations…"/></label>
        <button className="submit" disabled={loading}>{loading ? 'Reviewing evidence…' : claimId ? 'Assess new study version' : 'Assess claim'} <span>↗</span></button>
        <p className="form-note">Confidence is model-reported, not a clinical probability. AI results never constitute regulatory approval or launch authorization.</p>
      </form>

      <section className="result-card" aria-live="polite">
        <div className="card-heading"><span className="step">02</span><div><h2>Assessment</h2><p>Advisory result, evidence gaps, and evaluator actions.</p></div></div>
        {!assessment && !error && <div className="empty-state"><div className="document-icon">⌁</div><h3>Ready for review</h3><p>Submit a claim and study summary to see the assessment.</p></div>}
        {loading && <div className="empty-state"><div className="spinner"/><h3>Reviewing evidence</h3><p>Comparing study results with the exact claim.</p></div>}
        {error && <div className="error-box"><strong>Assessment unavailable</strong><p>{error}</p></div>}
        {assessment && <div className="assessment">
          <div className={`verdict ${assessment.assessmentStatus.toLowerCase()}`}><span className="verdict-dot"/>{assessment.assessmentStatus.replaceAll('_', ' ')}<span className="verdict-caption">AI ADVISORY</span></div>
          {assessment.reviewRequired && <div className="review-required">Human evaluator review required</div>}
          <div className="confidence"><span>MODEL-REPORTED CONFIDENCE</span><strong>{Math.round(assessment.confidenceScore * 100)}<small>%</small></strong><div className="meter"><span style={{ width: `${Math.round(assessment.confidenceScore * 100)}%` }}/></div></div>
          <div className="reason-block"><h3>Reasoning</h3><p>{assessment.reasoning}</p></div>
          {!!assessment.evidenceGaps?.length && <div className="reason-block"><h3>Evidence gaps</h3><ul>{assessment.evidenceGaps.map((gap, i) => <li key={i}>{gap}</li>)}</ul></div>}
          <div className="reason-block limitations"><h3>Limitations</h3>{assessment.limitations.length ? <ul>{assessment.limitations.map((item, i) => <li key={i}>{item}</li>)}</ul> : <p>No additional limitations reported.</p>}</div>
          <div className="reason-block"><h3>Recommendation</h3><p>{assessment.recommendation}</p></div>
          <p className="record-id">{assessment.studyVersion} · SAVED ASSESSMENT · {assessment.id}</p>
          {result?.audienceFindings?.length > 0 && <Findings title="Audience and study population" findings={result.audienceFindings} statusClass={statusClass}/>}
          <div className="history-block"><div className="subheading">ASSESSMENT HISTORY ({history.length})</div>
            <select value={selected} onChange={(e) => setSelected(e.target.value)}>{history.map((item) => <option key={item.id} value={item.id}>{item.studyVersion} · {item.assessmentStatus} · {new Date(item.createdAt).toLocaleString()}</option>)}</select>
            {history.length > 1 && <button className="secondary" type="button" onClick={compareWithPrevious}>Compare selected with previous study</button>}
          </div>
          {comparison && <Findings title={`Study changes: ${comparison.previous.studyVersion} → ${comparison.current.studyVersion}`} findings={comparison.findings} statusClass={statusClass}/>}
          <div className="review-block"><div className="subheading">HUMAN EVALUATOR REVIEW</div>
            <form onSubmit={submitReview}><label>REVIEWER NAME<input required minLength={2} maxLength={120} value={review.reviewerName} onChange={(e) => setReview({ ...review, reviewerName: e.target.value })}/></label><label>DECISION<select value={review.decision} onChange={(e) => setReview({ ...review, decision: e.target.value })}><option value="ACCEPTED">Accept assessment</option><option value="REJECTED">Reject assessment</option><option value="MORE_EVIDENCE_REQUIRED">Request more evidence</option></select></label>{review.decision !== 'ACCEPTED' && <label>REASON / REQUESTED EVIDENCE<textarea required minLength={5} maxLength={2000} value={review.comments} onChange={(e) => setReview({ ...review, comments: e.target.value })}/></label>}<button className="secondary">Save review decision</button></form>
            {reviews.map((item) => <div className="review-item" key={item.id}><strong>{item.decision.replaceAll('_', ' ')}</strong><span>{item.reviewerName} · {new Date(item.createdAt).toLocaleString()}</span>{item.comments && <p>{item.comments}</p>}</div>)}
          </div>
          <div className="history-block"><div className="subheading">ACTIVITY TIMELINE</div>{audit.map((item) => <div className="timeline-item" key={item.id}><strong>{item.action.replaceAll('_', ' ')}</strong><span>{new Date(item.createdAt).toLocaleString()}</span></div>)}</div>
        </div>}
      </section>
    </div>
    <footer>INTERNAL PROTOTYPE <span>·</span> HUMAN EVALUATOR REVIEW REQUIRED</footer>
  </main>;
}

function Findings({ title, findings, statusClass }) {
  return <div className="findings"><div className="subheading">{title}</div>{findings.map((item) => <div className="finding" key={item.field}><div><strong>{item.label}</strong><span className={`finding-status ${statusClass(item.status)}`}>{item.status.replaceAll('_', ' ')}</span></div><p>{item.explanation}</p>{(item.previousValue !== null || item.currentValue !== null) && <small>Previous: {item.previousValue ?? 'Missing'} · Current: {item.currentValue ?? 'Missing'}</small>}</div>)}</div>;
}
