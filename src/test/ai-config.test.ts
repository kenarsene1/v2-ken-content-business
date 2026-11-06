import {expect,it} from 'vitest';
import {validateAiConfig} from '@/lib/ai-config';
it('rejects custom endpoints outside trusted providers',()=>{
  for(const base_url of ['http://localhost','https://127.0.0.1','https://api.groq.com.evil.test/openai/v1','https://api.groq.com/openai/v1/other']) expect(()=>validateAiConfig({provider:'custom',model:'chosen-model',base_url})).toThrow();
  expect(validateAiConfig({provider:'custom',model:'chosen-model',base_url:'https://api.groq.com/openai/v1'}).provider).toBe('custom');
});