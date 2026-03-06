export const isEmail = (email: string): boolean => {
  const at = email.trim().indexOf('@');
  return at > 0 && at !== email.length - 1;
};

// Allows splitting emails by comma, semicolon or newline
export const emailSeparator = /[,;\n]/;

/**
 * Validate multiple emails, stored as a separated string. Also validates that
 * emails are present
 */
export const validateMultipleEmails = (emails: string, separator = emailSeparator) => {
  // Empty email is considered valid in this case
  if (!emails) {
    return true;
  }
  return emails
    .split(separator)
    .filter(Boolean)
    .every((email) => isEmail(email));
};

/**
 * Validate if image URL ends with allowed extension
 * @param fileName
 * @param allowedExtensions
 */
export const isValidImageExt = (fileName = '', allowedExtensions = ['png', 'jpg', 'gif', 'svg']) => {
  if (!fileName) {
    return true;
  }
  const parts = fileName.split('.');
  return allowedExtensions.includes(parts[parts.length - 1]);
};
