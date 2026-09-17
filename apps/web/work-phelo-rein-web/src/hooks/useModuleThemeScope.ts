import { useEffect } from 'react';

/**
 * Mirrors a module layout's `.layout-{module}` class onto `<html data-module="...">` —
 * same mechanism theme.store.ts uses for `[data-theme]`. The class alone only scopes
 * --module-btn-bg/etc to descendants of <AppBackground>, but Modal/SidePanel (and any
 * other createPortal(..., document.body) consumer) render outside that subtree, so their
 * buttons fell back to the plain --brand color instead of the active module's color. Since
 * <html> is a real ancestor of portaled content, the data attribute reaches it too — see
 * the matching :root[data-module='...'] selectors in globals.css.
 *
 * Guards the cleanup so that switching directly between two module layouts (unmount of the
 * old, mount of the new) can't clobber whichever one wins the race — it only clears the
 * attribute if it still holds this hook's own module.
 */
export function useModuleThemeScope(module: 'hr' | 'accounting' | 'marketing' | 'operations') {
  useEffect(() => {
    document.documentElement.dataset.module = module;
    return () => {
      if (document.documentElement.dataset.module === module) {
        delete document.documentElement.dataset.module;
      }
    };
  }, [module]);
}
