/** Display names for the feature ids the rollups use (src/services/metrics/features.js in the API). */
export const FEATURE_NAMES: Record<string, string> = {
  closet: 'Closet', scan: 'Scan outfit', planner: 'Planner', wear_log: 'Wear log', today: 'Today suggestions', kween: 'Ask Kween',
  fit_check: 'Fit check', beautify: 'Beautify', try_on: 'Try-on', shop: 'Shopping', colours: 'Colours', find_me: 'Find me',
  social: 'Social', insights: 'Insights', taste: 'Taste', export: 'Closet export',
};

/** "outfit_plan" → "Outfit plan" */
export const humanise = (s: string) => s.replace(/[_:]/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
