'use client';

import { useState } from 'react';
import Image from 'next/image';

const slides = [
  {
    heading: 'EMPOWER YOUR ORGANIZATION.',
    subtext:
      'WorkPhelo HR helps organizations manage employees, streamline HR processes, and build productive teams — all from one unified platform.',
  },
  {
    heading: 'Complete business Visibility',
    subtext:
      'Everything your business needs in one place for better decision-making and improved efficiency.',
  },
  {
    heading: 'STREAMLINE YOUR HR PROCESSES.',
    subtext:
      'From onboarding to payroll, WorkPhelo gives your team the tools they need to work smarter and move faster.',
  },
  {
    heading: 'BUILD PRODUCTIVE TEAMS.',
    subtext: 'Track performance, manage roles, and keep your people engaged — all in one place.',
  },
];

export function LoginHero() {
  const [active] = useState(1);

  return (
    <div className="relative w-full h-full overflow-hidden">
      {/* Background image*/}
      <Image
        src="/login_page_image.jpg"
        alt="WorkPhelo hero"
        fill
        sizes="58vw"
        className="object-cover object-center"
        priority
      />

      <div className="absolute inset-0 bg-linear-to-t from-black/80 via-black/20 to-transparent" />

      <div className="absolute bottom-0 left-0 right-0 z-10 p-10 pb-8">
        <h2 className="text-3xl font-extrabold text-white uppercase leading-tight mb-3">
          {slides[active].heading}
        </h2>
        <p className="text-sm text-white/80 leading-relaxed max-w-sm">{slides[active].subtext}</p>
      </div>
    </div>
  );
}
