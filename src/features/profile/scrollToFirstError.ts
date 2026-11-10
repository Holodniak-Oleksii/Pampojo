/** Centers the first invalid field, so its message is not left under a sticky button row. */
export function scrollToFirstError(form: HTMLFormElement | null) {
  // After the render that shows the errors.
  requestAnimationFrame(() => {
    form
      ?.querySelector<HTMLElement>('[aria-invalid="true"], fieldset[aria-describedby]')
      ?.scrollIntoView({ block: 'center' });
  });
}
