import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { validateAiConfig } from './ai-config';

export function configuredModel(input: {provider:'openai'|'anthropic'|'custom'; model:string; base_url:string}) {
  const config = validateAiConfig(input);
  const key = process.env[config.provider === 'openai' ? 'OPENAI_API_KEY' : config.provider === 'anthropic' ? 'ANTHROPIC_API_KEY' : 'CUSTOM_AI_API_KEY'];
  if (!key) throw new Error('Add this provider’s key in secure project Secrets before estimating.');
  if (!config.model) throw new Error('Set an API model ID in AI Settings first.');
  // Do not follow redirects with provider credentials, even on allowlisted hosts.
  const safeFetch: typeof fetch = (input, init) => fetch(input,{...init,redirect:'manual'}).then((r)=>{ if(r.status>=300&&r.status<400) throw new Error('Provider redirect rejected'); return r; });
  if (config.provider === 'openai') return createOpenAI({apiKey:key,fetch:safeFetch}).responses(config.model);
  if (config.provider === 'anthropic') return createAnthropic({apiKey:key,fetch:safeFetch})(config.model);
  if (!config.base_url) throw new Error('Choose a custom provider address first.');
  return createOpenAICompatible({name:'custom',apiKey:key,baseURL:config.base_url,fetch:safeFetch})(config.model);
}