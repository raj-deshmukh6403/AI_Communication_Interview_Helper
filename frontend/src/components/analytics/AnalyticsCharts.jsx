import React from 'react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { CHART_COLORS } from '../../utils/constants';
import Card from '../common/Card';

/**
 * Analytics Charts Component - Various visualizations for session analytics
 */
const AnalyticsCharts = ({ analytics }) => {
  if (!analytics) {
    return (
      <div className="text-center py-12 text-gray-500">
        <p>No analytics data available</p>
      </div>
    );
  }

  // Prepare data for charts
  const performanceData = [
    { metric: 'Communication', score: analytics.component_scores?.communication || 0 },
    { metric: 'Confidence', score: analytics.component_scores?.confidence || 0 },
    { metric: 'Content', score: analytics.component_scores?.content_quality || 0 },
    { metric: 'Non-Verbal', score: analytics.component_scores?.non_verbal || 0 },
    { metric: 'Vocal', score: analytics.component_scores?.vocal || 0 },
  ];

  const metricsData = [
    { name: 'Eye Contact', value: analytics.detailed_metrics?.avg_eye_contact || 0, fullMark: 100 },
    { name: 'Speaking Pace', value: Math.min((analytics.detailed_metrics?.avg_speaking_pace || 150) / 2, 100), fullMark: 100 },
    { name: 'Volume', value: analytics.detailed_metrics?.avg_volume || 0, fullMark: 100 },
    { name: 'Engagement', value: analytics.detailed_metrics?.avg_engagement || 0, fullMark: 100 },
    { name: 'Clarity', value: analytics.detailed_metrics?.avg_answer_clarity || 0, fullMark: 100 },
  ];

  const COLORS = [CHART_COLORS.primary, CHART_COLORS.success, CHART_COLORS.warning, CHART_COLORS.danger, CHART_COLORS.info];

  // Custom tooltip
  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 rounded-lg shadow-lg border border-gray-200">
          <p className="font-medium text-gray-900">{payload[0].name}</p>
          <p className="text-sm text-gray-600">
            Score: <span className="font-semibold">{payload[0].value}</span>
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6">
      {/* Performance Breakdown - Bar Chart */}
      <Card title="Performance Breakdown">
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={performanceData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="metric" stroke="#6b7280" />
              <YAxis domain={[0, 100]} stroke="#6b7280" />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="score" fill={CHART_COLORS.primary} radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Skills Radar Chart */}
        <Card title="Skills Assessment">
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={metricsData}>
                <PolarGrid stroke="#e5e7eb" />
                <PolarAngleAxis dataKey="name" stroke="#6b7280" />
                <PolarRadiusAxis angle={90} domain={[0, 100]} stroke="#6b7280" />
                <Radar name="Your Performance" dataKey="value" stroke={CHART_COLORS.primary} fill={CHART_COLORS.primary} fillOpacity={0.6} />
                <Tooltip content={<CustomTooltip />} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Score Distribution - Pie Chart */}
        <Card title="Score Distribution">
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={performanceData}
                  dataKey="score"
                  nameKey="metric"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                >
                  {performanceData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* Timeline Data if available */}
      {analytics.timeline_data && analytics.timeline_data.answer_quality && (
        <Card title="Performance Timeline">
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={analytics.timeline_data.answer_quality}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="x" label={{ value: 'Question Number', position: 'insideBottom', offset: -5 }} stroke="#6b7280" />
                <YAxis domain={[0, 100]} label={{ value: 'Score', angle: -90, position: 'insideLeft' }} stroke="#6b7280" />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Line type="monotone" dataKey="y" stroke={CHART_COLORS.primary} strokeWidth={2} dot={{ fill: CHART_COLORS.primary, r: 5 }} name="Answer Quality" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}
    </div>
  );
};

export default AnalyticsCharts;