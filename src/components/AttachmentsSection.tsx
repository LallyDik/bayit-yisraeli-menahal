import React, { useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Paperclip, FileText, Trash2 } from 'lucide-react';
import { useAttachments } from '@/hooks/useAttachments';
import { getAttachmentUrl } from '@/api/attachments';
import type { Attachment } from '@/types';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

const MAX_SIZE_BYTES = 10 * 1024 * 1024; // mirrors the bucket's file_size_limit

// Signed URLs expire (1h); cache them well under that so a rendered link is
// never a stale one, without re-signing on every mount.
const useAttachmentUrl = (att: Attachment) =>
  useQuery({
    queryKey: ['attachment-url', att.id],
    queryFn: () => getAttachmentUrl(att),
    staleTime: 30 * 60 * 1000,
  });

const isImage = (att: Attachment) => att.content_type?.startsWith('image/') ?? false;

const ImageThumb: React.FC<{ att: Attachment; onDelete: () => void }> = ({ att, onDelete }) => {
  const { data: url } = useAttachmentUrl(att);
  return (
    <div className="relative">
      {url ? (
        <button
          type="button"
          className="block w-full rounded-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          onClick={() => window.open(url, '_blank')}
          aria-label={`פתיחת ${att.file_name}`}
        >
          <img src={url} alt="" className="h-24 w-full rounded-md object-cover" />
        </button>
      ) : (
        <div className="rounded-md h-24 w-full bg-muted animate-pulse" />
      )}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="absolute top-1 end-1 h-7 w-7 p-0 bg-background/80 hover:bg-background"
        aria-label={`מחק ${att.file_name}`}
        onClick={onDelete}
      >
        <Trash2 className="text-destructive" />
      </Button>
    </div>
  );
};

const FileRow: React.FC<{ att: Attachment; onDelete: () => void }> = ({ att, onDelete }) => {
  const { data: url } = useAttachmentUrl(att);
  return (
    <div className="flex items-center gap-2 rounded-md border p-2">
      <button
        type="button"
        className="flex flex-1 items-center gap-2 min-w-0 text-right cursor-pointer disabled:cursor-default"
        disabled={!url}
        onClick={() => url && window.open(url, '_blank')}
      >
        <FileText className="w-4 h-4 shrink-0 text-muted-foreground" />
        <span className="truncate text-sm">{att.file_name}</span>
      </button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        aria-label={`מחק ${att.file_name}`}
        onClick={onDelete}
      >
        <Trash2 className="text-destructive" />
      </Button>
    </div>
  );
};

interface AttachmentsSectionProps {
  unitId?: string;
  tenantId?: string; // exactly one of the two
}

export const AttachmentsSection: React.FC<AttachmentsSectionProps> = ({ unitId, tenantId }) => {
  const parent = unitId ? { unitId } : { tenantId: tenantId! };
  const { attachments, isLoading, upload, remove } = useAttachments(parent);
  const [uploading, setUploading] = useState(false);
  const [attachmentToDelete, setAttachmentToDelete] = useState<Attachment | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = ''; // so picking the same file again re-triggers onChange
    if (files.length === 0) return;
    setUploading(true);
    try {
      for (const file of files) {
        if (file.size > MAX_SIZE_BYTES) {
          toast.error('הקובץ גדול מדי (מקסימום 10MB)');
          continue;
        }
        // Sequential on purpose; failures already toast via the hook's onError.
        await upload(file).catch(() => {});
      }
    } finally {
      setUploading(false);
    }
  };

  const images = attachments.filter(isImage);
  const others = attachments.filter((att) => !isImage(att));

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">קבצים ומסמכים</h3>
        <Button
          type="button"
          variant="outline"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
        >
          <Paperclip />
          {uploading ? 'מעלה...' : 'העלה קובץ'}
        </Button>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*,application/pdf"
        multiple
        className="hidden"
        onChange={handleFiles}
      />

      {images.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {images.map((att) => (
            <ImageThumb key={att.id} att={att} onDelete={() => setAttachmentToDelete(att)} />
          ))}
        </div>
      )}

      {others.length > 0 && (
        <div className="space-y-2">
          {others.map((att) => (
            <FileRow key={att.id} att={att} onDelete={() => setAttachmentToDelete(att)} />
          ))}
        </div>
      )}

      {!isLoading && attachments.length === 0 && (
        <p className="text-sm text-muted-foreground">אין קבצים עדיין</p>
      )}

      <AlertDialog open={attachmentToDelete !== null} onOpenChange={(open) => { if (!open) setAttachmentToDelete(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>למחוק את הקובץ?</AlertDialogTitle>
            <AlertDialogDescription>
              הקובץ „{attachmentToDelete?.file_name}” יימחק לצמיתות ולא יהיה אפשר לשחזר אותו.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ביטול</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (attachmentToDelete) remove(attachmentToDelete);
                setAttachmentToDelete(null);
              }}
            >
              מחיקת הקובץ
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
