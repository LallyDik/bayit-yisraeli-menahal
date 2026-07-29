import React from 'react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
  AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Archive } from 'lucide-react';

interface ConfirmArchiveProps {
  entityName: string;
  activeAssignment?: string | null;
  entityKind: 'unit' | 'tenant';
  onConfirm: () => void | Promise<void>;
}

export const ConfirmArchive: React.FC<ConfirmArchiveProps> = ({
  entityName, activeAssignment, entityKind, onConfirm,
}) => (
  <AlertDialog>
    <AlertDialogTrigger asChild>
      <Button variant="ghost" size="sm">
        <Archive className="w-4 h-4" />
        העבר לארכיון
      </Button>
    </AlertDialogTrigger>
    <AlertDialogContent dir="rtl" className="rounded-2xl border-border bg-card text-right">
      <AlertDialogHeader>
        <AlertDialogTitle>להעביר את "{entityName}" לארכיון?</AlertDialogTitle>
        <AlertDialogDescription className="text-base leading-7">
          {activeAssignment
            ? `${entityKind === 'tenant' ? 'השכירות הפעילה תסתיים והדירה' : 'השכירות הפעילה תסתיים והשוכר'} “${activeAssignment}” יישאר ללא שיוך. הרשומה תועבר לארכיון וההיסטוריה תישמר.`
            : 'הרשומה תוסתר מהמסך אך לא תימחק - כל ההיסטוריה נשמרת.'}
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>ביטול</AlertDialogCancel>
        <AlertDialogAction onClick={onConfirm}>העבר לארכיון</AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
);
