import { useRouter, usePathname } from 'next/navigation';
import { useModuleTransitionStore } from '@/store/moduleTransition.store';

export function useModuleTransition() {
  const router = useRouter();
  const pathname = usePathname();
  const isActive = useModuleTransitionStore((s) => s.isActive);
  const start = useModuleTransitionStore((s) => s.start);

  const navigateToModule = (params: { moduleKey: string; moduleName: string; path: string }) => {
    if (isActive) return;
    start({ moduleKey: params.moduleKey, moduleName: params.moduleName, originPath: pathname });
    router.push(params.path);
  };

  return { navigateToModule };
}
