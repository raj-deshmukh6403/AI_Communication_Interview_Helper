// REPLACE ENTIRE QuestionOverlay.jsx
import React from 'react';
import { HelpCircle, Clock, Minimize2, MessageSquare, Maximize2 } from 'lucide-react';
import { capitalizeFirst } from '../../utils/helpers';

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
      case 'easy': return 'bg-green-500';
      case 'medium': return 'bg-yellow-500';
      case 'hard': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getTypeColor = (type) => {
    switch (type) {
      case 'behavioral': return 'bg-blue-500';
      case 'technical': return 'bg-purple-500';
      case 'communication': return 'bg-indigo-500';
      default: return 'bg-gray-500';
    }
  };

  if (!question) return null;

  if (isMinimized) {
    return (
      <button
        onClick={onToggleMinimize}
        className="fixed bottom-24 left-6 z-50 bg-white/90 hover:bg-white backdrop-blur-sm text-gray-900 px-4 py-2 rounded-lg shadow-lg transition-all flex items-center space-x-2"
      >
        <MessageSquare size={18} />
        <span className="font-medium">Question {questionNumber}/{totalQuestions}</span>
        <Maximize2 size={16} />
      </button>
    );
  }

  // FIX: Position in bottom-left corner with smaller width
  return (
    <div className="fixed bottom-24 left-6 z-50 w-96">
      <div className="bg-white/95 backdrop-blur-sm rounded-lg shadow-2xl border-2 border-blue-500 p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2">
            <span className="text-sm font-medium text-gray-700">
              Question {questionNumber}/{totalQuestions}
            </span>
            
            {question.type && (
              <span className={`px-2 py-0.5 rounded text-xs font-medium text-white ${getTypeColor(question.type)}`}>
                {capitalizeFirst(question.type)}
              </span>
            )}
            
            {question.difficulty && (
              <span className={`px-2 py-0.5 rounded text-xs font-medium text-white ${getDifficultyColor(question.difficulty)}`}>
                {capitalizeFirst(question.difficulty)}
              </span>
            )}
          </div>

          <div className="flex items-center space-x-2">
            {/* Timer */}
            {elapsedTime !== undefined && (
              <div className="flex items-center space-x-1 text-gray-700">
                <Clock size={16} />
                <span className="font-mono text-sm font-bold">{formatTime(elapsedTime)}</span>
              </div>
            )}
            
            {/* Minimize button */}
            <button
              onClick={onToggleMinimize}
              className="text-gray-500 hover:text-gray-700 p-1"
              title="Minimize"
            >
              <Minimize2 size={16} />
            </button>
          </div>
        </div>

        {/* Question Text */}
        <div className="mb-3">
          <div className="flex items-start space-x-2">
            <HelpCircle className="text-blue-600 flex-shrink-0 mt-0.5" size={20} />
            <p className="text-base font-semibold text-gray-900 leading-relaxed">
              {question.question}
            </p>
          </div>
        </div>

        {/* Hints/Tips */}
        {showHints && question.type === 'behavioral' && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-2 mb-3">
            <p className="text-xs font-medium text-blue-900 mb-1">💡 STAR Method</p>
            <div className="grid grid-cols-2 gap-1 text-xs text-blue-800">
              <span><strong>S</strong>ituation: Context</span>
              <span><strong>T</strong>ask: Responsibility</span>
              <span><strong>A</strong>ction: What you did</span>
              <span><strong>R</strong>esult: Outcome</span>
            </div>
          </div>
        )}

        {/* Actions: Skip and Done */}
        <div className="flex items-center justify-between">
          <button
            onClick={onSkip}
            className="text-sm px-3 py-1.5 rounded-md bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors"
            title="Skip this question"
          >
            Skip
          </button>
          <button
            onClick={onDone}
            className="text-sm px-4 py-1.5 rounded-md bg-green-600 hover:bg-green-700 text-white transition-colors"
            title="Submit answer"
          >
            Done Answering
          </button>
        </div>
      </div>
    </div>
  );
};

export default QuestionOverlay;