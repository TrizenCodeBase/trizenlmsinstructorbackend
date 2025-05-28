/**
 * Generates a unique instructor ID with TIN prefix followed by 4 random characters/numbers
 */
export function generateInstructorId(): string {
  const characters = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let result = 'TIN';
  
  // Generate 4 random characters
  for (let i = 0; i < 4; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  
  return result;
}

/**
 * Validates if a string matches the instructor ID format (TIN + 4 alphanumeric characters)
 */
export function isValidInstructorId(id: string): boolean {
  return /^TIN[0-9A-Z]{4}$/.test(id);
} 