import { getCalendar } from '@/server/calendar/service';
import { withHandler } from '@/server/http/handler';
import { json } from '@/server/http/response';
import { calendarQuerySchema } from '@/shared/schemas/calendar';

export const GET = withHandler(
  { auth: 'required', query: calendarQuerySchema },
  async ({ userId, query }) => json(await getCalendar(userId, query)),
);
