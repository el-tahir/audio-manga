// ===== CATEGORY CONSTANTS =====

/**
 * All available mood categories for manga page classification.
 * This is the single source of truth for all mood categories across the application.
 */
export const MOOD_CATEGORIES = [
  'intro',
  'love',
  'love_ran',
  'casual',
  'adventure',
  'comedy',
  'action_casual',
  'action_serious',
  'tragic',
  'tension',
  'confrontation',
  'investigation',
  'revelation',
  'conclusion',
] as const;

export type MoodCategory = (typeof MOOD_CATEGORIES)[number];

/**
 * Human-readable labels for mood categories used in UI components.
 */
export const MOOD_CATEGORY_LABELS: Record<MoodCategory, string> = {
  intro: 'Intro/Opening',
  love: 'Love/Romance',
  love_ran: 'Love (Ran Focus)',
  casual: 'Casual/Everyday',
  adventure: 'Adventure',
  comedy: 'Comedy',
  action_casual: 'Action (Casual)',
  action_serious: 'Action (Serious)',
  tragic: 'Tragic/Sad',
  tension: 'Tension/Suspense',
  confrontation: 'Confrontation',
  investigation: 'Investigation',
  revelation: 'Revelation',
  conclusion: 'Conclusion',
};

// ===== UI STYLING CONSTANTS =====

/**
 * Color styling for mood categories used in classification bubbles and UI components.
 * Each category has a background color and text color for optimal contrast.
 */
export const MOOD_CATEGORY_STYLES: Record<MoodCategory, { bg: string; text: string }> = {
  intro: { bg: '#3498db', text: 'white' }, // Blue
  love: { bg: '#e84393', text: 'white' }, // Pink
  love_ran: { bg: '#ff69b4', text: 'white' }, // Hot Pink
  casual: { bg: '#00b894', text: 'white' }, // Mint
  adventure: { bg: '#1abc9c', text: 'white' }, // Turquoise
  comedy: { bg: '#f1c40f', text: 'black' }, // Yellow
  action_casual: { bg: '#e74c3c', text: 'white' }, // Red
  action_serious: { bg: '#c0392b', text: 'white' }, // Dark Red
  tragic: { bg: '#34495e', text: 'white' }, // Dark Gray-Blue
  tension: { bg: '#8e44ad', text: 'white' }, // Dark Purple
  confrontation: { bg: '#d35400', text: 'white' }, // Pumpkin Orange
  investigation: { bg: '#2980b9', text: 'white' }, // Darker Blue
  revelation: { bg: '#16a085', text: 'white' }, // Teal
  conclusion: { bg: '#27ae60', text: 'white' }, // Dark Green
};

/**
 * Default style fallback for unknown or invalid categories.
 */
export const DEFAULT_CATEGORY_STYLE = { bg: '#7f8c8d', text: 'white' }; // Medium Gray

/**
 * Tailwind CSS border color classes for mood categories used in card borders.
 */
export const MOOD_CATEGORY_BORDER_COLORS: Record<MoodCategory, string> = {
  intro: 'border-blue-500',
  love: 'border-pink-500',
  love_ran: 'border-pink-400',
  casual: 'border-green-500',
  adventure: 'border-teal-500',
  comedy: 'border-yellow-500',
  action_casual: 'border-red-500',
  action_serious: 'border-red-700',
  tragic: 'border-gray-500',
  tension: 'border-purple-500',
  confrontation: 'border-orange-600',
  investigation: 'border-sky-500',
  revelation: 'border-emerald-500',
  conclusion: 'border-green-600',
};

/**
 * Default border color for unknown categories.
 */
export const DEFAULT_BORDER_COLOR = 'border-gray-600';

// ===== APPLICATION CONSTANTS =====

/**
 * Slug identifier for Detective Conan series in Cubari API.
 */
export const DETECTIVE_CONAN_SLUG = '01J76XY7HA6DH9YYGREDVPH8W5';

/**
 * Cubari API base URL for series data.
 */
export const CUBARI_API_BASE = 'https://cubari.moe/read/api/weebcentral/series';

/**
 * Timeout duration for image downloads (in milliseconds).
 */
export const IMAGE_DOWNLOAD_TIMEOUT = 30000; // 30 seconds

/**
 * Polling interval for checking chapter processing status (in milliseconds).
 */
export const POLLING_INTERVAL = 5000; // 5 seconds

// ===== UTILITY FUNCTIONS =====

/**
 * Gets the style configuration for a given mood category.
 * Returns default style if category is not found.
 *
 * @param category - The mood category to get styles for
 * @returns Object containing background and text colors
 */
export function getMoodCategoryStyle(category: MoodCategory | string): {
  bg: string;
  text: string;
} {
  return MOOD_CATEGORY_STYLES[category as MoodCategory] || DEFAULT_CATEGORY_STYLE;
}

/**
 * Gets the Tailwind border color class for a given mood category.
 * Returns default border color if category is not found.
 *
 * @param category - The mood category to get border color for
 * @returns Tailwind CSS border color class
 */
export function getMoodCategoryBorderColor(category: MoodCategory | string | null): string {
  if (!category) return DEFAULT_BORDER_COLOR;
  return MOOD_CATEGORY_BORDER_COLORS[category as MoodCategory] || DEFAULT_BORDER_COLOR;
}
