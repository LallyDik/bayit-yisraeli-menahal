import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { listTenants, createTenant, updateTenant, archiveTenant } from '@/api/tenants';
import { useAuth } from '@/hooks/useAuth';
import type { TenantInsert } from '@/types';

export const useTenants = () => {
  const { user } = useAuth();
  // Keyed on the signed-in user, not just ['tenants']: this hook mounts
  // unconditionally (above the auth `loading`/`!user` guards in Index), so
  // its query fires immediately, before sign-in resolves. Without the user id
  // in the key, that first fetch runs as anonymous, RLS correctly returns [],
  // and — because signing in doesn't invalidate an already-settled query —
  // a returning user with real tenants would see a stale, silently-empty grid
  // after logging in. Scoping the key by user id makes sign-in produce a
  // fresh cache entry instead of reusing the anonymous one, and `enabled`
  // stops the pre-auth fetch from firing at all.
  const KEY = ['tenants', user?.id];
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: KEY });
  const onError = (e: unknown) =>
    toast.error(e instanceof Error ? e.message : 'הפעולה נכשלה');

  const { data: tenants = [], isLoading } = useQuery({
    queryKey: KEY,
    queryFn: listTenants,
    enabled: !!user,
  });

  const create = useMutation({
    mutationFn: (input: Omit<TenantInsert, 'owner_id' | 'id'>) => createTenant(input),
    onSuccess: () => { invalidate(); toast.success('השוכר נוסף'); },
    onError,
  });

  const update = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<TenantInsert> }) =>
      updateTenant(id, patch),
    onSuccess: () => { invalidate(); toast.success('השוכר עודכן'); },
    onError,
  });

  const archive = useMutation({
    mutationFn: (id: string) => archiveTenant(id),
    onSuccess: () => { invalidate(); toast.success('השוכר הועבר לארכיון'); },
    onError,
  });

  return {
    tenants,
    isLoading,
    createTenant: create.mutate,
    updateTenant: update.mutate,
    archiveTenant: archive.mutate,
  };
};
