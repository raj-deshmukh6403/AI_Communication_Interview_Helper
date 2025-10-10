import React, { useState } from 'react';
import { User, Mail, Calendar, Award, Lock } from 'lucide-react';
import { useAuthContext } from '../context/AuthContext';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import Modal from '../components/common/Modal';
import { formatDate } from '../utils/helpers';
import { validateChangePasswordForm } from '../utils/validators';

const Profile = () => {
  const { user, changePassword } = useAuthContext();
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordData, setPasswordData] = useState({
    oldPassword: '',
    newPassword: '',
    confirmNewPassword: '',
  });
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  const handlePasswordChange = (e) => {
    const { name, value } = e.target;
    setPasswordData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: '' }));
    setSuccessMessage('');
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setSuccessMessage('');

    const validation = validateChangePasswordForm(passwordData);
    if (!validation.valid) {
      setErrors(validation.errors);
      return;
    }

    setIsSubmitting(true);
    const result = await changePassword(passwordData.oldPassword, passwordData.newPassword);
    setIsSubmitting(false);

    if (result.success) {
      setSuccessMessage('Password changed successfully!');
      setPasswordData({ oldPassword: '', newPassword: '', confirmNewPassword: '' });
      setTimeout(() => {
        setShowPasswordModal(false);
        setSuccessMessage('');
      }, 2000);
    } else {
      setErrors({ oldPassword: result.error || 'Failed to change password' });
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">My Profile</h1>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card title="Personal Information">
              <div className="space-y-4">
                <div className="flex items-center space-x-3">
                  <User className="text-gray-400" size={20} />
                  <div>
                    <p className="text-sm text-gray-500">Full Name</p>
                    <p className="font-medium text-gray-900">{user?.full_name}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <Mail className="text-gray-400" size={20} />
                  <div>
                    <p className="text-sm text-gray-500">Email</p>
                    <p className="font-medium text-gray-900">{user?.email}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <Calendar className="text-gray-400" size={20} />
                  <div>
                    <p className="text-sm text-gray-500">Member Since</p>
                    <p className="font-medium text-gray-900">{formatDate(user?.created_at)}</p>
                  </div>
                </div>
              </div>
            </Card>

            <Card title="Account Settings">
              <div className="flex items-center justify-between py-3">
                <div className="flex items-center space-x-3">
                  <Lock className="text-gray-400" size={20} />
                  <div>
                    <p className="font-medium text-gray-900">Password</p>
                    <p className="text-sm text-gray-500">Change your password</p>
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={() => setShowPasswordModal(true)}>
                  Change
                </Button>
              </div>
            </Card>
          </div>

          <div>
            <Card title="Statistics">
              <div className="space-y-4">
                <div className="bg-blue-50 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-gray-600">Total Sessions</span>
                    <Award className="text-blue-600" size={20} />
                  </div>
                  <p className="text-2xl font-bold text-gray-900">{user?.sessions_count || 0}</p>
                </div>
                <div className="bg-green-50 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-gray-600">Practice Time</span>
                    <Award className="text-green-600" size={20} />
                  </div>
                  <p className="text-2xl font-bold text-gray-900">
                    {Math.round(user?.total_practice_time_minutes || 0)} min
                  </p>
                </div>
              </div>
            </Card>
          </div>
        </div>

        <Modal
          isOpen={showPasswordModal}
          onClose={() => {
            setShowPasswordModal(false);
            setPasswordData({ oldPassword: '', newPassword: '', confirmNewPassword: '' });
            setErrors({});
            setSuccessMessage('');
          }}
          title="Change Password"
        >
          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            {successMessage && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-green-800 text-sm">
                {successMessage}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Current Password</label>
              <input
                type="password"
                name="oldPassword"
                value={passwordData.oldPassword}
                onChange={handlePasswordChange}
                className={`block w-full px-3 py-2 border ${errors.oldPassword ? 'border-red-500' : 'border-gray-300'} rounded-lg`}
              />
              {errors.oldPassword && <p className="mt-1 text-sm text-red-600">{errors.oldPassword}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">New Password</label>
              <input
                type="password"
                name="newPassword"
                value={passwordData.newPassword}
                onChange={handlePasswordChange}
                className={`block w-full px-3 py-2 border ${errors.newPassword ? 'border-red-500' : 'border-gray-300'} rounded-lg`}
              />
              {errors.newPassword && <p className="mt-1 text-sm text-red-600">{errors.newPassword}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Confirm New Password</label>
              <input
                type="password"
                name="confirmNewPassword"
                value={passwordData.confirmNewPassword}
                onChange={handlePasswordChange}
                className={`block w-full px-3 py-2 border ${errors.confirmNewPassword ? 'border-red-500' : 'border-gray-300'} rounded-lg`}
              />
              {errors.confirmNewPassword && <p className="mt-1 text-sm text-red-600">{errors.confirmNewPassword}</p>}
            </div>

            <div className="flex justify-end space-x-3 pt-4">
              <Button type="button" variant="ghost" onClick={() => setShowPasswordModal(false)}>Cancel</Button>
              <Button type="submit" variant="primary" loading={isSubmitting}>Change Password</Button>
            </div>
          </form>
        </Modal>
      </div>
    </div>
  );
};

export default Profile;