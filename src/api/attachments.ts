import { supabase } from '@/lib/supabase';
import type { Attachment } from '@/types';

export type AttachmentParent = { unitId: string } | { tenantId: string };

export async function listAttachments(parent: AttachmentParent): Promise<Attachment[]> {
  let query = supabase.from('attachments').select('*').order('created_at', { ascending: false });
  query = 'unitId' in parent ? query.eq('unit_id', parent.unitId) : query.eq('tenant_id', parent.tenantId);
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function uploadAttachment(file: File, parent: AttachmentParent): Promise<Attachment> {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) throw new Error('לא מחובר');

  const ext = file.name.includes('.') ? file.name.split('.').pop() : 'bin';
  const path = `${uid}/${crypto.randomUUID()}.${ext}`;   // ASCII-safe key; Hebrew name lives in the row

  const { error: upErr } = await supabase.storage.from('attachments').upload(path, file, {
    contentType: file.type, upsert: false,
  });
  if (upErr) throw upErr;

  const { data, error } = await supabase.from('attachments').insert({
    file_name: file.name,
    storage_path: path,
    content_type: file.type,
    size_bytes: file.size,
    ...('unitId' in parent ? { unit_id: parent.unitId } : { tenant_id: parent.tenantId }),
  }).select().single();
  if (error) {
    // The object is in storage but the row failed - remove the orphan, then surface the real error.
    await supabase.storage.from('attachments').remove([path]);
    throw error;
  }
  return data;
}

export async function deleteAttachment(att: Attachment): Promise<void> {
  // Storage first: re-running after a partial failure self-heals (remove of a
  // missing object is not an error), while a dangling row stays visible for retry.
  const { error: rmErr } = await supabase.storage.from('attachments').remove([att.storage_path]);
  if (rmErr) throw rmErr;
  const { error } = await supabase.from('attachments').delete().eq('id', att.id);
  if (error) throw error;
}

export async function getAttachmentUrl(att: Attachment): Promise<string> {
  const { data, error } = await supabase.storage.from('attachments')
    .createSignedUrl(att.storage_path, 3600);
  if (error) throw error;
  return data.signedUrl;
}
