import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';

/** Only the verified account ID reaches the browser, never claims or credentials. */
export const assistantIdentity = createServerFn({ method: 'GET' }).middleware([requireSupabaseAuth]).handler(({ context }) => ({ userId: context.userId }));