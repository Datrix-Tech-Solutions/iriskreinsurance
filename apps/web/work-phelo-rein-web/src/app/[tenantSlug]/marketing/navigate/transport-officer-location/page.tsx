'use client';

import { useMemo, useState } from 'react';
import { SearchSelect } from '@/components/atoms/SearchSelect';
import {
  TransportOfficerMap,
  OfficerLocation,
} from '@/components/organisms/marketing/TransportOfficerMap';
import { pageContent } from '@/lib/layout';
import { cn } from '@/lib/utils';

const OFFICERS: OfficerLocation[] = [
  { id: '1', name: 'Kwame Asante', lat: 5.6037, lng: -0.87, status: 'active' },
  { id: '2', name: 'Ama Boateng', lat: 5.5913, lng: -0.2077, status: 'idle' },
  { id: '3', name: 'Kofi Mensah', lat: 5.6145, lng: -0.1699, status: 'offline' },
];

export default function TransportOfficerLocationPage() {
  const [officer, setOfficer] = useState('');

  const options = useMemo(
    () => OFFICERS.map((o) => ({ value: o.id, label: o.name, sublabel: o.status })),
    [],
  );

  return (
    <div className={cn(pageContent, 'flex-1 min-h-0 flex flex-col')}>
      <div className="flex-1 min-h-0 relative rounded-2xl overflow-hidden bg-white">
        {/* SearchSelect pinned to top-right of the map area */}
        <div className="absolute top-4 right-4 z-10 w-72">
          <SearchSelect
            size="sm"
            placeholder="Search transport officer..."
            options={options}
            value={officer}
            onChange={setOfficer}
          />
        </div>

        <TransportOfficerMap officers={OFFICERS} selectedOfficerId={officer || undefined} />
      </div>
    </div>
  );
}
