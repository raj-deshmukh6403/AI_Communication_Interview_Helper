import React, { useEffect, useState } from 'react';
import { AlertTriangle, Info, AlertCircle, X } from 'lucide-react';

/**
 * Intervention Alert Component - Shows real-time feedback/warnings
 */
const InterventionAlert = ({ intervention, onDismiss, autoDismiss = 5000 }) => {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    if (autoDismiss && autoDismiss > 0) {
      const timer = setTimeout(() => {
        handleDismiss();
      }, autoDismiss);

      return () => clearTimeout(timer);
    }
  }, [autoDismiss]);

  const handleDismiss = () => {
    setIsVisible(false);
    if (onDismiss) {
      setTimeout(() => onDismiss(), 300); // Wait for animation
    }
  };

  if (!isVisible || !intervention) return null;

  // Severity styles
  const severityConfig = {
    low: {
      bg: 'bg-blue-50 border-blue-300',
      text: 'text-blue-800',
      icon: Info,
      iconColor: 'text-blue-600',
    },
    medium: {
      bg: 'bg-yellow-50 border-yellow-300',
      text: 'text-yellow-800',
      icon: AlertCircle,
      iconColor: 'text-yellow-600',
    },
    high: {
      bg: 'bg-orange-50 border-orange-300',
      text: 'text-orange-800',
      icon: AlertTriangle,
      iconColor: 'text-orange-600',
    },
    critical: {
      bg: 'bg-red-50 border-red-300',
      text: 'text-red-800',
      icon: AlertTriangle,
      iconColor: 'text-red-600',
    },
  };

  const config = severityConfig[intervention.severity] || severityConfig.medium;
  const Icon = config.icon;

  return (
    <div
      className={`${config.bg} border-l-4 ${config.text} p-4 rounded-lg shadow-lg animate-slide-in mb-4`}
      role="alert"
    >
      <div className="flex items-start">
        <Icon className={`${config.iconColor} flex-shrink-0 mr-3 mt-0.5`} size={20} />
        <div className="flex-1">
          <p className="font-medium text-sm">{intervention.message}</p>
          {intervention.type && (
            <p className="text-xs mt-1 opacity-75">Type: {intervention.type}</p>
          )}
        </div>
        <button
          onClick={handleDismiss}
          className={`${config.iconColor} hover:opacity-75 transition-opacity ml-3`}
        >
          <X size={18} />
        </button>
      </div>
    </div>
  );
};

export default InterventionAlert;