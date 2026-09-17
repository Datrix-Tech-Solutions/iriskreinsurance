'use client';

import { useMsal } from '@azure/msal-react';
import { Mail, Unlink } from 'lucide-react';
import { Button } from '@/components/atoms/Button';
import { StatusBadge } from '@/components/molecules/shared/StatusBadge';
import { EmailInboxView } from '@/components/organisms/reinsurance/EmailInboxView';
import { useArchiveMailbox, useConnectMailbox, useMailboxes } from '@/hooks';
import { extractError } from '@/lib/extractError';
import { isMsalConfigured, outlookLoginRequest } from '@/lib/msal-config';
import { cardClass } from '@/lib/utils';
import { OutlookMsalProvider } from '@/providers/msal-provider';
import { useAuthStore } from '@/store/auth.store';
import { useToastStore } from '@/store/toast.store';

export default function ReinsuranceEmailPage() {
  return (
    <OutlookMsalProvider>
      <EmailMailboxContent />
    </OutlookMsalProvider>
  );
}

function EmailMailboxContent() {
  const { instance } = useMsal();
  const companyName = useAuthStore((s) => s.user?.tenantName ?? 'your company');
  const { data, isLoading } = useMailboxes({ provider: 'MICROSOFT_GRAPH' });
  const connectMailbox = useConnectMailbox();
  const archiveMailbox = useArchiveMailbox();

  const configured = isMsalConfigured();
  const activeMailbox = data?.items.find((m) => m.status !== 'DISCONNECTED');

  const handleSignIn = async () => {
    if (!configured) return;
    try {
      const result = await instance.loginPopup(outlookLoginRequest);
      await connectMailbox.mutateAsync({
        provider: 'MICROSOFT_GRAPH',
        emailAddress: result.account?.username ?? '',
        displayName: result.account?.name,
        accessToken: result.accessToken,
        tokenExpiresAt: result.expiresOn?.toISOString(),
      });
    } catch (error) {
      useToastStore.getState().addToast({ message: extractError(error), type: 'error' });
    }
  };

  const handleDisconnect = async (id: string) => {
    try {
      await archiveMailbox.mutateAsync(id);
    } catch (error) {
      useToastStore.getState().addToast({ message: extractError(error), type: 'error' });
    }
  };

  if (isLoading) {
    return <div className="flex items-center justify-center h-70% p-8 text-gray-400">Loading…</div>;
  }

  if (activeMailbox && activeMailbox.status === 'ACTIVE') {
    return (
      <EmailInboxView
        mailbox={activeMailbox}
        onDisconnect={() => handleDisconnect(activeMailbox.id)}
        disconnectLoading={archiveMailbox.isPending}
      />
    );
  }

  if (activeMailbox) {
    return (
      <div className="flex items-center justify-center h-70% p-8">
        <div className={cardClass('p-6 max-w-md w-full')}>
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <Mail size={28} className="text-brand shrink-0 mt-1" />
              <div>
                <p className="font-semibold text-gray-900">{activeMailbox.emailAddress}</p>
                <p className="text-sm text-gray-500">
                  {activeMailbox.displayName ?? 'Outlook mailbox'}
                </p>
              </div>
            </div>
            <StatusBadge status={activeMailbox.status} />
          </div>

          {activeMailbox.status === 'ERROR' && (
            <p className="text-sm text-red-600 mt-3">
              {activeMailbox.lastSyncError ?? 'This connection needs to be reconnected.'}
            </p>
          )}

          <div className="flex gap-3 mt-6">
            {activeMailbox.status === 'ERROR' && (
              <Button onClick={handleSignIn} isLoading={connectMailbox.isPending} size="sm">
                Reconnect
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              icon={<Unlink size={16} />}
              isLoading={archiveMailbox.isPending}
              loadingText="Disconnecting..."
              onClick={() => handleDisconnect(activeMailbox.id)}
            >
              Disconnect
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center h-70% p-8 text-center">
      <Mail size={48} className="text-gray-400 mb-4" />
      <h3 className="text-xl font-bold text-gray-900 mb-2">Connect your Outlook</h3>
      <p className="text-gray-500 mb-6 max-w-sm">
        Connect your Outlook account to view your recent emails directly in {companyName} workspace.
      </p>
      {configured ? (
        <Button
          onClick={handleSignIn}
          isLoading={connectMailbox.isPending}
          loadingText="Signing in..."
        >
          Sign in with Outlook
        </Button>
      ) : (
        <>
          <Button disabled>Sign in with Outlook</Button>
          <p className="text-xs text-gray-400 mt-3 max-w-xs">
            Microsoft sign-in isn&apos;t configured yet.
          </p>
        </>
      )}
    </div>
  );
}
