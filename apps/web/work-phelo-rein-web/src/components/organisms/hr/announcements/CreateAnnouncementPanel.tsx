'use client';

import { useEffect, useState } from 'react';
import { useForm, useWatch, Controller } from 'react-hook-form';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { Modal } from '@/components/organisms/shared/Modal';
import { Button } from '@/components/atoms/Button';
import { FormField } from '@/components/molecules/shared/FormField';
import { DatePicker } from '@/components/atoms/DatePicker';
import { SearchSelect } from '@/components/atoms/SearchSelect';
import { MultiSelect } from '@/components/atoms/MultiSelect';
import { useCreateAnnouncement } from '@/hooks';
import { useDepartmentOptions } from '@/hooks/hr/useDepartments';
import { useBranchOptions } from '@/hooks/hr/useBranches';
import { useEmployeeOptions } from '@/hooks/hr/useEmployees';
import { useToast } from '@/hooks/useToast';
import { extractError } from '@/lib/extractError';
import { useAuthStore } from '@/store/auth.store';
import type {
  Announcement,
  AnnouncementAudienceType,
  AnnouncementDeliveryChannel,
} from '@/types/hr';

interface AnnouncementForm {
  title: string;
  body: string;
  expiresAt?: string;
  sendEmail: boolean;
  sendSMS: boolean;
  audienceType: AnnouncementAudienceType;
  departmentIds: string[];
  branchIds: string[];
  employeeIds: string[];
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  announcement?: Announcement | null;
}

const AUDIENCE_OPTIONS = [
  { value: 'ALL', label: 'Everyone', sublabel: 'All employees in the organisation' },
  { value: 'DEPARTMENTS', label: 'Departments', sublabel: 'Employees in specific departments' },
  { value: 'BRANCHES', label: 'Branches', sublabel: 'Employees in specific branches' },
  { value: 'EMPLOYEES', label: 'Specific Employees', sublabel: 'Named individuals only' },
];

const AUDIENCE_SUMMARY: Record<AnnouncementAudienceType, string> = {
  ALL: 'all employees in your organisation',
  DEPARTMENTS: 'employees in the selected departments',
  BRANCHES: 'employees in the selected branches',
  EMPLOYEES: 'the selected employees',
};

const SMS_DELIVERY_ENABLED = process.env.NEXT_PUBLIC_ENABLE_ANNOUNCEMENT_SMS === 'true';

function buildDeliveryChannels(
  sendEmail: boolean,
  sendSMS: boolean,
): AnnouncementDeliveryChannel[] {
  return [
    'IN_APP',
    ...(sendEmail ? (['EMAIL'] as const) : []),
    ...(sendSMS && SMS_DELIVERY_ENABLED ? (['SMS'] as const) : []),
  ];
}

export function CreateAnnouncementPanel({ isOpen, onClose, announcement }: Props) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const toast = useToast();
  const user = useAuthStore((s) => s.user);
  const smsFeatureEnabled = user?.featureConfig?.hr?.smsAnnouncement ?? false;
  const { mutate: createAnnouncement, isPending: isCreating } = useCreateAnnouncement();
  const isPending = isCreating;

  const { data: departmentOptions = [] } = useDepartmentOptions();
  const { data: branchOptions = [] } = useBranchOptions();
  const { data: employeeOptions = [] } = useEmployeeOptions();

  const {
    register,
    handleSubmit,
    setValue,
    control,
    getValues,
    reset,
    formState: { errors },
  } = useForm<AnnouncementForm>({
    defaultValues: {
      sendEmail: false,
      sendSMS: false,
      audienceType: 'ALL',
      departmentIds: [],
      branchIds: [],
      employeeIds: [],
    },
  });

  useEffect(() => {
    if (isOpen) {
      const channels = announcement?.deliveryChannels ?? ['IN_APP'];
      reset({
        title: announcement?.title ?? '',
        body: announcement?.body ?? '',
        expiresAt: announcement?.expiresAt ?? undefined,
        sendEmail: channels.includes('EMAIL') || announcement?.sendEmail === true,
        sendSMS: SMS_DELIVERY_ENABLED && smsFeatureEnabled && channels.includes('SMS'),
        audienceType: announcement?.audienceType ?? 'ALL',
        departmentIds: announcement?.targetDepartmentIds ?? [],
        branchIds: announcement?.targetBranchIds ?? [],
        employeeIds: announcement?.targetEmployeeIds ?? [],
      });
    }
  }, [isOpen, announcement, reset, smsFeatureEnabled]);

  const expiresAtValue = useWatch({ control, name: 'expiresAt' });
  const sendEmail = useWatch({ control, name: 'sendEmail' });
  const sendSMS = useWatch({ control, name: 'sendSMS' });
  const audienceType = useWatch({ control, name: 'audienceType' });

  const handleClose = () => {
    reset();
    setConfirmOpen(false);
    onClose();
  };

  const onSendClick = handleSubmit(() => setConfirmOpen(true));

  const onConfirmSend = () => {
    const formValues = getValues();
    const payload = {
      title: formValues.title,
      body: formValues.body,
      deliveryChannels: buildDeliveryChannels(formValues.sendEmail, formValues.sendSMS),
      audienceType: formValues.audienceType,
      ...(formValues.expiresAt ? { expiresAt: formValues.expiresAt } : {}),
      ...(formValues.audienceType === 'DEPARTMENTS'
        ? { departmentIds: formValues.departmentIds }
        : {}),
      ...(formValues.audienceType === 'BRANCHES' ? { branchIds: formValues.branchIds } : {}),
      ...(formValues.audienceType === 'EMPLOYEES' ? { employeeIds: formValues.employeeIds } : {}),
    };

    createAnnouncement(payload, {
      onSuccess: () => {
        toast.success('Announcement created');
        handleClose();
      },
      onError: (err: unknown) => toast.error(extractError(err, 'Failed to create announcement')),
    });
  };

  return (
    <>
      <SidePanel
        isOpen={isOpen}
        onClose={handleClose}
        title="New Announcement"
        description="Compose and send an announcement to your organisation."
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button isLoading={isPending} loadingText="Sending…" onClick={onSendClick}>
              Send Message
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-5">
          <FormField
            label="Title"
            registration={register('title', { required: 'Required' })}
            error={errors.title}
            placeholder="eg; Q1 All-Hands Meeting"
          />
          <FormField
            label="Message"
            registration={register('body', { required: 'Required' })}
            error={errors.body}
            type="textarea"
            rows={6}
            placeholder="Write your announcement here…"
          />

          {/* Audience targeting */}
          <Controller
            control={control}
            name="audienceType"
            render={({ field }) => (
              <SearchSelect
                label="Audience"
                options={AUDIENCE_OPTIONS}
                value={field.value}
                onChange={(v) => field.onChange(v as AnnouncementAudienceType)}
              />
            )}
          />

          {audienceType === 'DEPARTMENTS' && (
            <Controller
              control={control}
              name="departmentIds"
              rules={{ validate: (v) => v.length > 0 || 'Select at least one department' }}
              render={({ field }) => (
                <MultiSelect
                  label="Departments"
                  placeholder="Select departments…"
                  options={departmentOptions.map((d) => ({ value: d.id, label: d.name }))}
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.departmentIds?.message}
                />
              )}
            />
          )}

          {audienceType === 'BRANCHES' && (
            <Controller
              control={control}
              name="branchIds"
              rules={{ validate: (v) => v.length > 0 || 'Select at least one branch' }}
              render={({ field }) => (
                <MultiSelect
                  label="Branches"
                  placeholder="Select branches…"
                  options={branchOptions.map((b) => ({ value: b.id, label: b.name }))}
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.branchIds?.message}
                />
              )}
            />
          )}

          {audienceType === 'EMPLOYEES' && (
            <Controller
              control={control}
              name="employeeIds"
              rules={{ validate: (v) => v.length > 0 || 'Select at least one employee' }}
              render={({ field }) => (
                <MultiSelect
                  label="Employees"
                  placeholder="Select employees…"
                  options={employeeOptions.map((e) => ({
                    value: e.id,
                    label: `${e.firstName} ${e.lastName}`,
                  }))}
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.employeeIds?.message}
                />
              )}
            />
          )}

          <DatePicker
            label="Expiry Date (optional)"
            value={expiresAtValue}
            onChange={(v) => setValue('expiresAt', v)}
            disablePast
          />

          <label className="flex items-start gap-3 cursor-pointer group">
            <div className="relative mt-0.5 shrink-0">
              <input type="checkbox" className="sr-only peer" {...register('sendEmail')} />
              <div className="w-5 h-5 rounded border-2 border-gray-300 bg-white peer-checked:bg-brand peer-checked:border-brand transition-colors group-hover:border-gray-400 flex items-center justify-center">
                {sendEmail && (
                  <svg
                    className="w-3 h-3 text-white"
                    fill="none"
                    viewBox="0 0 12 12"
                    stroke="currentColor"
                    strokeWidth={2.5}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2 6l3 3 5-5" />
                  </svg>
                )}
              </div>
            </div>
            <div>
              <p className="text-sm font-bold text-gray-900">Notify via email</p>
              <p className="text-xs text-gray-500 mt-0.5">
                Send this announcement to employees&apos; work email addresses.
              </p>
            </div>
          </label>

          <label
            className={`flex items-start gap-3 group ${smsFeatureEnabled ? 'cursor-pointer' : 'cursor-not-allowed opacity-50 pointer-events-none'}`}
          >
            <div className="relative mt-0.5 shrink-0">
              <input
                type="checkbox"
                className="sr-only peer"
                disabled={!SMS_DELIVERY_ENABLED || !smsFeatureEnabled}
                {...register('sendSMS')}
              />
              <div className="w-5 h-5 rounded border-2 border-gray-300 bg-white peer-checked:bg-brand peer-checked:border-brand transition-colors group-hover:border-gray-400 flex items-center justify-center">
                {sendSMS && (
                  <svg
                    className="w-3 h-3 text-white"
                    fill="none"
                    viewBox="0 0 12 12"
                    stroke="currentColor"
                    strokeWidth={2.5}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2 6l3 3 5-5" />
                  </svg>
                )}
              </div>
            </div>
            <div>
              <p className="text-sm font-bold text-gray-900">Notify via SMS</p>
              <p className="text-xs text-gray-500 mt-0.5">
                {!smsFeatureEnabled
                  ? 'SMS announcements are not enabled for this organisation.'
                  : SMS_DELIVERY_ENABLED
                    ? "Send this announcement to employees' phone numbers."
                    : 'SMS delivery will be enabled after provider configuration.'}
              </p>
            </div>
          </label>
        </div>
      </SidePanel>

      <Modal
        isOpen={confirmOpen}
        onClose={() => !isPending && setConfirmOpen(false)}
        title="Send Announcement?"
        description={`This announcement will be sent to ${AUDIENCE_SUMMARY[audienceType]}. Are you sure you want to proceed?`}
        footer={
          <>
            <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={isPending}>
              Cancel
            </Button>
            <Button isLoading={isPending} loadingText="Sending…" onClick={onConfirmSend}>
              Send
            </Button>
          </>
        }
      />
    </>
  );
}
