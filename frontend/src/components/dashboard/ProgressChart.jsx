import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Area,
  AreaChart,
} from 'recharts';
import { CHART_COLORS } from '../../utils/constants';
import Card from '../common/Card';

/**
 * Progress Chart Component - Display user progress over time
 */
const ProgressChart = ({ data, title = 'Your Progress Over Time', type = 'line' }) => {
  if (!data || data.length === 0) {
    return (
      <Card title={title}>
        <div className="flex items-center justify-center h-64 text-gray-500">
          <p>No data available yet. Complete sessions to see your progress.</p>
        </div>
      </Card>
    );
  }

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-4 rounded-lg shadow-lg border border-gray-200">
          <p className="font-medium text-gray-900 mb-2">Session {label}</p>
          {payload.map((entry, index) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {entry.name}: <span className="font-semibold">{entry.value}</span>
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <Card title={title}>
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          {type === 'area' ? (
            <AreaChart data={data}>
              <defs>
                <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={CHART_COLORS.primary} stopOpacity={0.8} />
                  <stop offset="95%" stopColor={CHART_COLORS.primary} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis
                dataKey="x"
                label={{ value: 'Session Number', position: 'insideBottom', offset: -5 }}
                stroke="#6b7280"
              />
              <YAxis
                label={{ value: 'Score', angle: -90, position: 'insideLeft' }}
                stroke="#6b7280"
                domain={[0, 100]}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="y"
                stroke={CHART_COLORS.primary}
                fillOpacity={1}
                fill="url(#colorScore)"
                name="Score"
              />
            </AreaChart>
          ) : (
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis
                dataKey="x"
                label={{ value: 'Session Number', position: 'insideBottom', offset: -5 }}
                stroke="#6b7280"
              />
              <YAxis
                label={{ value: 'Score', angle: -90, position: 'insideLeft' }}
                stroke="#6b7280"
                domain={[0, 100]}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <Line
                type="monotone"
                dataKey="y"
                stroke={CHART_COLORS.primary}
                strokeWidth={2}
                dot={{ fill: CHART_COLORS.primary, r: 4 }}
                activeDot={{ r: 6 }}
                name="Score"
              />
            </LineChart>
          )}
        </ResponsiveContainer>
      </div>
    </Card>
  );
};

export default ProgressChart;