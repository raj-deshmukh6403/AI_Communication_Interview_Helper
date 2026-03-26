import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Eye, Mic, Brain } from 'lucide-react';
import Card from '../common/Card';
import { getScoreColor } from '../../utils/helpers';

const SessionDetail = ({ responses = [] }) => {
  const [expanded, setExpanded] = useState(null);

  if (responses.length === 0) {
    return (
      <Card>
        <p className="text-center text-gray-500 py-8">No responses recorded for this session.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {responses.map((resp, i) => {
        const vid = resp.video_analytics || {};
        const aud = resp.audio_analytics || {};
        const pre = resp.pre_score || {};
        const isOpen = expanded === i;

        return (
          <Card key={i} padding="md">
            {/* Header row */}
            <button
              onClick={() => setExpanded(isOpen ? null : i)}
              className="w-full flex items-center justify-between text-left"
            >
              <div className="flex items-center gap-3">
                <span className="bg-blue-100 text-blue-800 text-xs font-bold px-2 py-1 rounded">
                  Q{resp.question_number || i + 1}
                </span>
                {resp.is_follow_up && (
                  <span className="bg-purple-100 text-purple-700 text-xs font-semibold px-2 py-0.5 rounded">
                    Follow-up
                  </span>
                )}
                <span className="text-xs text-gray-500 capitalize">{resp.question_type}</span>
                {resp.llm_score != null && (
                  <span className={`text-sm font-bold ${getScoreColor(resp.llm_score)}`}>
                    Score: {Math.round(resp.llm_score)}
                  </span>
                )}
              </div>
              {isOpen ? <ChevronUp size={18} className="text-gray-400" /> : <ChevronDown size={18} className="text-gray-400" />}
            </button>

            <p className="text-gray-700 font-medium mt-2 text-sm">{resp.question}</p>

            {isOpen && (
              <div className="mt-4 space-y-4 border-t border-gray-100 pt-4">
                {/* Answer */}
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Your Answer</p>
                  <p className="text-sm text-gray-700 bg-gray-50 rounded p-3 leading-relaxed">
                    {resp.answer || aud.transcript || '(no transcript)'}
                  </p>
                </div>

                {/* LLM Feedback */}
                {resp.llm_feedback && (
                  <div className="bg-blue-50 rounded p-3">
                    <p className="text-xs font-semibold text-blue-700 mb-1">AI Feedback</p>
                    <p className="text-sm text-blue-800">{resp.llm_feedback}</p>
                  </div>
                )}

                {/* Pre-score breakdown */}
                {pre.composite_pre_score != null && (
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase mb-2 flex items-center gap-1">
                      <Brain size={12} /> Objective Pre-Score: {Math.round(pre.composite_pre_score)}/100
                    </p>
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      {[
                        ['Word Count',   pre.word_count_score],
                        ['Filler Words', pre.filler_word_score],
                        ['STAR Structure',pre.star_keyword_score],
                        ['Specificity',  pre.specificity_score],
                        ['Relevance',    pre.relevance_score],
                        ['Clarity',      pre.sentence_clarity_score],
                      ].map(([label, val]) => (
                        <div key={label} className="bg-gray-50 rounded p-2 text-center">
                          <p className="text-gray-500">{label}</p>
                          <p className={`font-bold ${getScoreColor(val)}`}>{Math.round(val || 0)}</p>
                        </div>
                      ))}
                    </div>
                    {pre.star_components_found?.length > 0 && (
                      <p className="text-xs text-green-600 mt-1">
                        ✓ STAR found: {pre.star_components_found.join(', ')}
                      </p>
                    )}
                  </div>
                )}

                {/* Video + Audio metrics */}
                <div className="grid grid-cols-2 gap-4">
                  {/* Video */}
                  <div className="bg-gray-50 rounded p-3">
                    <p className="text-xs font-semibold text-gray-500 uppercase mb-2 flex items-center gap-1">
                      <Eye size={12} /> Video Metrics
                    </p>
                    <div className="space-y-1 text-xs">
                      <div className="flex justify-between">
                        <span className="text-gray-500">Eye Contact</span>
                        <span className={`font-semibold ${getScoreColor(vid.avg_eye_contact_score)}`}>
                          {Math.round(vid.avg_eye_contact_score || 0)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Engagement</span>
                        <span className={`font-semibold ${getScoreColor(vid.avg_engagement_score)}`}>
                          {Math.round(vid.avg_engagement_score || 0)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Emotion</span>
                        <span className="font-semibold capitalize">{vid.dominant_emotion || 'neutral'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Nervousness</span>
                        <span className="font-semibold">{vid.nervousness_rate?.toFixed(0) || 0}%</span>
                      </div>
                    </div>
                  </div>

                  {/* Audio */}
                  <div className="bg-gray-50 rounded p-3">
                    <p className="text-xs font-semibold text-gray-500 uppercase mb-2 flex items-center gap-1">
                      <Mic size={12} /> Audio Metrics
                    </p>
                    <div className="space-y-1 text-xs">
                      <div className="flex justify-between">
                        <span className="text-gray-500">Pace (WPM)</span>
                        <span className="font-semibold">{Math.round(aud.avg_speaking_pace_wpm || 0)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Filler Words</span>
                        <span className={`font-semibold ${aud.total_filler_words > 5 ? 'text-red-500' : 'text-green-600'}`}>
                          {aud.total_filler_words || 0}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Silence %</span>
                        <span className="font-semibold">{Math.round(aud.silence_percentage || 0)}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Duration</span>
                        <span className="font-semibold">{Math.round(aud.speaking_duration_seconds || resp.duration_seconds || 0)}s</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Warnings shown during answer */}
                {resp.warnings_shown?.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-orange-600 mb-1">⚠️ Warnings shown during answer</p>
                    <ul className="text-xs text-gray-600 space-y-0.5">
                      {resp.warnings_shown.map((w, wi) => <li key={wi}>• {w}</li>)}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
};

export default SessionDetail;