'use client';

import { useEffect, useRef } from 'react';
import Map, { Marker, NavigationControl, MapRef } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Icons } from '@/components/atoms/icons';
import { MAPTILER_STYLE_URL, hasMapTilerKey } from '@/lib/maptiler';

const DEFAULT_VIEW = { latitude: 5.6037, longitude: -0.187, zoom: 11 };

interface Props {
  lat?: number;
  lng?: number;
  onChange: (lat: number, lng: number) => void;
}

export function CompanyLocationMap({ lat, lng, onChange }: Props) {
  const mapRef = useRef<MapRef>(null);

  useEffect(() => {
    if (lat != null && lng != null) {
      mapRef.current?.flyTo({ center: [lng, lat], zoom: 15, duration: 800 });
    }
  }, [lat, lng]);

  if (!hasMapTilerKey()) {
    return (
      <div className="h-150 rounded-xl bg-gray-100 border border-gray-200 flex items-center justify-center">
        <p className="text-sm text-gray-400">Map not available.</p>
      </div>
    );
  }

  return (
    <div className="h-150 rounded-xl overflow-hidden border border-gray-200">
      <Map
        ref={mapRef}
        initialViewState={DEFAULT_VIEW}
        style={{ width: '100%', height: '100%' }}
        mapStyle={MAPTILER_STYLE_URL}
        onClick={(e) => onChange(e.lngLat.lat, e.lngLat.lng)}
      >
        <NavigationControl position="bottom-right" />

        {lat != null && lng != null && (
          <Marker
            latitude={lat}
            longitude={lng}
            anchor="bottom"
            draggable
            onDragEnd={(e) => onChange(e.lngLat.lat, e.lngLat.lng)}
          >
            <span className="flex items-center justify-center w-8 h-8 rounded-full bg-(--module-btn-bg,var(--color-brand)) text-white shadow-md ring-2 ring-white cursor-grab active:cursor-grabbing">
              <Icons.MapPin className="w-4 h-4" />
            </span>
          </Marker>
        )}
      </Map>
    </div>
  );
}
