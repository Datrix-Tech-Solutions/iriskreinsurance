import { LoginHero } from '@/components/organisms/login/LoginHero';
import { AppBackground } from '@/components/atoms/AppBackground';

export function AuthPageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-screen w-screen flex overflow-hidden bg-[#1f1f1f]">
      {/* Left — Form Area */}
      <AppBackground className="w-full lg:w-[42%] flex items-center justify-center overflow-y-auto p-6">
        {children}
      </AppBackground>

      {/* Right — Image area */}
      <div className="hidden lg:flex w-[58%]">
        <LoginHero />
      </div>
    </div>
  );
}
