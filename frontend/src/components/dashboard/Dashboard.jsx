import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { PlusCircle, TrendingUp, Clock, Award, AlertCircle } from 'lucide-react';
import sessionService from '../../services/sessionService';
import { useAuthContext } from '../../context/AuthContext';
import SessionCard from './SessionCard';
import ProgressChart from './ProgressChart';
import Card from '../common/Card';
import Button from '../common/Button';
import Loader from '../common/Loader';
import { formatDuration, getErrorMessage } from '../../utils/helpers';

/**
 * Main Dashboard Component
 */
const Dashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuthContext();

  const [sessions, setSessions] = useState([]);
  const [stats, setStats] = useState(null);
  const [weakAreas, setWeakAreas] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Load dashboard data
  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Load sessions and stats in parallel
      const [sessionsData, statsData, weakAreasData] = await Promise.all([
        sessionService.getSessions(10, 0),
        sessionService.getProgressStats(),
        sessionService.getWeakAreas(3),
      ]);

      setSessions(sessionsData);
      setStats(statsData);
      setWeakAreas(weakAreasData.weak_areas || []);
    } catch (err) {
      console.error('Error loading dashboard:', err);
      setError(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  // Handle session deletion
  const handleDeleteSession = async (sessionId) => {
    try {
      await sessionService.deleteSession(sessionId);
      
      // Remove from local state
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      
      // Reload stats
      const statsData = await sessionService.getProgressStats();
      setStats(statsData);
    } catch (err) {
      console.error('Error deleting session:', err);
      alert(getErrorMessage(err));
    }
  };

  if (isLoading) {
    return <Loader fullScreen text="Loading dashboard..." />;
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 flex items-start">
          <AlertCircle className="text-red-600 mr-3 flex-shrink-0" size={24} />
          <div>
            <h3 className="text-red-800 font-semibold mb-2">Error Loading Dashboard</h3>
            <p className="text-red-700">{error}</p>
            <Button
              variant="danger"
              size="sm"
              onClick={loadDashboardData}
              className="mt-4"
            >
              Try Again
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Welcome Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Welcome back, {user?.full_name?.split(' ')[0]}! 👋
        </h1>
        <p className="text-gray-600">
          Ready to practice your interview skills today?
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <Card padding="md" className="bg-gradient-to-br from-blue-500 to-blue-600 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-100 text-sm mb-1">Total Sessions</p>
              <p className="text-3xl font-bold">{stats?.total_sessions || 0}</p>
            </div>
            <Award size={40} className="text-blue-200" />
          </div>
        </Card>

        <Card padding="md" className="bg-gradient-to-br from-green-500 to-green-600 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-green-100 text-sm mb-1">Average Score</p>
              <p className="text-3xl font-bold">{Math.round(stats?.average_score || 0)}</p>
            </div>
            <TrendingUp size={40} className="text-green-200" />
          </div>
        </Card>

        <Card padding="md" className="bg-gradient-to-br from-purple-500 to-purple-600 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-purple-100 text-sm mb-1">Highest Score</p>
              <p className="text-3xl font-bold">{Math.round(stats?.highest_score || 0)}</p>
            </div>
            <Award size={40} className="text-purple-200" />
          </div>
        </Card>

        <Card padding="md" className="bg-gradient-to-br from-orange-500 to-orange-600 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-orange-100 text-sm mb-1">Practice Time</p>
              <p className="text-3xl font-bold">
                {formatDuration(stats?.total_practice_time_minutes || 0)}
              </p>
            </div>
            <Clock size={40} className="text-orange-200" />
          </div>
        </Card>
      </div>

      {/* Progress Chart */}
      {stats?.score_trend && stats.score_trend.length > 0 && (
        <div className="mb-8">
          <ProgressChart
            data={stats.score_trend.map((item, index) => ({
              x: index + 1,
              y: item.score,
            }))}
            type="area"
          />
        </div>
      )}

      {/* Weak Areas */}
      {weakAreas.length > 0 && (
        <Card title="Areas to Improve" className="mb-8">
          <div className="space-y-4">
            {weakAreas.map((area, index) => (
              <div key={index} className="border-l-4 border-orange-500 pl-4 py-2">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-semibold text-gray-900">{area.area}</h4>
                  <span
                    className={`px-2 py-1 rounded text-xs font-medium ${
                      area.severity === 'high'
                        ? 'bg-red-100 text-red-800'
                        : 'bg-yellow-100 text-yellow-800'
                    }`}
                  >
                    {area.severity}
                  </span>
                </div>
                <p className="text-sm text-gray-600 mb-2">{area.suggestion}</p>
                <p className="text-xs text-gray-500">
                  Average: {area.average_score} | Based on {area.sessions_analyzed} sessions
                </p>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Recent Sessions */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Recent Sessions</h2>
        <Button
          variant="primary"
          icon={<PlusCircle size={20} />}
          onClick={() => navigate('/new-session')}
        >
          New Session
        </Button>
      </div>

      {sessions.length === 0 ? (
        <Card padding="lg">
          <div className="text-center py-12">
            <Award size={64} className="mx-auto text-gray-300 mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              No sessions yet
            </h3>
            <p className="text-gray-600 mb-6">
              Start your first interview practice session to get personalized feedback!
            </p>
            <Button
              variant="primary"
              icon={<PlusCircle size={20} />}
              onClick={() => navigate('/new-session')}
            >
              Create Your First Session
            </Button>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sessions.map((session) => (
            <SessionCard
              key={session.id}
              session={session}
              onDelete={handleDeleteSession}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default Dashboard;