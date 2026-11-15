'use client';

import { useState } from 'react';
import { useInstall } from './useInstall';

/** The install button's click: the browser dialog, or the iPhone guide. */
export function useInstallAction() {
  const { path, promptInstall } = useInstall();
  const [guideOpen, setGuideOpen] = useState(false);
  const run = () => {
    if (path === 'ios') setGuideOpen(true);
    else void promptInstall();
  };
  return { path, run, guideOpen, setGuideOpen };
}
