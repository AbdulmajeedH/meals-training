/**
 * Supabase Edge Function: estimate a food's macros from an Arabic description.
 *
 * This exists so the Anthropic API key never ships inside the app. The app
 * holds only the Supabase URL and anon key (both public by design); the
 * Anthropic key lives here as a Supabase secret and is never returned to the
 * client.
 *
 * Deploy:
 *   supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
 *   supabase functions deploy estimate-food
 *
 * Request:  { "text": "صدر دجاج مشوي 150 جم" }
 * Response: { "nameAr", "servingLabel", "kcal", "proteinG", "carbsG", "fatG", "confidence", "note" }
 */

import Anthropic from 'npm:@anthropic-ai/sdk@0.124.0';
import { z } from 'npm:zod@4.6.1';
import { zodOutputFormat } from 'npm:@anthropic-ai/sdk@0.124.0/helpers/zod';

const FoodEstimate = z.object({
  nameAr: z.string().describe('اسم الطعام بالعربية، مختصر'),
  servingLabel: z.string().describe('حجم الحصة، مثل "100 جم" أو "كوب (155 جم)"'),
  kcal: z.number().describe('السعرات لكل حصة واحدة'),
  proteinG: z.number().describe('البروتين بالجرام لكل حصة'),
  carbsG: z.number().describe('الكربوهيدرات بالجرام لكل حصة'),
  fatG: z.number().describe('الدهون بالجرام لكل حصة'),
  confidence: z.enum(['high', 'medium', 'low']),
  note: z.string().describe('ملاحظة قصيرة بالعربية عن أي افتراض في التقدير'),
});

const SYSTEM = `أنت مساعد تغذية. تُقدّر الماكروز لطعام يصفه المستخدم بالعربية.

قواعد:
- القيم دائماً لحصة واحدة، وتذكر حجم الحصة صراحةً في servingLabel.
- إذا ذكر المستخدم وزناً، اجعل الحصة بذلك الوزن.
- إذا لم يذكر وزناً، استخدم حصة شائعة واذكرها.
- أوزان اللحوم والدجاج والرز تُفهم على أنها بعد الطبخ ما لم يُذكر غير ذلك.
- استخدم قيماً مرجعية معتادة لتركيب الأغذية. لا تخترع أرقاماً دقيقة زائفة.
- اجعل confidence منخفضة إذا كان الوصف مبهماً أو من مطعم غير معروف.
- في note اذكر بإيجاز أي افتراض اتخذته (طريقة الطبخ، الزيت، حجم الحصة).`;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!apiKey) {
    // Misconfiguration, not a user error — say so plainly rather than failing opaquely.
    return json({ error: 'missing_api_key', message: 'ANTHROPIC_API_KEY is not set' }, 500);
  }

  let text: unknown;
  try {
    ({ text } = await request.json());
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }

  if (typeof text !== 'string' || text.trim().length === 0) {
    return json({ error: 'missing_text' }, 400);
  }
  if (text.length > 500) {
    return json({ error: 'text_too_long' }, 400);
  }

  const client = new Anthropic({ apiKey });

  try {
    const response = await client.messages.parse({
      model: 'claude-opus-5',
      max_tokens: 2048,
      system: SYSTEM,
      messages: [{ role: 'user', content: text.trim() }],
      output_config: { format: zodOutputFormat(FoodEstimate) },
    });

    // A safety decline arrives as HTTP 200 — check before reading the output.
    if (response.stop_reason === 'refusal') {
      return json({ error: 'refused', category: response.stop_details?.category ?? null }, 422);
    }

    if (!response.parsed_output) {
      return json({ error: 'unparsable_response' }, 502);
    }

    return json(response.parsed_output);
  } catch (error) {
    const status = error instanceof Anthropic.APIError ? error.status : 500;
    return json(
      {
        error: 'upstream_error',
        // The message is safe to relay; the key never appears in it.
        message: error instanceof Error ? error.message : 'unknown error',
      },
      status && status >= 400 && status < 600 ? status : 500,
    );
  }
});
