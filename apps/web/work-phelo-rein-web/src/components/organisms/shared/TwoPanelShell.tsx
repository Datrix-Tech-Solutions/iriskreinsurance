'use client';

import { useState } from 'react';
import { PanelLeftClose, PanelRightClose, PanelBottomClose, PanelTopClose } from 'lucide-react';
import { cardClass, cn } from '@/lib/utils';

export interface LeftPanelRenderProps {
  collapsed: boolean;
  expand: () => void;
}

interface TwoPanelShellProps {
  header?: React.ReactNode;
  /** Plain content is hidden while collapsed. Pass a function to render something else
   *  (e.g. an icon rail) in the collapsed state instead of hiding it. */
  leftPanel?: React.ReactNode | ((props: LeftPanelRenderProps) => React.ReactNode);
  rightPanel?: React.ReactNode;
  defaultCollapsed?: boolean;
}

export function TwoPanelShell({
  header,
  leftPanel,
  rightPanel,
  defaultCollapsed = false,
}: TwoPanelShellProps) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const isRailAware = typeof leftPanel === 'function';
  const leftPanelContent = isRailAware
    ? leftPanel({ collapsed, expand: () => setCollapsed(false) })
    : leftPanel;

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {header && <div className="px-6 pt-6 pb-4 shrink-0">{header}</div>}

      {/* Two-panel layout */}
      <div className="flex-1 min-h-0 flex flex-col lg:flex-row">
        {/* Side panel — floating card, retractable */}
        <div
          className={cardClass(
            cn(
              'flex flex-col shrink-0 overflow-hidden transition-all duration-500',
              'mx-6 mt-1 mb-6 lg:mx-0 lg:ml-6',
              collapsed ? 'h-14 lg:h-auto lg:w-10' : 'max-h-[45vh] lg:max-h-none lg:w-1/4',
            ),
          )}
        >
          {/* Collapse toggle */}
          <div
            className={cn(
              'flex shrink-0 pt-1',
              collapsed ? 'justify-center px-1.5' : 'justify-end px-3',
            )}
          >
            <button
              type="button"
              onClick={() => setCollapsed((v) => !v)}
              aria-label={collapsed ? 'Expand panel' : 'Collapse panel'}
              className="w-7 h-7 flex items-center justify-center rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
            >
              {collapsed ? (
                <>
                  <PanelBottomClose className="w-5 h-5 lg:hidden" />
                  <PanelRightClose className="hidden w-5 h-5 lg:block" />
                </>
              ) : (
                <>
                  <PanelTopClose className="w-5 h-5 lg:hidden" />
                  <PanelLeftClose className="hidden w-5 h-5 lg:block" />
                </>
              )}
            </button>
          </div>

          {/* Content — fades out before overflow-hidden clips it, unless it renders its own collapsed view */}
          <div
            className={cn(
              'flex-1 overflow-y-auto flex min-h-0 transition-opacity duration-150',
              isRailAware && collapsed
                ? 'flex-row lg:flex-col items-center justify-center lg:justify-start gap-2 px-2 py-2'
                : cn(
                    'flex-col px-5 pb-6 pt-4',
                    collapsed ? 'opacity-0 pointer-events-none' : 'opacity-100',
                  ),
            )}
          >
            {leftPanelContent}
          </div>
        </div>

        {/* Content panel — floating card */}
        <div
          className={cardClass(
            'flex-1 min-w-0 min-h-0 mx-6 mb-6 lg:mx-0 lg:mt-1 lg:mr-6 lg:ml-3 overflow-y-auto p-6 flex flex-col gap-4',
          )}
        >
          {rightPanel}
        </div>
      </div>
    </div>
  );
}
