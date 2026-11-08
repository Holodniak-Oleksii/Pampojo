/* eslint-disable no-restricted-syntax -- fixtures below contain the very patterns the rules forbid */
import { ESLint } from 'eslint';
import { describe, expect, it } from 'vitest';

const eslint = new ESLint({ cwd: process.cwd() });

async function restrictedSyntaxMessages(code: string, filePath = 'src/components/Foo/Foo.tsx') {
  const [result] = await eslint.lintText(code, { filePath });
  return (result?.messages ?? []).filter((message) => message.ruleId === 'no-restricted-syntax');
}

describe('hex color rule', () => {
  it('reports a hex color in a string literal', async () => {
    const messages = await restrictedSyntaxMessages("export const c = '#F59A62';\n");
    expect(messages).toHaveLength(1);
    expect(messages[0]?.message).toBe('Use a design token instead of a hex color.');
  });

  it('reports a hex color in a template literal', async () => {
    const messages = await restrictedSyntaxMessages('export const c = `bg-[#fff]`;\n');
    expect(messages).toHaveLength(1);
  });

  it('reports a hex color in a JSX style object', async () => {
    const code = "export function Foo() {\n  return <div style={{ color: '#262626' }} />;\n}\n";
    expect(await restrictedSyntaxMessages(code)).toHaveLength(1);
  });

  it('ignores anchors that are not colors', async () => {
    expect(await restrictedSyntaxMessages("export const href = '#section';\n")).toHaveLength(0);
  });
});

describe('static translation key rule', () => {
  const tMessages = async (call: string) =>
    restrictedSyntaxMessages(
      `declare const t: (key: string) => string;\ndeclare const i18n: { t: (key: string) => string };\ndeclare const key: string;\nexport const value = ${call};\n`,
      'src/components/Foo/foo.ts',
    );

  it.each(['t(key)', 't(`x`)', 'i18n.t(key)'])('reports %s', async (call) => {
    const messages = await tMessages(call);
    expect(messages).toHaveLength(1);
    expect(messages[0]?.message).toBe('t() needs a string literal key so extraction can see it.');
  });

  it('accepts a string literal key', async () => {
    expect(await tMessages("t('Online')")).toHaveLength(0);
  });
});
