import { formatOdds, formatDate, formatTime } from '../utils/formatters';

export default function MatchCard({ match, onOddsClick }) {
  const getStatusBadge = () => {
    switch (match.status) {
      case 'live': return <span className="badge badge-live">● LIVE</span>;
      case 'upcoming': return <span className="badge badge-upcoming">Upcoming</span>;
      case 'completed': return <span className="badge badge-completed">Completed</span>;
      default: return null;
    }
  };

  const handleOddsClick = (selection, type, odds) => {
    if (match.status === 'completed' || !odds || odds === 0) return;
    onOddsClick?.({
      match,
      selection,
      betType: type,
      odds,
    });
  };

  return (
    <div className="match-card">
      <div className="match-card-header">
        <div className="match-league">
          <span>🏏</span>
          <span>{match.league}</span>
          <span className="match-time">{formatDate(match.startTime)} • {formatTime(match.startTime)}</span>
        </div>
        <div className="match-badges">
          {getStatusBadge()}
        </div>
      </div>

      <div className="match-card-body">
        <div className="match-teams">
          <div className="match-team">
            <div className="match-team-name">{match.teamA}</div>
            {match.scoreA && <div className="match-team-score">{match.scoreA}</div>}
          </div>
          <div className="match-vs">VS</div>
          <div className="match-team">
            <div className="match-team-name">{match.teamB}</div>
            {match.scoreB && <div className="match-team-score">{match.scoreB}</div>}
          </div>
        </div>

        {match.result && (
          <div className="match-result">{match.result}</div>
        )}

        <div className="odds-grid">
          <div className="odds-column">
            <div className="odds-label">{match.teamA}</div>
            <div className="odds-buttons">
              <button
                className="odds-btn back"
                onClick={() => handleOddsClick('teamA', 'back', match.oddsTeamA?.back)}
                disabled={match.status === 'completed' || !match.oddsTeamA?.back}
              >
                {formatOdds(match.oddsTeamA?.back)}
              </button>
              <button
                className="odds-btn lay"
                onClick={() => handleOddsClick('teamA', 'lay', match.oddsTeamA?.lay)}
                disabled={match.status === 'completed' || !match.oddsTeamA?.lay}
              >
                {formatOdds(match.oddsTeamA?.lay)}
              </button>
            </div>
          </div>

          {match.oddsDraw?.back > 0 && (
            <div className="odds-column">
              <div className="odds-label">Draw</div>
              <div className="odds-buttons">
                <button
                  className="odds-btn back"
                  onClick={() => handleOddsClick('draw', 'back', match.oddsDraw?.back)}
                  disabled={match.status === 'completed'}
                >
                  {formatOdds(match.oddsDraw?.back)}
                </button>
                <button
                  className="odds-btn lay"
                  onClick={() => handleOddsClick('draw', 'lay', match.oddsDraw?.lay)}
                  disabled={match.status === 'completed'}
                >
                  {formatOdds(match.oddsDraw?.lay)}
                </button>
              </div>
            </div>
          )}

          <div className="odds-column">
            <div className="odds-label">{match.teamB}</div>
            <div className="odds-buttons">
              <button
                className="odds-btn back"
                onClick={() => handleOddsClick('teamB', 'back', match.oddsTeamB?.back)}
                disabled={match.status === 'completed' || !match.oddsTeamB?.back}
              >
                {formatOdds(match.oddsTeamB?.back)}
              </button>
              <button
                className="odds-btn lay"
                onClick={() => handleOddsClick('teamB', 'lay', match.oddsTeamB?.lay)}
                disabled={match.status === 'completed' || !match.oddsTeamB?.lay}
              >
                {formatOdds(match.oddsTeamB?.lay)}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
