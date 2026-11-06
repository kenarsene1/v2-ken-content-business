import { z } from 'zod';
export const aiConfigSchema = z.object({ provider: z.enum(['openai','anthropic','custom']), model: z.string().trim().max(120), base_url: z.string().trim().max(300) });
export const CUSTOM_ENDPOINTS = ['https://api.groq.com/openai/v1', 'https://api.together.xyz/v1', 'https://openrouter.ai/api/v1', 'https://api.deepseek.com/v1', 'https://api.mistral.ai/v1'];
export function validateAiConfig(input: z.infer<typeof aiConfigSchema>) {
  const config = aiConfigSchema.parse(input);
  if (config.provider === 'custom' && config.base_url && !CUSTOM_ENDPOINTS.includes(config.base_url.replace(/\/$/,''))) throw new Error('Choose a supported HTTPS provider address.');
  return config;
}