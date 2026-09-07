import { useEffect, useState } from 'react';

/** Quick requests stay quiet, including for assistive technology. */
export function useDelayedPending(pending: boolean, delay = 300) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!pending) {
      setVisible(false);
      return;
    }
    const timer = setTimeout(() => setVisible(true), delay);
    return () => clearTimeout(timer);
  }, [pending, delay]);
  return pending && visible;
}
