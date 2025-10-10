import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, Clock, TrendingUp, Award, Trash2 } from 'lucide-react';
import Card from '../common/Card';
import Button from '../common/Button';
import { formatDate, formatDuration, getScoreColor, getScoreLabel } from '../../utils/helpers';
import { SESSION_STATUS } from '../../utils/constants';

/**
 * Session Card Component - Display individual session summary
 */
const SessionCard = ({ session, onDelete }) => {
  const navigate = useNavigate();

  const handleViewDetails = () => {
    navigate(`/session/${session.id}/results`);
  };

  const handleDelete = (e) => {
    e.stopPropagation();
    if (window.confirm('Are you sure you want to delete this session?')) {
      onDelete(session.id);
    }
  };

  const statusColors = {
    [SESSION_STATUS.COMPLETED]: 'bg-green-100 text-green-800',
    [SESSION_STATUS.IN_PROGRESS]: 'bg-blue-100 text-blue-800',
    [SESSION_STATUS.PENDING]: 'bg-yellow-100 text-yellow-800',
    [SESSION_STATUS.ABORTED]: 'bg-red-100 text-red-800',
  };

  return (
    <Card className="hover:shadow-lg transition-shadow" padding="md">
      <div className="flex justify-between items-start mb-4">
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900 mb-1">
            {session.position}
          </h3>
          {session.company_name && (
            <p className="text-sm text-gray-600 mb-2">{session.company_name}</p>
          )}
        </div>
        
        {/* Status Badge */}
        <span
          className={`px-3 py-1 rounded-full text-xs font-medium ${
            statusColors[session.status] || 'bg-gray-100 text-gray-800'
          }`}
        >
          {session.status.replace('_', ' ').toUpperCase()}
        </span>
      </div>

      {/* Session Info */}
      <div className="space-y-2 mb-4">
        <div className="flex items-center text-sm text-gray-600">
          <Calendar size={16} className="mr-2" />
          <span>{formatDate(session.session_date)}</span>
        </div>

        {session.duration_minutes && (
          <div className="flex items-center text-sm text-gray-600">
            <Clock size={16} className="mr-2" />
            <span>{formatDuration(session.duration_minutes)}</span>
          </div>
        )}
      </div>

      {/* Score Display */}
      {session.overall_score !== null && session.overall_score !== undefined && (
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">Overall Score</span>
            <span className={`text-lg font-bold ${getScoreColor(session.overall_score)}`}>
              {Math.round(session.overall_score)}/100
            </span>
          </div>
          
          {/* Progress Bar */}
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all ${
                session.overall_score >= 85
                  ? 'bg-green-500'
                  : session.overall_score >= 70
                  ? 'bg-blue-500'
                  : session.overall_score >= 55
                  ? 'bg-yellow-500'
                  : 'bg-red-500'
              }`}
              style={{ width: `${session.overall_score}%` }}
            ></div>
          </div>
          
          <p className="text-xs text-gray-500 mt-1">{getScoreLabel(session.overall_score)}</p>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-2">
        {session.status === SESSION_STATUS.COMPLETED && (
          <Button
            variant="primary"
            size="sm"
            onClick={handleViewDetails}
            fullWidth
            icon={<TrendingUp size={16} />}
          >
            View Details
          </Button>
        )}
        
        {session.status === SESSION_STATUS.PENDING && (
          <Button
            variant="success"
            size="sm"
            onClick={() => navigate(`/interview/${session.id}`)}
            fullWidth
            icon={<Award size={16} />}
          >
            Start Interview
          </Button>
        )}

        <Button
          variant="danger"
          size="sm"
          onClick={handleDelete}
          icon={<Trash2 size={16} />}
        >
          Delete
        </Button>
      </div>
    </Card>
  );
};

export default SessionCard;