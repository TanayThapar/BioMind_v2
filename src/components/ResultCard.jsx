export default function ResultCard({ result, visible, delay = 0 }) {
  const scorePercent = Math.round(result.score * 100);

  return (
    <div
      className={`result-card ${visible ? 'result-card--visible' : ''}`}
      style={{ animationDelay: `${delay}ms` }}
      id={`result-${result.rank}`}
    >
      {/* Rank badge */}
      <div className="result-rank">
        <span className="result-rank__number">#{result.rank}</span>
      </div>

      {/* Drug header */}
      <div className="result-header">
        <div>
          <h3 className="result-drug-name">{result.drug}</h3>
          <p className="result-original-indication">
            Originally: <em>{result.originalIndication}</em>
          </p>
        </div>
        <div className="result-score-ring" style={{ '--score-color': result.tierColor }}>
          <svg viewBox="0 0 80 80" width="80" height="80">
            <circle cx="40" cy="40" r="32" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="6" />
            <circle
              cx="40"
              cy="40"
              r="32"
              fill="none"
              stroke={result.tierColor}
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={`${2 * Math.PI * 32}`}
              strokeDashoffset={`${2 * Math.PI * 32 * (1 - result.score)}`}
              transform="rotate(-90 40 40)"
              style={{ transition: 'stroke-dashoffset 1.2s ease' }}
            />
            <text x="40" y="45" textAnchor="middle" fontSize="16" fontWeight="700" fill="#fff">
              {scorePercent}
            </text>
          </svg>
          <span className="score-label">BES</span>
        </div>
      </div>

      {/* Tier badge */}
      <div className="result-tier-badge" style={{ '--tier-color': result.tierColor, background: `${result.tierColor}22`, borderColor: result.tierColor }}>
        {result.tier}
      </div>

      {/* Mechanism */}
      <div className="result-section">
        <div className="result-section__label">Mechanism of Action</div>
        <p className="result-mechanism">{result.mechanism}</p>
      </div>

      {/* Evidence */}
      <div className="result-section">
        <div className="result-section__label">Clinical Evidence</div>
        <p className="result-evidence">{result.evidence}</p>
      </div>

      {/* Metadata row */}
      <div className="result-meta-row">
        <div className="result-meta-item">
          <span className="result-meta-label">Target(s)</span>
          <span className="result-meta-value result-targets">{result.target}</span>
        </div>
        <div className="result-meta-item">
          <span className="result-meta-label">BBB Penetration</span>
          <span className={`result-meta-value ${result.bbp === true ? 'result-meta--positive' : result.bbp === false ? 'result-meta--negative' : ''}`}>
            {result.bbp === true ? '✓ Confirmed' : result.bbp === false ? '✗ Limited' : '— Unknown'}
          </span>
        </div>
        <div className="result-meta-item">
          <span className="result-meta-label">Citations</span>
          <span className="result-meta-value">{result.citations} papers</span>
        </div>
      </div>

      {/* Safety flag */}
      {result.safetyFlag && (
        <div className="result-safety-flag">
          <span className="safety-icon">⚠️</span>
          <span>{result.safetyFlag}</span>
        </div>
      )}

      {result.pmid && (
        <div className="result-citation">
          <span>Key reference: </span>
          <a
            href={`https://www.ncbi.nlm.nih.gov/pmc/articles/${result.pmid}/`}
            target="_blank"
            rel="noopener noreferrer"
            className="result-pmid-link"
          >
            {result.pmid}
          </a>
        </div>
      )}
    </div>
  );
}
