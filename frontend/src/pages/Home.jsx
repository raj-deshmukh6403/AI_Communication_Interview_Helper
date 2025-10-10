import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Video, Target, BarChart3, Award, ArrowRight, CheckCircle } from 'lucide-react';
import { useAuthContext } from '../context/AuthContext';
import Button from '../components/common/Button';
import Footer from '../components/layout/Footer';

const Home = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthContext();

  const features = [
    {
      icon: Video,
      title: 'Real-Time Video Analysis',
      description: 'Get instant feedback on eye contact, body language, and engagement during your practice.',
    },
    {
      icon: Target,
      title: 'AI-Powered Questions',
      description: 'Receive personalized interview questions tailored to your job description and resume.',
    },
    {
      icon: BarChart3,
      title: 'Detailed Analytics',
      description: 'Track your progress with comprehensive metrics and performance insights over time.',
    },
    {
      icon: Award,
      title: 'Expert Feedback',
      description: 'Get actionable recommendations to improve your communication and interview skills.',
    },
  ];

  const benefits = [
    'Practice unlimited times with different job roles',
    'Build confidence with realistic interview scenarios',
    'Identify and fix weak areas before the actual interview',
    'Track improvement with detailed progress reports',
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-16">
        <div className="text-center">
          <h1 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6">
            Master Your Interviews with
            <span className="text-primary-600"> AI-Powered</span> Coaching
          </h1>
          <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
            Practice interview skills with real-time feedback on your communication,
            body language, and answers. Get personalized insights to ace your next interview.
          </p>
          <div className="flex justify-center gap-4">
            {isAuthenticated ? (
              <Button variant="primary" size="lg" onClick={() => navigate('/dashboard')} icon={<ArrowRight size={20} />}>
                Go to Dashboard
              </Button>
            ) : (
              <>
                <Button variant="primary" size="lg" onClick={() => navigate('/register')} icon={<ArrowRight size={20} />}>
                  Get Started Free
                </Button>
                <Button variant="outline" size="lg" onClick={() => navigate('/login')}>
                  Sign In
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">Everything You Need to Succeed</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <div key={index} className="bg-white rounded-lg shadow-md p-6 hover:shadow-xl transition-shadow">
                <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center mb-4">
                  <Icon className="text-primary-600" size={24} />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">{feature.title}</h3>
                <p className="text-gray-600">{feature.description}</p>
              </div>
            );
          })}
        </div>
      </div>

      <div className="bg-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl font-bold text-gray-900 mb-6">Why Choose AI Interview Coach?</h2>
              <ul className="space-y-4">
                {benefits.map((benefit, index) => (
                  <li key={index} className="flex items-start">
                    <CheckCircle className="text-green-600 mr-3 flex-shrink-0 mt-1" size={20} />
                    <span className="text-gray-700">{benefit}</span>
                  </li>
                ))}
              </ul>
              {!isAuthenticated && (
                <Button variant="primary" size="lg" className="mt-8" onClick={() => navigate('/register')} icon={<ArrowRight size={20} />}>
                  Start Practicing Now
                </Button>
              )}
            </div>
            <div className="bg-gradient-to-br from-primary-500 to-purple-600 rounded-lg p-8 text-white">
              <h3 className="text-2xl font-bold mb-4">Ready to Get Started?</h3>
              <p className="text-primary-100 mb-6">
                Join thousands of job seekers who have improved their interview skills and landed their dream jobs.
              </p>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div><p className="text-3xl font-bold">10K+</p><p className="text-primary-100 text-sm">Users</p></div>
                <div><p className="text-3xl font-bold">50K+</p><p className="text-primary-100 text-sm">Sessions</p></div>
                <div><p className="text-3xl font-bold">95%</p><p className="text-primary-100 text-sm">Success Rate</p></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {!isAuthenticated && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="bg-gradient-to-r from-primary-600 to-purple-600 rounded-2xl p-12 text-center text-white">
            <h2 className="text-3xl font-bold mb-4">Ready to Ace Your Next Interview?</h2>
            <p className="text-xl text-primary-100 mb-8 max-w-2xl mx-auto">
              Start practicing today and get personalized feedback to improve your skills.
            </p>
            <Button variant="secondary" size="lg" onClick={() => navigate('/register')} className="bg-white text-primary-600 hover:bg-gray-100" icon={<ArrowRight size={20} />}>
              Create Free Account
            </Button>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
};

export default Home;