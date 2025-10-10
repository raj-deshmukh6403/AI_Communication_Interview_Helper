import React from 'react';
import { CheckCircle, TrendingUp, AlertCircle, Award, Download } from 'lucide-react';
import Card from '../common/Card';
import Button from '../common/Button';
import { getScoreColor, getScoreLabel } from '../../utils/helpers';

/**
 * Feedback Report Component - Displays detailed feedback from session
 */
const FeedbackReport = ({ feedback, onDownload }) => {
  if (!feedback) {
    return (
      <Card>
        <div className="text-center py-12 text-gray-500">
          <AlertCircle size={48} className="mx-auto mb-4 opacity-50" />
          <p>No feedback available for this session</p>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Overall Score */}
      <Card>
        <div className="text-center py-8">
          <p className="text-gray-600 mb-3">Overall Performance</p>
          <div className={`text-7xl font-bold ${getScoreColor(feedback.overall_score)} mb-3`}>
            {Math.round(feedback.overall_score)}
          </div>
          <p className="text-2xl text-gray-700 mb-6">{getScoreLabel(feedback.overall_score)}</p>

          {/* Download Button */}
          {onDownload && (
            <Button variant="outline" icon={<Download size={18} />} onClick={onDownload}>
              Download Report
            </Button>
          )}
        </div>
      </Card>

      {/* Component Scores */}
      <Card title="Performance Breakdown">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {feedback.component_scores && Object.entries(feedback.component_scores).map(([key, value]) => (
            <div key={key} className="bg-gray-50 rounded-lg p-4 text-center">
              <p className="text-xs text-gray-600 mb-2 capitalize">{key.replace('_', ' ')}</p>
              <p className={`text-3xl font-bold ${getScoreColor(value)}`}>{Math.round(value)}</p>
            </div>
          ))}
        </div>
      </Card>

      {/* Detailed Feedback */}
      {feedback.detailed_feedback && (
        <Card title="Expert Feedback">
          <div className="prose max-w-none">
            <p className="text-gray-700 leading-relaxed whitespace-pre-line">
              {feedback.detailed_feedback}
            </p>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Strengths */}
        {feedback.strengths && feedback.strengths.length > 0 && (
          <Card title="✨ Your Strengths" className="border-l-4 border-green-500">
            <ul className="space-y-3">
              {feedback.strengths.map((strength, index) => (
                <li key={index} className="flex items-start">
                  <CheckCircle size={20} className="text-green-600 mr-3 flex-shrink-0 mt-0.5" />
                  <span className="text-gray-700">{strength}</span>
                </li>
              ))}
            </ul>
          </Card>
        )}

        {/* Areas for Improvement */}
        {feedback.improvements && feedback.improvements.length > 0 && (
          <Card title="🎯 Areas to Improve" className="border-l-4 border-orange-500">
            <ul className="space-y-3">
              {feedback.improvements.map((improvement, index) => (
                <li key={index} className="flex items-start">
                  <TrendingUp size={20} className="text-orange-600 mr-3 flex-shrink-0 mt-0.5" />
                  <span className="text-gray-700">{improvement}</span>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>

      {/* Detailed Metrics */}
      {feedback.detailed_metrics && (
        <Card title="Detailed Metrics">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.entries(feedback.detailed_metrics).map(([key, value]) => (
              <div key={key} className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-600 mb-1 capitalize">
                  {key.replace(/_/g, ' ')}
                </p>
                <p className="text-2xl font-bold text-gray-900">
                  {typeof value === 'number' ? Math.round(value) : value}
                </p>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Next Steps */}
      <Card title="📚 Recommended Next Steps" className="bg-gradient-to-br from-blue-50 to-indigo-50">
        <ul className="space-y-3">
          <li className="flex items-start">
            <Award size={20} className="text-blue-600 mr-3 flex-shrink-0 mt-0.5" />
            <span className="text-gray-700">
              Practice regularly - consistency is key to improvement
            </span>
          </li>
          <li className="flex items-start">
            <Award size={20} className="text-blue-600 mr-3 flex-shrink-0 mt-0.5" />
            <span className="text-gray-700">
              Focus on your identified weak areas in the next session
            </span>
          </li>
          <li className="flex items-start">
            <Award size={20} className="text-blue-600 mr-3 flex-shrink-0 mt-0.5" />
            <span className="text-gray-700">
              Record yourself and review your body language
            </span>
          </li>
          <li className="flex items-start">
            <Award size={20} className="text-blue-600 mr-3 flex-shrink-0 mt-0.5" />
            <span className="text-gray-700">
              Use the STAR method for all behavioral questions
            </span>
          </li>
        </ul>
      </Card>
    </div>
  );
};

export default FeedbackReport;