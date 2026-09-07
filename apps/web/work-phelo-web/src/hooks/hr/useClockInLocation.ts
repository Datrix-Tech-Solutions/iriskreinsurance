import { useCallback, useState } from 'react';
import { geocodeReverse } from '@/lib/maptiler';

export type LocationCaptureStatus = 'idle' | 'loading' | 'ready' | 'error';

// Best-effort location label for clock-in — never blocks the action if it fails or is denied.
export function useClockInLocation() {
  const [status, setStatus] = useState<LocationCaptureStatus>('idle');
  const [label, setLabel] = useState<string | null>(null);

  const capture = useCallback(() => {
    setStatus('loading');
    setLabel(null);

    if (!navigator.geolocation) {
      setStatus('error');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { latitude, longitude } = pos.coords;
          const placeName = await geocodeReverse(longitude, latitude);
          setLabel(placeName);
          setStatus(placeName ? 'ready' : 'error');
        } catch {
          setStatus('error');
        }
      },
      () => setStatus('error'),
      { timeout: 8000, maximumAge: 60000 },
    );
  }, []);

  const reset = useCallback(() => {
    setStatus('idle');
    setLabel(null);
  }, []);

  return { status, label, capture, reset };
}
