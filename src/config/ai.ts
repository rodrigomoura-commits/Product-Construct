/**
 * CENTRALIZED AI CONFIGURATION
 * Note: These are fallback values for the frontend. 
 * The actual model is resolved dynamically by the backend.
 */

export const GEMINI_MODEL = "gemini-2.5-flash"; // Default fallback value for initialization

export const GEMINI_MODELS = [
  { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
  { value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
  { value: 'gemini-2.0-flash-lite', label: 'Gemini 2.0 Flash Lite' },
];

export const DEFAULT_AI_CONFIG = {
  temperature: 0.4,
  maxOutputTokens: 2048,
};
