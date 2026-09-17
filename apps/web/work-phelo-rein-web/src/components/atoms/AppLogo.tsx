import Image from 'next/image';

export function AppLogo() {
  return (
    <div className="flex justify-center">
      <div className="relative w-50 aspect-280/90">
        <Image
          src="/HRphelo.png"
          alt="WorkPhelo Logo"
          fill
          className="object-contain"
          sizes="(max-width: 768px) 190px, 220px"
          priority
        />
      </div>
    </div>
  );
}
