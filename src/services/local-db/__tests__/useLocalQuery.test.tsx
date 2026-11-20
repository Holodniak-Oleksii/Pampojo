import { afterEach, describe, expect, it } from 'vitest';
import { useMeasurementsQuery } from '@/api/measurements';
import { render, TEST_USER_ID } from '@/test/render';
import { resetLocalDbs } from '@/test/local-session';
import { openLocalDb } from '../db';

afterEach(async () => {
  await resetLocalDbs();
});

function Count() {
  const query = useMeasurementsQuery();
  return <p>{query.data ? `${query.data.length} rows` : 'loading'}</p>;
}

describe('useLocalQuery', () => {
  it('updates the result when the table changes', async () => {
    const screen = await render(<Count />, { localDb: true });
    await expect.element(screen.getByText('0 rows')).toBeVisible();
    await openLocalDb(TEST_USER_ID).measurements.put({
      id: crypto.randomUUID(),
      type: 'weight',
      value: 80,
      measuredOn: '2026-11-01',
      updatedAt: '2026-11-01T10:00:00.000Z',
    });
    await expect.element(screen.getByText('1 rows')).toBeVisible();
  });
});
