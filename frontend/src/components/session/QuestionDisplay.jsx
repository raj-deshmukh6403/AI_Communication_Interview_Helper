import React from 'react';
import { HelpCircle, Clock, Lightbulb } from 'lucide-react';
import Card from '../common/Card';
import { capitalizeFirst } from '../../utils/helpers';

/**
 * Question Display Component - Shows current interview question
 */
const QuestionDisplay = ({
  question,
  questionNumber,
  totalQuestions,
  elapsedTime,
  showHints = false,
}) => {
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getDifficultyColor = (difficulty) => {
    switch (difficulty) {
      case 'easy':
        return 'bg-green-100 text-green-800';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800';
      case 'hard':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getTypeColor = (type) => {
    switch (type) {
      case 'behavioral':
        return 'bg-blue-100 text-blue-800';
      case 'technical':
        return 'bg-purple-100 text-purple-800';
      case 'communication':
        return 'bg-indigo-100 text-indigo-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <Card className="border-l-4 border-primary-500">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3">
          <span className="text-sm font-medium text-gray-500">
            Question {questionNumber} of {totalQuestions}
          </span>
          
          {question.type && (
            <span className={`px-2 py-1 rounded text-xs font-medium ${getTypeColor(question.type)}`}>
              {capitalizeFirst(question.type)}
            </span>
          )}
          
          {question.difficulty && (
            <span className={`px-2 py-1 rounded text-xs font-medium ${getDifficultyColor(question.difficulty)}`}>
              {capitalizeFirst(question.difficulty)}
            </span>
          )}
        </div>

        {/* Timer */}
        {elapsedTime !== undefined && (
          <div className="flex items-center space-x-2 text-gray-600">
            <Clock size={18} />
            <span className="font-mono text-lg">{formatTime(elapsedTime)}</span>
          </div>
        )}
      </div>

      {/* Question Text */}
      <div className="mb-6">
        <div className="flex items-start space-x-3">
          <HelpCircle className="text-primary-600 flex-shrink-0 mt-1" size={24} />
          <p className="text-xl font-medium text-gray-900 leading-relaxed">
            {question.question}
          </p>
        </div>
      </div>

      {/* Hints/Tips */}
      {showHints && question.type === 'behavioral' && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start space-x-2">
            <Lightbulb className="text-blue-600 flex-shrink-0 mt-0.5" size={20} />
            <div>
              <p className="text-sm font-medium text-blue-900 mb-2">STAR Method Tip:</p>
              <ul className="text-sm text-blue-800 space-y-1">
                <li><strong>S</strong>ituation: Set the context</li>
                <li><strong>T</strong>ask: Describe your responsibility</li>
                <li><strong>A</strong>ction: Explain what you did</li>
                <li><strong>R</strong>esult: Share the outcome</li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
};

export default QuestionDisplay;