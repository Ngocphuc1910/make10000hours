// Preset colors that match the project's design system
export const PRESET_COLORS = [
  '#81B214', // Light Green
  '#33B679', // Emerald Green
  '#C21505', // Bright Red
  '#176B87', // Teal Blue
  '#CB8697', // Rose Pink
  '#55B7C0', // Sky Blue
  '#B66283', // Mauve Pink
  '#CC9000', // Golden Yellow
  '#419197', // Dark Teal
  '#B02C00', // Dark Red
  '#FFD700', // Gold
  '#FF7F50'  // Coral
];

/**
 * Gets a random color from the preset colors array
 */
export const getRandomPresetColor = (): string => {
  const randomIndex = Math.floor(Math.random() * PRESET_COLORS.length);
  return PRESET_COLORS[randomIndex];
};

/**
 * Validates if a string is a valid hex color
 */
export const isValidHexColor = (color: string): boolean => {
  const hexRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
  return hexRegex.test(color);
}; 