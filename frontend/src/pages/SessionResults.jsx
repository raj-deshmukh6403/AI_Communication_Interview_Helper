import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, AlertCircle } from 'lucide-react';
import sessionService from '../services/sessionService';
import FeedbackReport from '../components/analytics/FeedbackReport';
import AnalyticsCharts from '../components/analytics/AnalyticsCharts';
import SessionDetail from '../components/analytics/SessionDetail';
import Loader from '../components/common/Loader';
import Button from '../components/common/Button';

const SessionResults = () => {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const [session, setSession] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('feedback');

  useEffect(() => {
    const load = async () => {
      try {
        const data = await sessionService.getSessionDetail(sessionId);
        setSession(data);
      } catch (err) {
        setError('Failed to load session results.');
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [sessionId]);

  if (isLoading) return <Loader fullScreen text="Loading your results..." />;

  if (error) return (
    <div className="max-w-3xl mx-auto px-4 py-12 text-center">
      <AlertCircle size={48} className="mx-auto text-red-500 mb-4" />
      <p className="text-red-600 mb-4">{error}</p>
      <Button onClick={() => navigate('/dashboard')}>Back to Dashboard</Button>
    </div>
  );

  const tabs = [
    { id: 'feedback',  label: '📊 Feedback Report' },
    { id: 'charts',    label: '📈 Analytics Charts' },
    { id: 'responses', label: '💬 Per-Question Detail' },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/dashboard')} className="text-gray-500 hover:text-gray-700">
            <ArrowLeft size={24} />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {session?.session_name || `${session?.position} Session`}
            </h1>
            <p className="text-gray-500 text-sm">
              {session?.status === 'completed' ? '✅ Completed' : session?.status}
              {session?.duration_minutes && ` · ${Math.round(session.duration_minutes)} min`}
              {session?.overall_score && ` · Score: ${Math.round(session.overall_score)}/100`}
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-8 border-b border-gray-200">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'feedback' && (
        <FeedbackReport feedback={session?.feedback} />
      )}
      {activeTab === 'charts' && (
        <AnalyticsCharts timelineData={session?.feedback?.timeline_data} />
      )}
      {activeTab === 'responses' && (
        <SessionDetail responses={session?.responses || []} />
      )}
    </div>
  );
};

export default SessionResults;