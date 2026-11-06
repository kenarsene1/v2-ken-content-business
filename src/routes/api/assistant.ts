import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/api/assistant')({
  server: { handlers: { POST: async ({ request }) => {
    const { respondToAssistant } = await import('@/lib/assistant.server');
    return respondToAssistant(request);
  } } },
});