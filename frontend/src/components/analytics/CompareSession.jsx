import React, { useState } from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import sessionService from '../../services/sessionService';
import Card from '../common/Card';
import Button from '../common/Button';
import Loader from '../common/Loader';

const CompareSession = ({ sessions = [] }) => {
  const [session1Id, setSession1Id] = useState('');
  const [session2Id, setSession2Id] = useState('');
  const [result, setResult] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleCompare = async () => {
    if (!session1Id || !session2Id) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await sessionService.compareSessions(session1Id, session2Id);
      setResult(data);
    } catch (err) {
      setError('Failed to compare sessions.');
    } finally {
      setIsLoading(false);
    }
  };

  const completedSessions = sessions.filter(s => s.status === 'completed');

  return (
    <div className="space-y-6">
      <Card title="Compare Two Sessions">
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Session 1</label>
            <select
              value={session1Id}
              onChange={e => setSession1Id(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            >
              <option value="">Select session...</option>
              {completedSessions.map(s => (
                <option key={s.id} value={s.id}>
                  {s.session_name || s.position} — Score: {Math.round(s.overall_score || 0)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Session 2</label>
            <select
              value={session2Id}
              onChange={e => setSession2Id(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            >
              <option value="">Select session...</option>
              {completedSessions.map(s => (
                <option key={s.id} value={s.id}>
                  {s.session_name || s.position} — Score: {Math.round(s.overall_score || 0)}
                </option>
              ))}
            </select>
          </div>
        </div>
        <Button
          variant="primary"
          onClick={handleCompare}
          disabled={!session1Id || !session2Id || session1Id === session2Id || isLoading}
        >
          Compare Sessions
        </Button>
      </Card>

      {isLoading && <Loader text="Comparing sessions..." />}
      {error && <p className="text-red-500 text-sm">{error}</p>}

      {result && (
        <div className="space-y-4">
          {/* Overall */}
          <Card title="Overall Score Change">
            <div className="flex items-center gap-4">
              <div className="text-center">
                <p className="text-xs text-gray-500">{result.session1.session_name || 'Session 1'}</p>
                <p className="text-3xl font-bold text-gray-800">{Math.round(result.session1.overall_score)}</p>
              </div>
              <div className="flex-1 text-center">
                {result.overall_improvement.score_change > 0 ? (
                  <TrendingUp className="mx-auto text-green-500" size={32} />
                ) : result.overall_improvement.score_change < 0 ? (
                  <TrendingDown className="mx-auto text-red-500" size={32} />
                ) : (
                  <Minus className="mx-auto text-gray-400" size={32} />
                )}
                <p className={`font-bold text-lg ${result.overall_improvement.score_change > 0 ? 'text-green-600' : result.overall_improvement.score_change < 0 ? 'text-red-600' : 'text-gray-500'}`}>
                  {result.overall_improvement.score_change > 0 ? '+' : ''}{result.overall_improvement.score_change.toFixed(1)}
                </p>
              </div>
              <div className="text-center">
                <p className="text-xs text-gray-500">{result.session2.session_name || 'Session 2'}</p>
                <p className="text-3xl font-bold text-gray-800">{Math.round(result.session2.overall_score)}</p>
              </div>
            </div>
          </Card>

          {/* Metrics table */}
          {Object.keys(result.metrics_comparison).length > 0 && (
            <Card title="Metrics Comparison">
              <div className="space-y-3">
                {Object.entries(result.metrics_comparison).map(([metric, data]) => (
                  <div key={metric} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                    <span className="text-sm text-gray-600 font-medium w-40">{metric}</span>
                    <span className="text-sm text-gray-500 w-16 text-center">{data.session1_value}</span>
                    <span className={`text-sm font-bold w-20 text-center ${data.change > 0 ? 'text-green-600' : data.change < 0 ? 'text-red-600' : 'text-gray-400'}`}>
                      {data.change > 0 ? '▲ ' : data.change < 0 ? '▼ ' : '— '}{Math.abs(data.change).toFixed(1)}
                    </span>
                    <span className="text-sm text-gray-500 w-16 text-center">{data.session2_value}</span>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      )}
    </div>
  );
};

export default CompareSession;