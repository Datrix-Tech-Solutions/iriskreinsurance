const MAPTILER_KEY = process.env.NEXT_PUBLIC_MAPTILER_KEY ?? '';

export function hasMapTilerKey(): boolean {
  return Boolean(MAPTILER_KEY);
}

export const MAPTILER_STYLE_URL = `https://api.maptiler.com/maps/streets-v2/style.json?key=${MAPTILER_KEY}`;

export interface GeocodeResult {
  id: string;
  placeName: string;
  lat: number;
  lng: number;
}

interface MapTilerFeature {
  id: string;
  place_name: string;
  center: [number, number];
}

export async function geocodeForward(query: string): Promise<GeocodeResult[]> {
  if (!MAPTILER_KEY || !query.trim()) return [];

  const res = await fetch(
    `https://api.maptiler.com/geocoding/${encodeURIComponent(query)}.json?key=${MAPTILER_KEY}&limit=6&proximity=-0.187,5.6037`,
  );
  if (!res.ok) return [];

  const data: { features?: MapTilerFeature[] } = await res.json();
  return (data.features ?? []).map((f) => ({
    id: f.id,
    placeName: f.place_name,
    lng: f.center[0],
    lat: f.center[1],
  }));
}

export async function geocodeReverse(lng: number, lat: number): Promise<string | null> {
  if (!MAPTILER_KEY) return null;

  const res = await fetch(
    `https://api.maptiler.com/geocoding/${lng},${lat}.json?key=${MAPTILER_KEY}`,
  );
  if (!res.ok) return null;

  const data: { features?: MapTilerFeature[] } = await res.json();
  return data.features?.[0]?.place_name ?? null;
}
