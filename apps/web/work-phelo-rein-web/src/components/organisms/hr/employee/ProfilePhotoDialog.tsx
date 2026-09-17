'use client';

import { useState } from 'react';
import { Modal } from '@/components/organisms/shared/Modal';
import { Button } from '@/components/atoms/Button';
import { AvatarUploader } from '@/components/molecules/hr/employees/AvatarUploader';

interface ProfilePhotoDialogProps {
  isOpen: boolean;
  onClose: () => void;
  name: string;
  currentUrl?: string | null;
  /** `file` = new photo to upload, `null` = remove the current photo. */
  onSave: (file: File | null) => void;
  isSaving?: boolean;
  /** Show the "Remove photo" action (there is no remove endpoint yet). */
  canRemove?: boolean;
}

export function ProfilePhotoDialog({
  isOpen,
  onClose,
  name,
  currentUrl,
  onSave,
  isSaving = false,
  canRemove = false,
}: ProfilePhotoDialogProps) {
  // This dialog is mounted only while open (see caller), so state starts fresh
  // each time without a reset effect.
  const [file, setFile] = useState<File | null>(null);
  const [remove, setRemove] = useState(false);

  const dirty = file !== null || remove;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Profile photo"
      description="Upload a picture so teammates can recognise you."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button
            onClick={() => onSave(remove ? null : file)}
            disabled={!dirty}
            isLoading={isSaving}
            loadingText="Saving…"
          >
            Save photo
          </Button>
        </>
      }
    >
      <AvatarUploader
        name={name}
        currentUrl={currentUrl}
        file={file}
        onFileChange={(f) => {
          setFile(f);
          if (f) setRemove(false);
        }}
        markedForRemoval={remove}
        onRemove={
          canRemove
            ? () => {
                setFile(null);
                setRemove(true);
              }
            : undefined
        }
        disabled={isSaving}
      />
    </Modal>
  );
}
