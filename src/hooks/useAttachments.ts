import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  listAttachments, uploadAttachment, deleteAttachment, type AttachmentParent,
} from '@/api/attachments';
import { useAuth } from '@/hooks/useAuth';
import type { Attachment } from '@/types';

export const useAttachments = (parent: AttachmentParent) => {
  const { user } = useAuth();
  const kind = 'unitId' in parent ? 'unit' : 'tenant';
  const parentId = 'unitId' in parent ? parent.unitId : parent.tenantId;
  // User-scoped key for the same reason as useUnits: a query settled before
  // sign-in must not be reused as the signed-in user's cache entry.
  const KEY = ['attachments', user?.id, kind, parentId];
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: KEY });
  const onError = (e: unknown) =>
    toast.error(e instanceof Error ? e.message : 'הפעולה נכשלה');

  const { data: attachments = [], isLoading } = useQuery({
    queryKey: KEY,
    queryFn: () => listAttachments(parent),
    enabled: !!user && !!parentId,
  });

  const upload = useMutation({
    mutationFn: (file: File) => uploadAttachment(file, parent),
    onSuccess: () => { invalidate(); toast.success('הקובץ הועלה'); },
    onError,
  });

  const remove = useMutation({
    mutationFn: (att: Attachment) => deleteAttachment(att),
    onSuccess: () => { invalidate(); toast.success('הקובץ נמחק'); },
    onError,
  });

  return {
    attachments,
    isLoading,
    upload: upload.mutateAsync,
    isUploading: upload.isPending,
    remove: remove.mutate,
  };
};
