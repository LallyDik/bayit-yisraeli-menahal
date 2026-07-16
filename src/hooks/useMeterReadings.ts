import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { addMeterReading, deleteMeterReading, listMeterReadings, updateMeterReading, type MeterKind } from '@/api/meterReadings';
import { useAuth } from '@/hooks/useAuth';

export function useMeterReadings(unitId: string | undefined, meterKind: MeterKind) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const queryKey = ['meter-readings', user?.id, unitId, meterKind];
  const invalidate = () => queryClient.invalidateQueries({ queryKey });
  const onError = (error: unknown) => toast.error(error instanceof Error ? error.message : 'שמירת קריאת המונה נכשלה');

  const query = useQuery({
    queryKey,
    queryFn: () => listMeterReadings(unitId!, meterKind),
    enabled: Boolean(user && unitId),
  });
  const add = useMutation({
    mutationFn: addMeterReading,
    onSuccess: invalidate,
    onError,
  });
  const update = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: { reading_date?: string; value?: number; note?: string | null } }) => updateMeterReading(id, patch),
    onSuccess: invalidate,
    onError,
  });
  const remove = useMutation({
    mutationFn: deleteMeterReading,
    onSuccess: invalidate,
    onError,
  });

  return {
    readings: query.data ?? [],
    isLoading: query.isLoading,
    addReading: add.mutateAsync,
    updateReading: update.mutateAsync,
    deleteReading: remove.mutateAsync,
  };
}
