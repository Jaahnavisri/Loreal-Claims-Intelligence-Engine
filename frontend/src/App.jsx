import React, { useState } from 'react';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api';

export default function App() {
  const [claimText, setClaimText] = useState('Reduces wrinkles by 20% in 4 weeks');
  const [productName, setProductName] = useState('Revitalift Clinical Serum');
  const [evidence, setEvidence] = useState('A randomized, double-blind, vehicle-controlled study enrolled 120 adults aged 40–65. After 4 weeks, the active group showed a mean 18% reduction in wrinkle area versus baseline, measured by 3D imaging. The vehicle group showed a 5% reduction. The between-group difference was statistically significant (p=0.03).');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const response = await fetch(`${API_URL}/claims/assess`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ claimText, productName: productName || undefined, evidence }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message ?? 'Assessment request failed');
      setResult(payload);
    } catch (err) {
      setError(err.message || 'Could not reach the API. Check that the backend is running.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="shell">
      <header className="topbar"><span className="brand-mark">L</span><span>L’ORÉAL <i>R&I</i></span><span className="topbar-label">CLAIMS INTELLIGENCE</span></header>
      <section className="intro">
        <p className="eyebrow">EVIDENCE REVIEW · PARIS R&I</p>
        <h1>Does the evidence<br /><em>support the claim?</em></h1>
        <p className="lede">Compare a proposed product claim with clinical study evidence. The assessment is saved for evaluator review.</p>
      </section>

      <div className="workspace">
        <form className="form-card" onSubmit={submit}>
          <div className="card-heading"><span className="step">01</span><div><h2>Study submission</h2><p>Provide the claim and a concise evidence summary.</p></div></div>
          <label>PRODUCT NAME <span>OPTIONAL</span><input value={productName} onChange={(e) => setProductName(e.target.value)} placeholder="e.g. Revitalift Serum" maxLength={200} /></label>
          <label>PROPOSED CLAIM<textarea required minLength={10} maxLength={1000} rows={2} value={claimText} onChange={(e) => setClaimText(e.target.value)} placeholder="What should the product claim?" /></label>
          <label>CLINICAL STUDY EVIDENCE<textarea required minLength={30} maxLength={12000} rows={8} value={evidence} onChange={(e) => setEvidence(e.target.value)} placeholder="Study design, population, endpoint, results, duration, and limitations…" /></label>
          <button className="submit" disabled={loading}>{loading ? 'Reviewing evidence…' : 'Assess claim'} <span aria-hidden="true">↗</span></button>
          <p className="form-note">AI-generated decision support. A qualified evaluator must make the final determination.</p>
        </form>

        <section className="result-card" aria-live="polite">
          <div className="card-heading"><span className="step">02</span><div><h2>Assessment</h2><p>Evidence alignment and evaluator context.</p></div></div>
          {!result && !error && <div className="empty-state"><div className="document-icon">⌁</div><h3>Ready for review</h3><p>Submit a claim and study summary to see the assessment.</p></div>}
          {loading && <div className="empty-state"><div className="spinner" /><h3>Reviewing evidence</h3><p>Comparing the study results with the exact claim.</p></div>}
          {error && <div className="error-box"><strong>Assessment unavailable</strong><p>{error}</p></div>}
          {result && <div className="assessment">
            <div className={`verdict ${result.justified ? 'yes' : 'no'}`}><span className="verdict-dot" />{result.justified ? 'JUSTIFIED' : 'NOT JUSTIFIED'}<span className="verdict-caption">MODEL ASSESSMENT</span></div>
            <div className="confidence"><span>CONFIDENCE</span><strong>{Math.round(result.confidenceScore * 100)}<small>%</small></strong><div className="meter"><span style={{ width: `${Math.round(result.confidenceScore * 100)}%` }} /></div></div>
            <div className="reason-block"><h3>Reasoning</h3><p>{result.reasoning}</p></div>
            <div className="reason-block limitations"><h3>Limitations to review</h3><p>{result.limitations}</p></div>
            <p className="record-id">SAVED ASSESSMENT · {result.assessmentId}</p>
          </div>}
        </section>
      </div>
      <footer>INTERNAL PROTOTYPE <span>·</span> HUMAN EVALUATOR REVIEW REQUIRED</footer>
    </main>
  );
}

