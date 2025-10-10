import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Calendar, Clock, Briefcase, Download, AlertCircle } from 'lucide-react';
import sessionService from '../../services/sessionService';
import FeedbackReport from './FeedbackReport';
import AnalyticsCharts from './AnalyticsCharts';
import Button from '../common/Button';
import Card from '../common/Card';
import Loader from '../common/Loader';
import { formatDate, formatDuration, getErrorMessage, downloadJSON } from '../../utils/helpers';

/**
 * Session Detail Component - Shows complete session results with analytics
 */
const SessionDetail = () => {
  const { sessionId } = useParams();
  const navigate = useNavigate();

  const [session, setSession] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [activeTab, setActiveTab] = useState('feedback');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadSessionData();
  }, [sessionId]);

  const loadSessionData = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const [sessionData, analyticsData] = await Promise.all([
        sessionService.getSessionDetail(sessionId),
        sessionService.getSessionAnalytics(sessionId),
      ]);

      setSession(sessionData);
      setAnalytics(analyticsData);
    } catch (err) {
      console.error('Error loading session:', err);
      setError(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownloadReport = () => {
    if (session) {
      const reportData = {
        session: {
          position: session.position,
          company: session.company_name,
          date: session.session_date,
          duration: session.duration_minutes,
          overall_score: session.overall_score,
        },
        feedback: session.feedback,
        analytics: analytics,
      };

      downloadJSON(reportData, `interview-report-${sessionId}.json`);
    }
  };

  if (isLoading) {
    return <Loader fullScreen text="Loading session details..." />;
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="max-w-md">
          <div className="text-center py-8">
            <AlertCircle className="mx-auto text-red-600 mb-4" size={64} />
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Error Loading Session</h2>
            <p className="text-gray-600 mb-6">{error}</p>
            <Button variant="primary" onClick={() => navigate('/dashboard')}>
              Back to Dashboard
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between mb-4">
            <Button
              variant="ghost"
              icon={<ArrowLeft size={20} />}
              onClick={() => navigate('/dashboard')}
            >
              Back to Dashboard
            </Button>
            <Button
              variant="outline"
              icon={<Download size={20} />}
              onClick={handleDownloadReport}
            >
              Download Report
            </Button>
          </div>

          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">{session.position}</h1>
            {session.company_name && (
              <p className="text-lg text-gray-600 mb-4">{session.company_name}</p>
            )}

            <div className="flex flex-wrap gap-4 text-sm text-gray-600">
              <div className="flex items-center">
                <Calendar size={16} className="mr-2" />
                <span>{formatDate(session.session_date)}</span>
              </div>
              {session.duration_minutes && (
                <div className="flex items-center">
                  <Clock size={16} className="mr-2" />
                  <span>{formatDuration(session.duration_minutes)}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex space-x-8">
            <button
              onClick={() => setActiveTab('feedback')}
              className={`py-4 px-2 border-b-2 font-medium transition-colors ${
                activeTab === 'feedback'
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Feedback Report
            </button>
            <button
              onClick={() => setActiveTab('analytics')}
              className={`py-4 px-2 border-b-2 font-medium transition-colors ${
                activeTab === 'analytics'
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Analytics & Charts
            </button>
            <button
              onClick={() => setActiveTab('responses')}
              className={`py-4 px-2 border-b-2 font-medium transition-colors ${
                activeTab === 'responses'
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Q&A Transcript
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        {activeTab === 'feedback' && (
          <FeedbackReport feedback={session.feedback} onDownload={handleDownloadReport} />
        )}

        {activeTab === 'analytics' && <AnalyticsCharts analytics={session.feedback} />}

        {activeTab === 'responses' && (
          <div className="space-y-6">
            {session.responses && session.responses.length > 0 ? (
              session.responses.map((response, index) => (
                <Card key={index} title={`Question ${index + 1}`}>
                  <div className="space-y-4">
                    <div>
                      <p className="text-sm font-medium text-gray-700 mb-2">Question:</p>
                      <p className="text-gray-900">{response.question}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-700 mb-2">Your Answer:</p>
                      <p className="text-gray-700 whitespace-pre-line">{response.answer}</p>
                    </div>
                    {response.duration_seconds && (
                      <div className="text-sm text-gray-500">
                        Duration: {Math.round(response.duration_seconds)}s
                      </div>
                    )}
                  </div>
                </Card>
              ))
            ) : (
              <Card>
                <div className="text-center py-12 text-gray-500">
                  <p>No responses recorded for this session</p>
                </div>
              </Card>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default SessionDetail;