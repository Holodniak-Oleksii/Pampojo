import { checkHealth } from '@/server/health/service';
import { withHandler } from '@/server/http/handler';
import { json } from '@/server/http/response';

export const GET = withHandler({ auth: 'none' }, async () => {
  const health = await checkHealth();
  return json(health, {
    status: health.ok ? 200 : 503,
    headers: { 'Cache-Control': 'no-store' },
  });
});
