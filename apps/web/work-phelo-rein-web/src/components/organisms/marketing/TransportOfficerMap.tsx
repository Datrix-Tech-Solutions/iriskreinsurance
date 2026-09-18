'use client';

import { useEffect, useRef, useState } from 'react';
import Map, { Marker, Popup, NavigationControl, MapRef } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Icons } from '@/components/atoms/icons';
import { MAPTILER_STYLE_URL, hasMapTilerKey } from '@/lib/maptiler';

export interface OfficerLocation {
  id: string;
  name: string;
  lat: number;
  lng: number;
  status: 'active' | 'idle' | 'offline';
}

const STATUS_COLOR: Record<OfficerLocation['status'], string> = {
  active: 'bg-emerald-500',
  idle: 'bg-amber-500',
  offline: 'bg-gray-400',
};

const DEFAULT_VIEW = { latitude: 5.6037, longitude: -0.187, zoom: 11 };

interface Props {
  officers: OfficerLocation[];
  selectedOfficerId?: string;
}

export function TransportOfficerMap({ officers, selectedOfficerId }: Props) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const mapRef = useRef<MapRef>(null);
  const active = officers.find((o) => o.id === (activeId ?? selectedOfficerId));

  useEffect(() => {
    if (!selectedOfficerId) return;
    const officer = officers.find((o) => o.id === selectedOfficerId);
    if (!officer) return;
    mapRef.current?.flyTo({ center: [officer.lng, officer.lat], zoom: 15, duration: 800 });
  }, [selectedOfficerId, officers]);

  if (!hasMapTilerKey()) {
    return (
      <div className="w-full h-full flex items-center justify-center text-center px-6">
        <p className="text-sm text-gray-500">Map not available.</p>
      </div>
    );
  }

  return (
    <Map
      ref={mapRef}
      initialViewState={DEFAULT_VIEW}
      style={{ width: '100%', height: '100%' }}
      mapStyle={MAPTILER_STYLE_URL}
    >
      <NavigationControl position="bottom-right" />

      {officers.map((officer) => (
        <Marker
          key={officer.id}
          latitude={officer.lat}
          longitude={officer.lng}
          anchor="bottom"
          onClick={(e) => {
            e.originalEvent.stopPropagation();
            setActiveId(officer.id);
          }}
        >
          <button
            type="button"
            className="flex flex-col items-center gap-0.5 cursor-pointer"
            aria-label={officer.name}
          >
            <span
              className={`flex items-center justify-center w-8 h-8 rounded-full ${STATUS_COLOR[officer.status]} text-white shadow-md ring-2 ring-white`}
            >
              <Icons.MapPin className="w-4 h-4" />
            </span>
          </button>
        </Marker>
      ))}

      {active && (
        <Popup
          latitude={active.lat}
          longitude={active.lng}
          anchor="top"
          closeOnClick={false}
          onClose={() => setActiveId(null)}
        >
          <div className="text-sm">
            <p className="font-medium text-gray-900">{active.name}</p>
            <p className="text-gray-500 capitalize">{active.status}</p>
          </div>
        </Popup>
      )}
    </Map>
  );
}
