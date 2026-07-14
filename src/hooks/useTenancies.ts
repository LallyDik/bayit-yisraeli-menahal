import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { listTenancies, createTenancy, endTenancy, type TenancyWithNames } from '@/api/tenancies';
import { useAuth } from '@/hooks/useAuth';
import type { TenancyInsert } from '@/types';

function humanize(e: unknown): string {
  const msg = e instanceof Error ? e.message : '';
  if (msg.includes('one_active_tenancy_per_unit')) {
    return 'ביחידה הזו כבר גר שוכר. סיים את תקופת השכירות הקיימת לפני שתשייך שוכר חדש.';
  }
  return msg || 'הפעולה נכשלה';
}

export const useTenancies = () => {
  const { user } = useAuth();
  // Keyed on the signed-in user, not just ['tenancies']: this hook mounts
  // unconditionally (above the auth `loading`/`!user` guards in Index), so
  // its query fires immediately, before sign-in resolves. Without the user id
  // in the key, that first fetch runs as anonymous, RLS correctly returns [],
  // and — because signing in doesn't invalidate an already-settled query —
  // a returning user with real tenancies would see a stale, silently-empty list
  // after logging in. Scoping the key by user id makes sign-in produce a
  // fresh cache entry instead of reusing the anonymous one, and `enabled`
  // stops the pre-auth fetch from firing at all.
  const KEY = ['tenancies', user?.id];
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: KEY });

  const { data: tenancies = [], isLoading } = useQuery({
    queryKey: KEY,
    queryFn: listTenancies,
    enabled: !!user,
  });

  const active = useMemo(() => tenancies.filter((t) => t.end_date === null), [tenancies]);

  const activeByUnitId = useMemo(
    () => new Map<string, TenancyWithNames>(active.map((t) => [t.unit_id, t])),
    [active],
  );
  const activeByTenantId = useMemo(
    () => new Map<string, TenancyWithNames>(active.map((t) => [t.tenant_id, t])),
    [active],
  );

  const create = useMutation({
    mutationFn: (input: Omit<TenancyInsert, 'owner_id' | 'id'>) => createTenancy(input),
    onSuccess: () => { invalidate(); toast.success('השוכר שויך ליחידה'); },
    onError: (e) => toast.error(humanize(e)),
  });

  const end = useMutation({
    mutationFn: ({ id, end_date }: { id: string; end_date: string }) => endTenancy(id, end_date),
    onSuccess: () => { invalidate(); toast.success('תקופת השכירות הסתיימה'); },
    onError: (e) => toast.error(humanize(e)),
  });

  return {
    tenancies,
    activeByUnitId,
    activeByTenantId,
    isLoading,
    createTenancy: create.mutate,
    endTenancy: end.mutate,
  };
};
