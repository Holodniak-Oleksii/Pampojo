import { THEME_SCRIPT } from './theme-script';

/** Inline and blocking on purpose: the theme must be set before the first paint. */
export function ThemeScript() {
  return <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />;
}
