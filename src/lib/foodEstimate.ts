import { getClient, isConfigured } from './supabase';

/**
 * Natural-language food logging: describe a food in Arabic, get macros back.
 *
 * The request goes to the estimate-food Edge Function, never to Anthropic
 * directly — the API key stays server-side. Estimates are always presented for
 * review before they become a food, because they are estimates.
 */

export type FoodEstimate = {
  nameAr: string;
  servingLabel: string;
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  confidence: 'high' | 'medium' | 'low';
  note: string;
};

export type EstimateResult =
  | { ok: true; estimate: FoodEstimate }
  | { ok: false; reason: 'not_configured' | 'refused' | 'network' | 'bad_response'; message?: string };

function isEstimate(value: unknown): value is FoodEstimate {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.nameAr === 'string' &&
    typeof candidate.servingLabel === 'string' &&
    typeof candidate.kcal === 'number' &&
    typeof candidate.proteinG === 'number' &&
    typeof candidate.carbsG === 'number' &&
    typeof candidate.fatG === 'number'
  );
}

export async function estimateFood(text: string): Promise<EstimateResult> {
  if (!isConfigured()) return { ok: false, reason: 'not_configured' };

  const client = getClient();
  if (!client) return { ok: false, reason: 'not_configured' };

  try {
    const { data, error } = await client.functions.invoke('estimate-food', {
      body: { text },
    });

    if (error) {
      return { ok: false, reason: 'network', message: error.message };
    }

    if (typeof data === 'object' && data !== null && 'error' in data) {
      const reason = (data as { error: string }).error;
      return {
        ok: false,
        reason: reason === 'refused' ? 'refused' : 'bad_response',
        message: reason,
      };
    }

    if (!isEstimate(data)) return { ok: false, reason: 'bad_response' };

    return { ok: true, estimate: data };
  } catch (error) {
    return {
      ok: false,
      reason: 'network',
      message: error instanceof Error ? error.message : undefined,
    };
  }
}

export const CONFIDENCE_LABEL_AR = {
  high: 'ثقة عالية',
  medium: 'ثقة متوسطة',
  low: 'ثقة منخفضة',
} as const;
