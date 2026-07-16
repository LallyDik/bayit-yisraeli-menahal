import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { listUnits, createUnit, updateUnit, archiveUnit } from '@/api/units';
import { useAuth } from '@/hooks/useAuth';
import type { UnitInsert } from '@/types';

export const useUnits = () => {
  const { user } = useAuth();
  // Keyed on the signed-in user, not just ['units']: this hook mounts
  // unconditionally (above the auth `loading`/`!user` guards in Index), so
  // its query fires immediately, before sign-in resolves. Without the user id
  // in the key, that first fetch runs as anonymous, RLS correctly returns [],
  // and — because signing in doesn't invalidate an already-settled query —
  // a returning user with real units would see a stale, silently-empty grid
  // after logging in. Scoping the key by user id makes sign-in produce a
  // fresh cache entry instead of reusing the anonymous one, and `enabled`
  // stops the pre-auth fetch from firing at all.
  const KEY = ['units', user?.id];
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: KEY });
  const onError = (e: unknown) =>
    toast.error(e instanceof Error ? e.message : 'הפעולה נכשלה');

  const { data: units = [], isLoading, error, refetch } = useQuery({
    queryKey: KEY,
    queryFn: listUnits,
    enabled: !!user,
  });

  const create = useMutation({
    mutationFn: (input: Omit<UnitInsert, 'owner_id' | 'id'>) => createUnit(input),
    onSuccess: () => { invalidate(); toast.success('היחידה נוספה'); },
    onError,
  });

  const update = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<UnitInsert> }) =>
      updateUnit(id, patch),
    onSuccess: () => { invalidate(); toast.success('היחידה עודכנה'); },
    onError,
  });

  const archive = useMutation({
    mutationFn: (id: string) => archiveUnit(id),
    onSuccess: () => { invalidate(); toast.success('היחידה הועברה לארכיון'); },
    onError,
  });

  return {
    units,
    isLoading,
    error,
    refetch,
    isSaving: create.isPending || update.isPending,
    createUnit: create.mutateAsync,
    updateUnit: update.mutateAsync,
    archiveUnit: archive.mutateAsync,
  };
};
