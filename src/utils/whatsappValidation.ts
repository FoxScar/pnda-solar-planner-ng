/**
 * Validates and formats WhatsApp numbers in international format
 */

export const validateWhatsAppNumber = (number: string): { isValid: boolean; message?: string } => {
  // Remove all non-digit characters except + at the beginning
  const cleaned = number.replace(/[^\d+]/g, '');
  
  // Check if it starts with +
  if (!cleaned.startsWith('+')) {
    return { isValid: false, message: 'WhatsApp number must start with country code (e.g., +1, +234)' };
  }
  
  // Remove the + for further validation
  const withoutPlus = cleaned.substring(1);
  
  // Check if it contains only digits after +
  if (!/^\d+$/.test(withoutPlus)) {
    return { isValid: false, message: 'WhatsApp number must contain only digits after country code' };
  }
  
  // Check length (minimum 10 digits, maximum 15 digits including country code)
  if (withoutPlus.length < 10 || withoutPlus.length > 15) {
    return { isValid: false, message: 'WhatsApp number must be between 10-15 digits including country code' };
  }
  
  return { isValid: true };
};

export const formatWhatsAppNumber = (number: string): string => {
  // Remove all non-digit characters except + at the beginning
  let cleaned = number.replace(/[^\d+]/g, '');
  
  // Ensure it starts with +
  if (!cleaned.startsWith('+')) {
    cleaned = '+' + cleaned;
  }
  
  return cleaned;
};

export const formatWhatsAppForDisplay = (number: string): string => {
  const formatted = formatWhatsAppNumber(number);
  const withoutPlus = formatted.substring(1);
  
  // Add spaces for better readability
  if (withoutPlus.length >= 10) {
    // Format as: +234 xxx xxx xxxx
    const countryCode = withoutPlus.substring(0, 3);
    const remaining = withoutPlus.substring(3);
    
    if (remaining.length <= 3) {
      return `+${countryCode} ${remaining}`;
    } else if (remaining.length <= 6) {
      return `+${countryCode} ${remaining.substring(0, 3)} ${remaining.substring(3)}`;
    } else {
      return `+${countryCode} ${remaining.substring(0, 3)} ${remaining.substring(3, 6)} ${remaining.substring(6)}`;
    }
  }
  
  return formatted;
};

export const getWhatsAppUrl = (number: string, text: string): string => {
  const formattedNumber = formatWhatsAppNumber(number);
  const encodedText = encodeURIComponent(text);
  return `https://wa.me/${formattedNumber.substring(1)}?text=${encodedText}`;
};