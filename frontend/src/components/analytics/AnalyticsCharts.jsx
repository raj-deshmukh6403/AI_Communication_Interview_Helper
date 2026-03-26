import React from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, BarChart, Bar
} from 'recharts';
import Card from '../common/Card';

const AnalyticsCharts = ({ timelineData }) => {
  if (!timelineData) {
    return (
      <Card>
        <p className="text-center text-gray-500 py-8">No timeline data available.</p>
      </Card>
    );
  }

  // Build per-question data rows
  const questionCount = Math.max(
    timelineData.eye_contact?.length || 0,
    timelineData.engagement?.length || 0,
    timelineData.speaking_pace?.length || 0,
    timelineData.answer_quality?.length || 0,
  );

  const performanceData = Array.from({ length: questionCount }, (_, i) => ({
    question: `Q${(timelineData.eye_contact?.[i]?.x || i + 1)}`,
    'Eye Contact':   Math.round(timelineData.eye_contact?.[i]?.y   || 0),
    'Engagement':    Math.round(timelineData.engagement?.[i]?.y    || 0),
    'Answer Score':  Math.round(timelineData.answer_quality?.[i]?.y || 0),
  }));

  const audioData = Array.from({ length: questionCount }, (_, i) => ({
    question: `Q${(timelineData.speaking_pace?.[i]?.x || i + 1)}`,
    'Speaking Pace': Math.round(timelineData.speaking_pace?.[i]?.y  || 0),
    'Volume':        Math.round(timelineData.volume?.[i]?.y         || 0),
  }));

  const emotionData = (timelineData.emotion || []).map(e => ({
    question: `Q${e.x}`,
    emotion: e.dominant || 'neutral',
  }));

  return (
    <div className="space-y-8">
      {/* Performance over questions */}
      <Card title="Performance Per Question">
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={performanceData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="question" />
            <YAxis domain={[0, 100]} />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="Eye Contact"  stroke="#3b82f6" strokeWidth={2} dot />
            <Line type="monotone" dataKey="Engagement"   stroke="#22c55e" strokeWidth={2} dot />
            <Line type="monotone" dataKey="Answer Score" stroke="#a855f7" strokeWidth={2} dot />
          </LineChart>
        </ResponsiveContainer>
      </Card>

      {/* Audio metrics */}
      <Card title="Speaking Metrics Per Question">
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={audioData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="question" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="Speaking Pace" fill="#f97316" />
            <Bar dataKey="Volume"        fill="#06b6d4" />
          </BarChart>
        </ResponsiveContainer>
        <p className="text-xs text-gray-400 mt-2 text-center">
          Optimal speaking pace: 125–170 WPM
        </p>
      </Card>

      {/* Emotion timeline */}
      {emotionData.length > 0 && (
        <Card title="Emotion Per Question">
          <div className="flex flex-wrap gap-3">
            {emotionData.map((e, i) => {
              const emotionColors = {
                happy: 'bg-green-100 text-green-800',
                neutral: 'bg-gray-100 text-gray-700',
                sad: 'bg-blue-100 text-blue-800',
                angry: 'bg-red-100 text-red-700',
                fear: 'bg-orange-100 text-orange-700',
                surprise: 'bg-yellow-100 text-yellow-800',
                disgust: 'bg-purple-100 text-purple-700',
                contempt: 'bg-pink-100 text-pink-700',
              };
              const cls = emotionColors[e.emotion] || 'bg-gray-100 text-gray-700';
              return (
                <div key={i} className={`px-3 py-2 rounded-lg text-sm font-medium ${cls}`}>
                  {e.question}: {e.emotion}
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
};

export default AnalyticsCharts;