'use client';

import { SerwistProvider } from '@serwist/turbopack/react';
import { useEffect, type ReactNode } from 'react';
import { SW_URL } from '../constants';
import { attachInstallListeners, isStandalone } from '../install';
import { requestPersistentStorage } from '../persist';

export function PwaProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    const detach = attachInstallListeners();
    if (isStandalone()) void requestPersistentStorage();
    return detach;
  }, []);

  return (
    <SerwistProvider
      swUrl={SW_URL}
      disable={process.env.NODE_ENV !== 'production'}
      // A returning connection must not reload the page in the middle of a workout.
      reloadOnOnline={false}
    >
      {children}
    </SerwistProvider>
  );
}
