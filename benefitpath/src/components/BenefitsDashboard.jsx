import { useState } from 'react';
import { generateSnapPDF, downloadPDF } from '../utils/pdfGenerator.js';

const STATUS_CONFIG = {
  yes: { label: 'Likely Eligible', cls: 'status-yes', dot: '●' },
  no: { label: 'Likely Not Eligible', cls: 'status-no', dot: '●' },
  maybe: { label: 'May Qualify', cls: 'status-maybe', dot: '●' },
};

export default function BenefitsDashboard({ results, extractedData, onReset }) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [pdfError, setPdfError] = useState(null);
  const [pdfSuccess, setPdfSuccess] = useState(false);

  const eligibleCount = results.filter(r => r.eligible === 'yes').length;
  const maybeCount = results.filter(r => r.eligible === 'maybe').length;

  async function handleDownloadPDF() {
    setIsGenerating(true);
    setPdfError(null);
    setPdfSuccess(false);
    try {
      const bytes = await generateSnapPDF(extractedData);
      downloadPDF(bytes);
      setPdfSuccess(true);
    } catch (err) {
      console.error('PDF generation failed:', err);
      setPdfError('Could not generate PDF. Please try again.');
    } finally {
      setIsGenerating(false);
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
            <h3>Ready to apply for SNAP food assistance?</h3>
            <p>We've pre-filled a Pennsylvania SNAP application (PA 600 FS) with your information. Download it, review it, sign it, and bring or mail it to your county assistance office.</p>
          </div>
        </div>
        <button
          className={`btn-download ${isGenerating ? 'btn-loading' : ''}`}
          onClick={handleDownloadPDF}
          disabled={isGenerating}
        >
          {isGenerating ? (
            <><span className="spinner" /> Generating your PDF…</>
          ) : (
            <>📥 Download My SNAP Application</>
          )}
        </button>
        {pdfSuccess && (
          <p className="pdf-success">✅ Your PDF was generated and downloaded! Review, sign, and submit it to your county office.</p>
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
