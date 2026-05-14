/**
 * CENTRALIZED AI CONFIGURATION
 */

export const GEMINI_MODEL = import.meta.env.VITE_GEMINI_MODEL || "gemini-2.5-flash";

export const GEMINI_MODELS = [
  { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash (Latest)' },
  { value: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash' },
  { value: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash' },
  { value: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro' },
];

export const DEFAULT_AI_CONFIG = {
  model: GEMINI_MODEL,
  temperature: 0.4,
  maxOutputTokens: 2048,
};
