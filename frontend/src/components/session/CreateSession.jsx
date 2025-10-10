import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Briefcase, FileText, Upload, Building, AlertCircle } from 'lucide-react';
import Button from '../common/Button';
import Card from '../common/Card';
import { validateSessionForm } from '../../utils/validators';
import { validateFile } from '../../utils/validators';
import sessionService from '../../services/sessionService';
import { getErrorMessage } from '../../utils/helpers';

/**
 * Create Session Component - Form to create new interview session
 */
const CreateSession = () => {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    position: '',
    companyName: '',
    jobDescription: '',
    resume: null,
  });

  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [apiError, setApiError] = useState('');

  // Handle input change
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));

    // Clear error for this field
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
    setApiError('');
  };

  // Handle file upload
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    
    if (file) {
      const validation = validateFile(file);
      
      if (!validation.valid) {
        setErrors((prev) => ({ ...prev, resume: validation.error }));
        return;
      }

      setFormData((prev) => ({ ...prev, resume: file }));
      setErrors((prev) => ({ ...prev, resume: '' }));
    }
  };

  // Remove uploaded file
  const handleRemoveFile = () => {
    setFormData((prev) => ({ ...prev, resume: null }));
    setErrors((prev) => ({ ...prev, resume: '' }));
  };

  // Handle form submit
  const handleSubmit = async (e) => {
    e.preventDefault();
    setApiError('');

    // Validate form
    const validation = validateSessionForm(formData);

    if (!validation.valid) {
      setErrors(validation.errors);
      return;
    }

    setIsSubmitting(true);

    try {
      // Create session
      const response = await sessionService.createSession(
        {
          position: formData.position,
          companyName: formData.companyName,
          jobDescription: formData.jobDescription,
        },
        formData.resume
      );

      // Navigate to interview page
      navigate(`/interview/${response.id}`);
    } catch (err) {
      console.error('Error creating session:', err);
      setApiError(getErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Create New Interview Session
        </h1>
        <p className="text-gray-600">
          Provide job details to get personalized interview questions and feedback.
        </p>
      </div>

      {/* API Error Alert */}
      {apiError && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start">
          <AlertCircle className="text-red-600 mr-3 flex-shrink-0" size={20} />
          <span className="text-sm text-red-800">{apiError}</span>
        </div>
      )}

      <Card>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Position Field */}
          <div>
            <label htmlFor="position" className="block text-sm font-medium text-gray-700 mb-2">
              Job Position / Title <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Briefcase className="text-gray-400" size={20} />
              </div>
              <input
                type="text"
                id="position"
                name="position"
                value={formData.position}
                onChange={handleChange}
                className={`block w-full pl-10 pr-3 py-2 border ${
                  errors.position ? 'border-red-500' : 'border-gray-300'
                } rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent`}
                placeholder="e.g., Senior Software Engineer"
              />
            </div>
            {errors.position && (
              <p className="mt-1 text-sm text-red-600">{errors.position}</p>
            )}
          </div>

          {/* Company Name Field (Optional) */}
          <div>
            <label htmlFor="companyName" className="block text-sm font-medium text-gray-700 mb-2">
              Company Name (Optional)
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Building className="text-gray-400" size={20} />
              </div>
              <input
                type="text"
                id="companyName"
                name="companyName"
                value={formData.companyName}
                onChange={handleChange}
                className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="e.g., Tech Corp Inc."
              />
            </div>
          </div>

          {/* Job Description Field */}
          <div>
            <label htmlFor="jobDescription" className="block text-sm font-medium text-gray-700 mb-2">
              Job Description <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <div className="absolute top-3 left-3 pointer-events-none">
                <FileText className="text-gray-400" size={20} />
              </div>
              <textarea
                id="jobDescription"
                name="jobDescription"
                value={formData.jobDescription}
                onChange={handleChange}
                rows={8}
                className={`block w-full pl-10 pr-3 py-2 border ${
                  errors.jobDescription ? 'border-red-500' : 'border-gray-300'
                } rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none`}
                placeholder="Paste the job description here... Include responsibilities, requirements, and qualifications."
              />
            </div>
            {errors.jobDescription && (
              <p className="mt-1 text-sm text-red-600">{errors.jobDescription}</p>
            )}
            <p className="mt-1 text-xs text-gray-500">
              Minimum 50 characters. The more detailed, the better the questions!
            </p>
          </div>

          {/* Resume Upload Field (Optional) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Upload Resume (Optional)
            </label>
            
            {!formData.resume ? (
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-primary-500 transition-colors">
                <Upload className="mx-auto text-gray-400 mb-3" size={40} />
                <p className="text-sm text-gray-600 mb-2">
                  Click to upload or drag and drop
                </p>
                <p className="text-xs text-gray-500 mb-3">
                  PDF or DOCX (max 5MB)
                </p>
                <input
                  type="file"
                  accept=".pdf,.docx,.doc"
                  onChange={handleFileChange}
                  className="hidden"
                  id="resume-upload"
                />
                <label htmlFor="resume-upload">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => document.getElementById('resume-upload').click()}
                  >
                    Choose File
                  </Button>
                </label>
              </div>
            ) : (
              <div className="border border-gray-300 rounded-lg p-4 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <FileText className="text-primary-600" size={24} />
                  <div>
                    <p className="text-sm font-medium text-gray-900">{formData.resume.name}</p>
                    <p className="text-xs text-gray-500">
                      {(formData.resume.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="danger"
                  size="sm"
                  onClick={handleRemoveFile}
                >
                  Remove
                </Button>
              </div>
            )}
            
            {errors.resume && (
              <p className="mt-1 text-sm text-red-600">{errors.resume}</p>
            )}
            <p className="mt-1 text-xs text-gray-500">
              Uploading your resume helps generate more personalized questions.
            </p>
          </div>

          {/* Submit Button */}
          <div className="flex justify-end space-x-3 pt-4">
            <Button
              type="button"
              variant="ghost"
              onClick={() => navigate('/dashboard')}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              loading={isSubmitting}
              disabled={isSubmitting}
            >
              Create Session & Start Interview
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
};

export default CreateSession;