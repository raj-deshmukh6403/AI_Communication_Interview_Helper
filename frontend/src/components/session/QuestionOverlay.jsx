import React from 'react';
import { HelpCircle, Clock, X } from 'lucide-react';
import { capitalizeFirst } from '../../utils/helpers';

/**
 * Question Overlay Component - Shows question as overlay on full-screen video
 */
const QuestionOverlay = ({
  question,
  questionNumber,
  totalQuestions,
  elapsedTime,
  showHints = false,
  onClose,
  isMinimized,
  onToggleMinimize,
  onSkip = () => {},
  onDone = () => {},
}) => {
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getDifficultyColor = (difficulty) => {
    switch (difficulty) {
      case 'easy':
        return 'bg-green-500';
      case 'medium':
        return 'bg-yellow-500';
      case 'hard':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getTypeColor = (type) => {
    switch (type) {
      case 'behavioral':
        return 'bg-blue-500';
      case 'technical':
        return 'bg-purple-500';
      case 'communication':
        return 'bg-indigo-500';
      default:
        return 'bg-gray-500';
    }
  };

  if (!question) return null;

  if (isMinimized) {
    return (
      <button
        onClick={onToggleMinimize}
        className="fixed bottom-6 left-6 z-50 bg-black/70 hover:bg-black/80 text-white px-4 py-2 rounded-lg shadow-lg transition-all"
      >
        Question {questionNumber} of {totalQuestions} - Click to expand
      </button>
    );
  }

  // Render overlay in bottom-left corner so user can see themselves
  return (
    <div className="fixed bottom-6 left-6 z-50 w-80 px-2">
      <div className="bg-white/95 backdrop-blur-sm rounded-lg shadow-2xl border-2 border-primary-500 p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <span className="text-sm font-medium text-gray-700">
              Question {questionNumber} of {totalQuestions}
            </span>
            
            {question.type && (
              <span className={`px-2 py-1 rounded text-xs font-medium text-white ${getTypeColor(question.type)}`}>
                {capitalizeFirst(question.type)}
              </span>
            )}
            
            {question.difficulty && (
              <span className={`px-2 py-1 rounded text-xs font-medium text-white ${getDifficultyColor(question.difficulty)}`}>
                {capitalizeFirst(question.difficulty)}
              </span>
            )}
          </div>

          <div className="flex items-center space-x-3">
            {/* Timer */}
            {elapsedTime !== undefined && (
              <div className="flex items-center space-x-2 text-gray-700">
                <Clock size={18} />
                <span className="font-mono text-lg font-bold">{formatTime(elapsedTime)}</span>
              </div>
            )}
            
            {/* Minimize button */}
            <button
              onClick={onToggleMinimize}
              className="text-gray-500 hover:text-gray-700 p-1"
              title="Minimize"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Question Text */}
        <div className="mb-4">
          <div className="flex items-start space-x-3">
            <HelpCircle className="text-primary-600 flex-shrink-0 mt-1" size={28} />
            <p className="text-2xl font-semibold text-gray-900 leading-relaxed">
              {question.question}
            </p>
          </div>
        </div>

        {/* Hints/Tips */}
        {showHints && question.type === 'behavioral' && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <div className="flex items-start space-x-2">
              <div>
                <p className="text-sm font-medium text-blue-900 mb-1">STAR Method Tip:</p>
                <div className="text-xs text-blue-800 grid grid-cols-2 gap-1">
                  <span><strong>S</strong>ituation: Set the context</span>
                  <span><strong>T</strong>ask: Describe your responsibility</span>
                  <span><strong>A</strong>ction: Explain what you did</span>
                  <span><strong>R</strong>esult: Share the outcome</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Actions: Skip and Done */}
        <div className="mt-4 flex items-center justify-end space-x-2">
          <button
            onClick={onSkip}
            className="text-sm px-3 py-1 rounded-md bg-gray-100 hover:bg-gray-200 text-gray-700"
            title="Skip this question"
          >
            Skip
          </button>
          <button
            onClick={onDone}
            className="text-sm px-3 py-1 rounded-md bg-primary-600 hover:bg-primary-700 text-white"
            title="Mark answer as done"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

export default QuestionOverlay;

