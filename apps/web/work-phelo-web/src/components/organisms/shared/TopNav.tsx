'use client';

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { Bell, Home, LayoutGrid, LogOutIcon, Menu, Settings, UserIcon } from 'lucide-react';
import { cardClass, cn, frostedAvatarStyle, popupClass } from '@/lib/utils';
import { WorkPheloLogo } from '@/components/atoms/WorkPheloLogo';
import { Modal } from '@/components/organisms/shared/Modal';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { HelpCenter } from '@/components/organisms/shared/HelpCenter';
import { Button } from '@/components/atoms/Button';
import { useAuthStore } from '@/store/auth.store';
import { useLogout, useUnreadCount, useNotifications, useMarkRead, useMarkAllRead } from '@/hooks';
import { useRouter, usePathname } from 'next/navigation';
import type { Notification } from '@/types/notification';

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

export interface NavTab {
  key: string;
  label: string;
  href: string;
}

interface TopNavProps {
  showMenuButton?: boolean;
  onMenuClick?: () => void;
  tabs?: NavTab[];
  userInitials: string;
  userColor?: string;
  logoVariant?: 'text' | 'image';
}

/* ── Nav tabs — routed links rendered flush with the header's bottom edge ── */
function NavTabs({ tabs }: { tabs: NavTab[] }) {
  const pathname = usePathname();

  return (
    <div className="self-stretch flex items-end gap-1">
      {tabs.map((tab) => {
        const isActive = pathname === tab.href || pathname.startsWith(tab.href + '/');
        return (
          <Link
            key={tab.key}
            href={tab.href}
            className={cn(
              'relative px-3 py-2.5 text-sm font-medium transition-colors whitespace-nowrap',
              isActive
                ? 'text-black font-semibold after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-black after:rounded-t-full'
                : 'text-black/70 hover:text-black',
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}

function formatRoleLabel(role: string): string {
  return role
    .toLowerCase()
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/* ── Profile dropdown ── */
function ProfileDropdown({
  userInitials,
  userColor,
  userName,
  userRole,
  onProfileClick,
  onSettingsClick,
  onLogoutClick,
  isSuperAdmin,
}: {
  userInitials: string;
  userColor?: string;
  userName?: string;
  userRole?: string;
  onProfileClick: () => void;
  onSettingsClick: () => void;
  onLogoutClick: () => void;
  isSuperAdmin?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, right: 0 });
  const anchorRef = useRef<HTMLDivElement>(null);
  const avatarColor = userColor ?? 'var(--module-btn-bg, var(--color-brand))';

  useEffect(() => {
    if (!open) return;
    const updatePos = () => {
      if (!anchorRef.current) return;
      const rect = anchorRef.current.getBoundingClientRect();
      setPos({ top: rect.bottom + 8, right: window.innerWidth - rect.right });
    };
    updatePos();
    window.addEventListener('scroll', updatePos, true);
    window.addEventListener('resize', updatePos);
    return () => {
      window.removeEventListener('scroll', updatePos, true);
      window.removeEventListener('resize', updatePos);
    };
  }, [open]);

  const items = [
    ...(!isSuperAdmin
      ? [
          {
            label: 'Profile',
            icon: <UserIcon className="w-5 h-5" />,
            danger: false,
            onClick: () => {
              setOpen(false);
              onProfileClick();
            },
          },
        ]
      : []),
    {
      label: 'Settings',
      icon: <Settings className="w-5 h-5" />,
      danger: false,
      onClick: () => {
        setOpen(false);
        onSettingsClick();
      },
    },
    {
      label: 'Logout',
      icon: <LogOutIcon className="w-5 h-5" />,
      danger: true,
      onClick: () => {
        setOpen(false);
        onLogoutClick();
      },
    },
  ];

  return (
    <div className="relative" ref={anchorRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={frostedAvatarStyle(avatarColor)}
        className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold backdrop-blur-sm border border-white/30 transition-opacity hover:opacity-80"
      >
        {userInitials}
      </button>

      {open &&
        typeof document !== 'undefined' &&
        createPortal(
          <>
            <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
            <div
              style={{ position: 'fixed', top: pos.top, right: pos.right, minWidth: 200 }}
              className={popupClass('z-20 overflow-hidden')}
            >
              {userName && (
                <>
                  <div className="flex items-center gap-2.5 px-4 py-3">
                    <span
                      style={frostedAvatarStyle(avatarColor)}
                      className="w-7 h-7 shrink-0 rounded-full flex items-center justify-center text-white text-[10px] font-bold backdrop-blur-sm border border-white/30"
                    >
                      {userInitials}
                    </span>
                    <div className="flex flex-col min-w-0">
                      <span className="text-sm font-semibold text-gray-900 truncate">
                        {userName}
                      </span>
                      {userRole && (
                        <span className="text-xs text-gray-500 truncate">{userRole}</span>
                      )}
                    </div>
                  </div>
                  <div className="h-px bg-gray-100" />
                </>
              )}
              <div className="py-1.5">
                {items.map((item) => (
                  <button
                    key={item.label}
                    onClick={item.onClick}
                    className={cn(
                      'w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors',
                      item.danger
                        ? 'text-red-500 hover:bg-red-50'
                        : 'text-gray-700 hover:bg-(--surface-hover-subtle,var(--color-gray-50))',
                    )}
                  >
                    {item.icon}
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          </>,
          document.body,
        )}
    </div>
  );
}

/* ── Notification list ── */
function NotificationRow({
  notification,
  slug,
  onNavigate,
  onMarkRead,
}: {
  notification: Notification;
  slug: string;
  onNavigate: () => void;
  onMarkRead: (id: string) => void;
}) {
  const content = (
    <div
      className={cardClass(
        'flex items-start gap-3 px-3 py-3 cursor-pointer transition-[transform,box-shadow,background-color] duration-200 hover:-translate-y-1 hover:shadow-[0_16px_28px_-16px_rgba(0,0,0,0.4),0_4px_10px_-2px_rgba(0,0,0,0.2),inset_0_1px_0_0_var(--glass-highlight,rgba(255,255,255,0.65))] hover:bg-orange-50/60',
      )}
      onClick={() => {
        onMarkRead(notification.id);
        onNavigate();
      }}
    >
      <span className="mt-1.5 w-2 h-2 rounded-full bg-orange-500 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">{notification.title}</p>
        <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{notification.message}</p>
        <p className="text-[11px] text-gray-400 mt-1">{timeAgo(notification.createdAt)}</p>
      </div>
    </div>
  );

  if (!notification.link) return content;

  return (
    <Link href={`/${slug}${notification.link}`} className="block">
      {content}
    </Link>
  );
}

function NotificationsPanelContent({ slug, onNavigate }: { slug: string; onNavigate: () => void }) {
  const { data: notifications, isLoading } = useNotifications();
  const { mutate: markRead } = useMarkRead();

  // Read notifications drop off the list immediately — only unread ones stay visible.
  const unread = (notifications ?? []).filter((n) => !n.isRead);

  if (isLoading) {
    return <p className="text-sm text-gray-400 text-center py-16">Loading…</p>;
  }

  if (unread.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
        <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center text-gray-400">
          <Bell className="w-6 h-6" />
        </div>
        <p className="text-sm font-medium text-gray-500">No notifications yet</p>
        <p className="text-xs text-gray-400">You&apos;re all caught up! Check back later.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {unread.map((notification) => (
        <NotificationRow
          key={notification.id}
          notification={notification}
          slug={slug}
          onNavigate={onNavigate}
          onMarkRead={markRead}
        />
      ))}
    </div>
  );
}

/* ── TopNav ── */
export function TopNav({
  showMenuButton = false,
  onMenuClick,
  tabs,
  userInitials,
  userColor,
  logoVariant = 'text',
}: TopNavProps) {
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const { user } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();
  const slug = user?.tenantSlug || pathname.split('/')[1];

  const { data: unreadData } = useUnreadCount();
  const notificationCount = unreadData?.count ?? 0;
  const { mutate: markAllRead, isPending: isMarkingAllRead } = useMarkAllRead();

  const { mutate: performLogout, isPending: isLoggingOut } = useLogout();

  const handleLogout = () => {
    const redirectTo =
      user?.role === 'SUPER_ADMIN' ? '/platform/login' : `/${user?.tenantSlug}/login`;
    performLogout(undefined, { onSuccess: () => router.push(redirectTo) });
  };

  // Modules that have their own layout (sidebar) and dedicated profile/settings pages.
  // Add a module here when its layout.tsx and profile/settings pages exist.
  const LAYOUT_MODULES = new Set(['hr', 'operations']);

  const currentModule = (() => {
    const segment = pathname.split('/')[2];
    return LAYOUT_MODULES.has(segment) ? segment : null;
  })();

  const handleProfileClick = () => {
    const slug = user?.tenantSlug || pathname.split('/')[1];
    router.push(currentModule ? `/${slug}/${currentModule}/profile` : `/${slug}/profile`);
  };

  const handleSettingsClick = () => {
    const slug = user?.tenantSlug || pathname.split('/')[1];
    router.push(currentModule ? `/${slug}/${currentModule}/settings` : `/${slug}/settings`);
  };

  const displayName = user
    ? `${user.firstName.charAt(0).toUpperCase()}. ${user.lastName ?? ''}`.trim()
    : undefined;
  const displayRole = user ? formatRoleLabel(user.role) : undefined;

  return (
    <>
      <header
        className={cn(
          'relative w-full border-b border-white/10 shadow-md px-5 h-14 flex items-center gap-4 shrink-0',
        )}
      >
        {/* Menu button */}
        {showMenuButton && (
          <button
            onClick={onMenuClick}
            className="text-(--topnav-icon-text,var(--module-btn-bg,var(--color-brand))) hover:text-(--topnav-icon-hover,var(--module-btn-bg-hover,var(--color-brand-hover))) transition-colors"
            aria-label="Toggle menu"
          >
            <Menu />
          </button>
        )}

        {/* Logo */}
        <WorkPheloLogo className="p-2 text-base shrink" variant={logoVariant} />

        {/* Tabs — centered relative to the full header width */}
        {tabs && tabs.length > 1 && (
          <div className="absolute left-1/2 -translate-x-1/2 top-0 h-full flex items-end">
            <NavTabs tabs={tabs} />
          </div>
        )}

        <div className="flex-1" />

        {/* Right icons */}
        <div className="flex items-center gap-3">
          {/* Bell */}
          <button
            onClick={() => setNotificationsOpen(true)}
            className="relative text-(--topnav-icon-text,var(--module-btn-bg,var(--color-brand))) hover:text-(--topnav-icon-hover,var(--module-btn-bg-hover,var(--color-brand-hover))) transition-colors"
            aria-label="Notifications"
          >
            <Bell className="w-5 h-5" />
            {notificationCount != null && notificationCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 min-w-4 h-4 px-0.5 bg-orange-400 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                {notificationCount > 99 ? '99+' : notificationCount}
              </span>
            )}
          </button>

          {/* Help */}
          {user?.role !== 'SUPER_ADMIN' && <HelpCenter />}

          {/* Apps grid — back to module launcher */}
          <button
            className="text-(--topnav-icon-text,var(--module-btn-bg,var(--color-brand))) hover:text-(--topnav-icon-hover,var(--module-btn-bg-hover,var(--color-brand-hover))) transition-colors"
            aria-label="Apps"
            onClick={() => {
              if (user?.role === 'SUPER_ADMIN') {
                router.push('/dashboard');
              } else {
                const slug = user?.tenantSlug || pathname.split('/')[1];
                router.push(`/${slug}/modules`);
              }
            }}
          >
            {user?.role === 'SUPER_ADMIN' ? (
              <Home className="w-5 h-5" />
            ) : (
              <LayoutGrid className="w-5 h-5" />
            )}
          </button>

          {/* Profile avatar */}
          <ProfileDropdown
            userInitials={userInitials}
            userColor={userColor}
            userName={displayName}
            userRole={displayRole}
            onProfileClick={handleProfileClick}
            onSettingsClick={handleSettingsClick}
            onLogoutClick={() => setLogoutOpen(true)}
            isSuperAdmin={user?.role === 'SUPER_ADMIN'}
          />
        </div>
      </header>

      {/* Notifications panel */}
      <SidePanel
        isOpen={notificationsOpen}
        onClose={() => setNotificationsOpen(false)}
        title="Notifications"
        description="Stay up to date with what's happening."
        descriptionAction={
          notificationCount > 0 && (
            <button
              onClick={() => markAllRead()}
              disabled={isMarkingAllRead}
              className="text-xs font-medium text-orange-600 hover:text-orange-700 disabled:opacity-50 whitespace-nowrap"
            >
              Mark all as read
            </button>
          )
        }
        glass
      >
        {notificationsOpen && (
          <NotificationsPanelContent slug={slug} onNavigate={() => setNotificationsOpen(false)} />
        )}
      </SidePanel>

      {/* Logout confirmation modal */}
      <Modal
        isOpen={logoutOpen}
        onClose={() => setLogoutOpen(false)}
        title="Logout"
        description="Are you sure you want to logout?"
        footer={
          <>
            <Button variant="secondary" onClick={() => setLogoutOpen(false)}>
              Stay
            </Button>
            <Button
              variant="danger"
              onClick={handleLogout}
              isLoading={isLoggingOut}
              loadingText="Logging out..."
            >
              Logout
            </Button>
          </>
        }
      />
    </>
  );
}
