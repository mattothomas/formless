import { useState } from 'react';
import { generateSnapPDF, generateMedicaidPDF, downloadPDF } from '../utils/pdfGenerator.js';

const STATUS_CONFIG = {
  yes: { label: 'Likely Eligible', cls: 'status-yes', dot: '●' },
  no: { label: 'Likely Not Eligible', cls: 'status-no', dot: '●' },
  maybe: { label: 'May Qualify', cls: 'status-maybe', dot: '●' },
};

export default function BenefitsDashboard({ results, extractedData, onReset }) {
  const [generatingSnap, setGeneratingSnap]         = useState(false);
  const [generatingMedicaid, setGeneratingMedicaid] = useState(false);
  const [pdfError, setPdfError]                     = useState(null);
  const [snapSuccess, setSnapSuccess]               = useState(false);
  const [medicaidSuccess, setMedicaidSuccess]       = useState(false);

  const eligibleCount = results.filter(r => r.eligible === 'yes').length;
  const maybeCount    = results.filter(r => r.eligible === 'maybe').length;

  const medicaidResult = results.find(r =>
    r.program === 'Medicaid' || r.program === 'CHIP' || r.programName?.toLowerCase().includes('medicaid')
  );
  const showMedicaid = medicaidResult && medicaidResult.eligible !== 'no';

  async function handleDownloadSnap() {
    setGeneratingSnap(true);
    setPdfError(null);
    setSnapSuccess(false);
    try {
      const bytes = await generateSnapPDF(extractedData);
      downloadPDF(bytes, 'PA-SNAP-Application.pdf');
      setSnapSuccess(true);
    } catch (err) {
      console.error('SNAP PDF failed:', err);
      setPdfError('Could not generate SNAP PDF. Please try again.');
    } finally {
      setGeneratingSnap(false);
    }
  }

  async function handleDownloadMedicaid() {
    setGeneratingMedicaid(true);
    setPdfError(null);
    setMedicaidSuccess(false);
    try {
      const bytes = await generateMedicaidPDF(extractedData);
      downloadPDF(bytes, 'PA-Medicaid-Application.pdf');
      setMedicaidSuccess(true);
    } catch (err) {
      console.error('Medicaid PDF failed:', err);
      setPdfError('Could not generate Medicaid PDF. Please try again.');
    } finally {
      setGeneratingMedicaid(false);
    }
  }

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <div className="dashboard-emoji">🎉</div>
        <h2>Your Benefits Results</h2>
        <p className="dashboard-subtitle">
          Based on what you shared, here's what you may qualify for in Pennsylvania.
        </p>
        <div className="summary-pills">
          {eligibleCount > 0 && (
            <span className="pill pill-green">{eligibleCount} program{eligibleCount > 1 ? 's' : ''} you likely qualify for</span>
          )}
          {maybeCount > 0 && (
            <span className="pill pill-yellow">{maybeCount} to check</span>
          )}
        </div>
      </div>

      <div className="benefits-grid">
        {results.map((result) => {
          const config = STATUS_CONFIG[result.eligible] || STATUS_CONFIG.maybe;
          return (
            <div key={result.program} className={`benefit-card ${result.eligible === 'yes' ? 'card-yes' : result.eligible === 'no' ? 'card-no' : 'card-maybe'}`}>
              <div className="card-header">
                <span className="card-icon">{result.icon}</span>
                <div>
                  <h3 className="card-title">{result.programName}</h3>
                  <span className={`status-badge ${config.cls}`}>
                    <span className="status-dot">{config.dot}</span>
                    {config.label}
                    {result.confidence ? ` · ${result.confidence}% confidence` : ''}
                  </span>
                </div>
              </div>
              <p className="card-reason">{result.reason}</p>
              {result.urgent && (
                <div className="urgent-banner">
                  <span>⚠️</span> Time-sensitive — apply now!
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="pdf-section">
        <div className="pdf-box">
          <div className="pdf-icon">📄</div>
          <div className="pdf-text">
            <h3>Download your pre-filled applications</h3>
            <p>We've pre-filled your Pennsylvania benefit applications with your information. Download, review, sign, and submit to your county assistance office.</p>
          </div>
        </div>

        <button
          className="btn-download"
          disabled={true}
          style={{ opacity: 0.45, cursor: 'not-allowed' }}
          title="SNAP PDF coming soon"
        >
          📥 Download My SNAP Application
        </button>
        <p style={{ fontSize: '0.8rem', color: '#888', marginTop: '0.25rem' }}>SNAP form available at your county office</p>

        {showMedicaid && (
          <>
            <button
              className={`btn-download btn-download-medicaid ${generatingMedicaid ? 'btn-loading' : ''}`}
              onClick={handleDownloadMedicaid}
              disabled={generatingMedicaid}
              style={{ marginTop: '0.75rem' }}
            >
              {generatingMedicaid ? (
                <><span className="spinner" /> Generating…</>
              ) : (
                <>📥 Download My Medicaid Application</>
              )}
            </button>
            {medicaidSuccess && (
              <p className="pdf-success">✅ Medicaid application downloaded! Review, sign, and submit to your county office.</p>
            )}
          </>
        )}

        {pdfError && (
          <p className="pdf-error">⚠️ {pdfError}</p>
        )}
        <p className="pdf-note">
          Your answers are saved. You can close this browser and come back on any device to pick up where you left off.
        </p>
      </div>

      <div className="next-steps">
        <h3>Next Steps</h3>
        <ol>
          <li><strong>Download and review</strong> your pre-filled SNAP application above</li>
          <li><strong>Sign and date</strong> the last page</li>
          <li><strong>Submit</strong> online at <a href="https://www.compass.state.pa.us" target="_blank" rel="noopener noreferrer">compass.state.pa.us</a>, by mail, or in person at your county DHS office</li>
          <li>For LIHEAP heating help, call <strong>1-800-692-7462</strong> or visit your county assistance office <em>before May 8, 2026</em></li>
          <li>For WIC, call <strong>1-800-WIC-WINS</strong> to find your nearest clinic</li>
        </ol>
      </div>

      <button className="btn-restart" onClick={onReset}>
        Start a new session
      </button>
    </div>
  );
}
