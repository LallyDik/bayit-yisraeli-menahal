import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus } from 'lucide-react';
import type { Unit } from '@/types';

interface UnitFormProps {
  onSubmit: (values: { name: string; default_rent: number | null; notes: string | null }) => void;
  initialData?: Partial<Unit>;
  submitLabel?: string;
}

export const UnitForm: React.FC<UnitFormProps> = ({
  onSubmit,
  initialData = {},
  submitLabel = 'הוסף יחידה',
}) => {
  const [name, setName] = useState(initialData.name ?? '');
  const [rent, setRent] = useState(initialData.default_rent?.toString() ?? '');
  const [notes, setNotes] = useState(initialData.notes ?? '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSubmit({
      name: name.trim(),
      default_rent: rent === '' ? null : Number(rent),
      notes: notes.trim() === '' ? null : notes.trim(),
    });
  };

  return (
    <Card className="w-full max-w-2xl card-hover">
      <CardHeader className="gradient-bg text-white">
        <CardTitle className="flex items-center gap-2 text-xl">
          <Plus className="w-6 h-6" />
          {submitLabel}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="unit-name" className="text-lg font-medium">שם היחידה</Label>
            <Input
              id="unit-name" value={name} required className="text-lg p-3"
              onChange={(e) => setName(e.target.value)}
              placeholder="לדוגמה: דירה 3, קומה ב'"
            />
            <p className="text-sm text-muted-foreground">
              זה כל מה שצריך כדי לפתוח יחידה. אפשר להשלים את השאר מתי שתרצה.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="unit-rent" className="text-base font-medium">
              שכר דירה מבוקש (₪) — אופציונלי
            </Label>
            <Input
              id="unit-rent" type="number" min="0" value={rent} className="text-lg p-3 ltr"
              onChange={(e) => setRent(e.target.value)}
            />
            <p className="text-sm text-muted-foreground">
              משמש רק כברירת מחדל בטופס כששוכר חדש נכנס. שינוי כאן לא ישנה את מה שסוכם עם שוכר קיים.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="unit-notes" className="text-base font-medium">הערות — אופציונלי</Label>
            <Textarea
              id="unit-notes" value={notes} className="text-right"
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <Button type="submit" className="w-full text-lg py-3 gradient-bg hover:opacity-90">
            {submitLabel}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};
