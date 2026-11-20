import { afterEach } from 'vitest';
import { resetConnectivity } from '@/services/connectivity';

afterEach(() => {
  resetConnectivity();
});
