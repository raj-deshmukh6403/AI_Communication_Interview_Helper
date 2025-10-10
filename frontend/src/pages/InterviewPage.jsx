import React from 'react';
import { useParams } from 'react-router-dom';
import InterviewSession from '../components/session/InterviewSession';

const InterviewPage = () => {
  const { sessionId } = useParams();
  return <InterviewSession sessionId={sessionId} />;
};

export default InterviewPage;