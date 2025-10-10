import React from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle, TrendingUp, Home, Award } from 'lucide-react';
import Button from '../common/Button';
import Card from '../common/Card';
import { getScoreColor, getScoreLabel } from '../../utils/helpers';

/**
 * Session Complete Component - Shows completion screen with summary
 */
const SessionComplete = ({ sessionId, feedback }) => {
  const navigate = useNavigate();

  const handleViewResults = () => {
    navigate(`/session/${sessionId}/results`);
  };

  const handleBackToDashboard = () => {
    navigate('/dashboard');
  };

  const handleNewSession = () => {
    navigate('/new-session');
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full">
        {/* Success Icon */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-green-100 rounded-full mb-4">
            <CheckCircle className="text-green-600" size={48} />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Interview Complete! 🎉
          </h1>
          <p className="text-gray-600">
            Great job! Your feedback report is ready.
          </p>
        </div>

        {/* Score Summary */}
        {feedback && (
          <Card className="mb-6">
            <div className="text-center py-6">
              <p className="text-gray-600 mb-2">Your Overall Score</p>
              <div className={`text-6xl font-bold ${getScoreColor(feedback.overall_score)} mb-2`}>
                {Math.round(feedback.overall_score)}
              </div>
              <p className="text-xl text-gray-700 mb-4">{getScoreLabel(feedback.overall_score)}</p>

              {/* Component Scores */}
              <div className="grid grid-cols-3 gap-4 mt-6">
                <div className="bg-blue-50 rounded-lg p-4">
                  <p className="text-sm text-gray-600 mb-1">Communication</p>
                  <p className={`text-2xl font-bold ${getScoreColor(feedback.component_scores?.communication)}`}>
                    {Math.round(feedback.component_scores?.communication || 0)}
                  </p>
                </div>
                <div className="bg-purple-50 rounded-lg p-4">
                  <p className="text-sm text-gray-600 mb-1">Confidence</p>
                  <p className={`text-2xl font-bold ${getScoreColor(feedback.component_scores?.confidence)}`}>
                    {Math.round(feedback.component_scores?.confidence || 0)}
                  </p>
                </div>
                <div className="bg-green-50 rounded-lg p-4">
                  <p className="text-sm text-gray-600 mb-1">Content</p>
                  <p className={`text-2xl font-bold ${getScoreColor(feedback.component_scores?.content_quality)}`}>
                    {Math.round(feedback.component_scores?.content_quality || 0)}
                  </p>
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* Quick Highlights */}
        {feedback && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            {/* Strengths */}
            {feedback.strengths && feedback.strengths.length > 0 && (
              <Card title="✨ Key Strengths" padding="md">
                <ul className="space-y-2">
                  {feedback.strengths.slice(0, 3).map((strength, index) => (
                    <li key={index} className="text-sm text-gray-700 flex items-start">
                      <CheckCircle size={16} className="text-green-600 mr-2 flex-shrink-0 mt-0.5" />
                      <span>{strength}</span>
                    </li>
                  ))}
                </ul>
              </Card>
            )}

            {/* Areas to Improve */}
            {feedback.improvements && feedback.improvements.length > 0 && (
              <Card title="🎯 Focus Areas" padding="md">
                <ul className="space-y-2">
                  {feedback.improvements.slice(0, 3).map((improvement, index) => (
                    <li key={index} className="text-sm text-gray-700 flex items-start">
                      <TrendingUp size={16} className="text-orange-600 mr-2 flex-shrink-0 mt-0.5" />
                      <span>{improvement}</span>
                    </li>
                  ))}
                </ul>
              </Card>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3">
          <Button
            variant="primary"
            size="lg"
            fullWidth
            icon={<Award size={20} />}
            onClick={handleViewResults}
          >
            View Detailed Report
          </Button>
          <Button
            variant="outline"
            size="lg"
            fullWidth
            icon={<Home size={20} />}
            onClick={handleBackToDashboard}
          >
            Dashboard
          </Button>
        </div>

        {/* New Session Link */}
        <div className="text-center mt-6">
          <button
            onClick={handleNewSession}
            className="text-primary-600 hover:text-primary-700 font-medium"
          >
            Start Another Practice Session →
          </button>
        </div>
      </div>
    </div>
  );
};

export default SessionComplete;