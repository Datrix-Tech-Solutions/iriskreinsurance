import { LoginHero } from '@/components/organisms/login/LoginHero';

export function AuthPageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[#1f1f1f]">
      {/* Full-screen background image */}
      <div className="absolute inset-0">
        <LoginHero />
      </div>

      {/* Form sits on top of the image */}
      <div className="relative z-10 flex h-full items-center justify-center overflow-y-auto p-6 lg:justify-start lg:pl-[8%]">
        {children}
      </div>
    </div>
  );
}
