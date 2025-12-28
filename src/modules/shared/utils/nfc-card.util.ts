import { randomBytes } from 'crypto';

/**
 * Generate a secure random NFC card ID
 * Format: Prefix + Random string (e.g., NFC-ABC123XYZ456)
 * @param prefix Optional prefix (default: 'NFC')
 * @returns Secure random NFC card ID
 */
export function generateSecureNfcCardId(prefix: string = 'NFC'): string {
  // Generate 12 random alphanumeric characters
  const randomPart = randomBytes(8)
    .toString('base64')
    .replace(/[+/=]/g, '') // Remove special characters
    .substring(0, 12)
    .toUpperCase();
  
  return `${prefix}-${randomPart}`;
}

/**
 * Validate NFC card ID format and security
 * Ensures ID doesn't contain student information patterns
 * @param cardId NFC card ID to validate
 * @returns Validation result with error message if invalid
 */
export function validateNfcCardId(cardId: string): {
  valid: boolean;
  error?: string;
} {
  if (!cardId || cardId.trim().length === 0) {
    return { valid: false, error: 'NFC card ID cannot be empty' };
  }

  const trimmed = cardId.trim();

  // Minimum and maximum length
  if (trimmed.length < 8) {
    return {
      valid: false,
      error: 'NFC card ID must be at least 8 characters long',
    };
  }

  if (trimmed.length > 100) {
    return {
      valid: false,
      error: 'NFC card ID must be no more than 100 characters long',
    };
  }

  // Prevent patterns that could expose student information
  // Don't allow registration numbers as NFC IDs
  if (/^(REG|STU|STD)[-_\s]?\d{4,}/i.test(trimmed)) {
    return {
      valid: false,
      error:
        'NFC card ID cannot resemble a registration number (REG-*, STU-*, etc.)',
    };
  }

  // Don't allow patterns that look like dates (YYYY-MM-DD, etc.)
  if (/\d{4}[-_]\d{2}[-_]\d{2}/.test(trimmed)) {
    return {
      valid: false,
      error: 'NFC card ID cannot contain date patterns',
    };
  }

  // Don't allow email-like patterns
  if (/@/.test(trimmed)) {
    return {
      valid: false,
      error: 'NFC card ID cannot contain email-like patterns',
    };
  }

  // Allow alphanumeric, hyphens, underscores, and dots
  if (!/^[A-Z0-9._-]+$/i.test(trimmed)) {
    return {
      valid: false,
      error:
        'NFC card ID can only contain letters, numbers, hyphens, underscores, and dots',
    };
  }

  return { valid: true };
}

/**
 * Normalize NFC card ID (trim, uppercase)
 * @param cardId Raw NFC card ID
 * @returns Normalized NFC card ID
 */
export function normalizeNfcCardId(cardId: string): string {
  return cardId.trim().toUpperCase();
}

