import { VALIDATION_RULES, FILE_UPLOAD } from './constants';

/**
 * Validate email format
 */
export const validateEmail = (email) => {
  if (!email) {
    return { valid: false, error: 'Email is required' };
  }
  
  if (!VALIDATION_RULES.EMAIL_PATTERN.test(email)) {
    return { valid: false, error: 'Invalid email format' };
  }
  
  return { valid: true, error: null };
};

/**
 * Validate password
 */
export const validatePassword = (password) => {
  if (!password) {
    return { valid: false, error: 'Password is required' };
  }
  
  if (password.length < VALIDATION_RULES.PASSWORD_MIN_LENGTH) {
    return { 
      valid: false, 
      error: `Password must be at least ${VALIDATION_RULES.PASSWORD_MIN_LENGTH} characters` 
    };
  }
  
  // Check for at least one uppercase letter
  if (!/[A-Z]/.test(password)) {
    return { 
      valid: false, 
      error: 'Password must contain at least one uppercase letter' 
    };
  }
  
  // Check for at least one lowercase letter
  if (!/[a-z]/.test(password)) {
    return { 
      valid: false, 
      error: 'Password must contain at least one lowercase letter' 
    };
  }
  
  // Check for at least one number
  if (!/\d/.test(password)) {
    return { 
      valid: false, 
      error: 'Password must contain at least one number' 
    };
  }
  
  return { valid: true, error: null };
};

/**
 * Validate password confirmation
 */
export const validatePasswordConfirmation = (password, confirmPassword) => {
  if (!confirmPassword) {
    return { valid: false, error: 'Please confirm your password' };
  }
  
  if (password !== confirmPassword) {
    return { valid: false, error: 'Passwords do not match' };
  }
  
  return { valid: true, error: null };
};

/**
 * Validate full name
 */
export const validateFullName = (name) => {
  if (!name || name.trim().length === 0) {
    return { valid: false, error: 'Name is required' };
  }
  
  if (name.trim().length < VALIDATION_RULES.NAME_MIN_LENGTH) {
    return { 
      valid: false, 
      error: `Name must be at least ${VALIDATION_RULES.NAME_MIN_LENGTH} characters` 
    };
  }
  
  return { valid: true, error: null };
};

/**
 * Validate job description
 */
export const validateJobDescription = (description) => {
  if (!description || description.trim().length === 0) {
    return { valid: false, error: 'Job description is required' };
  }
  
  if (description.trim().length < VALIDATION_RULES.JOB_DESCRIPTION_MIN_LENGTH) {
    return { 
      valid: false, 
      error: `Job description must be at least ${VALIDATION_RULES.JOB_DESCRIPTION_MIN_LENGTH} characters` 
    };
  }
  
  return { valid: true, error: null };
};

/**
 * Validate position/job title
 */
export const validatePosition = (position) => {
  if (!position || position.trim().length === 0) {
    return { valid: false, error: 'Position is required' };
  }
  
  if (position.trim().length < VALIDATION_RULES.POSITION_MIN_LENGTH) {
    return { 
      valid: false, 
      error: `Position must be at least ${VALIDATION_RULES.POSITION_MIN_LENGTH} characters` 
    };
  }
  
  return { valid: true, error: null };
};

/**
 * Validate file upload
 */
export const validateFile = (file) => {
  if (!file) {
    return { valid: true, error: null }; // File is optional
  }
  
  // Check file size
  const maxSize = FILE_UPLOAD.MAX_SIZE_MB * 1024 * 1024;
  if (file.size > maxSize) {
    return { 
      valid: false, 
      error: `File size must be less than ${FILE_UPLOAD.MAX_SIZE_MB}MB` 
    };
  }
  
  // Check file type
  const fileName = file.name.toLowerCase();
  const isValidType = FILE_UPLOAD.ALLOWED_TYPES.some(type => fileName.endsWith(type));
  
  if (!isValidType) {
    return { 
      valid: false, 
      error: `Only ${FILE_UPLOAD.ALLOWED_TYPES.join(', ')} files are allowed` 
    };
  }
  
  return { valid: true, error: null };
};

/**
 * Validate login form
 */
export const validateLoginForm = (email, password) => {
  const errors = {};
  
  const emailValidation = validateEmail(email);
  if (!emailValidation.valid) {
    errors.email = emailValidation.error;
  }
  
  if (!password) {
    errors.password = 'Password is required';
  }
  
  return {
    valid: Object.keys(errors).length === 0,
    errors
  };
};

/**
 * Validate registration form
 */
export const validateRegistrationForm = (formData) => {
  const errors = {};
  
  const nameValidation = validateFullName(formData.fullName);
  if (!nameValidation.valid) {
    errors.fullName = nameValidation.error;
  }
  
  const emailValidation = validateEmail(formData.email);
  if (!emailValidation.valid) {
    errors.email = emailValidation.error;
  }
  
  const passwordValidation = validatePassword(formData.password);
  if (!passwordValidation.valid) {
    errors.password = passwordValidation.error;
  }
  
  const confirmValidation = validatePasswordConfirmation(
    formData.password, 
    formData.confirmPassword
  );
  if (!confirmValidation.valid) {
    errors.confirmPassword = confirmValidation.error;
  }
  
  return {
    valid: Object.keys(errors).length === 0,
    errors
  };
};

/**
 * Validate session creation form
 */
export const validateSessionForm = (formData) => {
  const errors = {};
  
  const positionValidation = validatePosition(formData.position);
  if (!positionValidation.valid) {
    errors.position = positionValidation.error;
  }
  
  const descriptionValidation = validateJobDescription(formData.jobDescription);
  if (!descriptionValidation.valid) {
    errors.jobDescription = descriptionValidation.error;
  }
  
  if (formData.resume) {
    const fileValidation = validateFile(formData.resume);
    if (!fileValidation.valid) {
      errors.resume = fileValidation.error;
    }
  }
  
  return {
    valid: Object.keys(errors).length === 0,
    errors
  };
};

/**
 * Validate change password form
 */
export const validateChangePasswordForm = (formData) => {
  const errors = {};
  
  if (!formData.oldPassword) {
    errors.oldPassword = 'Current password is required';
  }
  
  const newPasswordValidation = validatePassword(formData.newPassword);
  if (!newPasswordValidation.valid) {
    errors.newPassword = newPasswordValidation.error;
  }
  
  const confirmValidation = validatePasswordConfirmation(
    formData.newPassword,
    formData.confirmNewPassword
  );
  if (!confirmValidation.valid) {
    errors.confirmNewPassword = confirmValidation.error;
  }
  
  // Check that new password is different from old
  if (formData.oldPassword && formData.newPassword && 
      formData.oldPassword === formData.newPassword) {
    errors.newPassword = 'New password must be different from current password';
  }
  
  return {
    valid: Object.keys(errors).length === 0,
    errors
  };
};