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
  onConfirm: () => void;
}

export const ConfirmArchive: React.FC<ConfirmArchiveProps> = ({ entityName, onConfirm }) => (
  <AlertDialog>
    <AlertDialogTrigger asChild>
      <Button variant="ghost" size="sm">
        <Archive className="w-4 h-4" />
        העבר לארכיון
      </Button>
    </AlertDialogTrigger>
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>להעביר את "{entityName}" לארכיון?</AlertDialogTitle>
        <AlertDialogDescription>
          הרשומה תוסתר מהמסך אך לא תימחק — כל ההיסטוריה נשמרת.
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>ביטול</AlertDialogCancel>
        <AlertDialogAction onClick={onConfirm}>העבר לארכיון</AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
);
