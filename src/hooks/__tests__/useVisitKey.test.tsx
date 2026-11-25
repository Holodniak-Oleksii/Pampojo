import { Activity, useState } from 'react';
import { describe, expect, it } from 'vitest';
import { render } from '@/test/render';
import { useVisitKey } from '../useVisitKey';

function Field() {
  const [value, setValue] = useState('');
  return (
    <input aria-label="Name" value={value} onChange={(event) => setValue(event.target.value)} />
  );
}

function Page() {
  return <Field key={useVisitKey()} />;
}

function Harness() {
  const [visible, setVisible] = useState(true);
  return (
    <>
      <button type="button" onClick={() => setVisible((value) => !value)}>
        Toggle
      </button>
      <Activity mode={visible ? 'visible' : 'hidden'}>
        <Page />
      </Activity>
    </>
  );
}

describe('useVisitKey', () => {
  it('opens the page with fresh state after Activity hides and shows it', async () => {
    const screen = await render(<Harness />);
    await screen.getByRole('textbox', { name: 'Name' }).fill('Old workout');
    await screen.getByRole('button', { name: 'Toggle' }).click();
    await screen.getByRole('button', { name: 'Toggle' }).click();
    await expect.element(screen.getByRole('textbox', { name: 'Name' })).toHaveValue('');
  });
});
