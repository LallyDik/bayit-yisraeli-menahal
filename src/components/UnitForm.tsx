import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Plus } from 'lucide-react';
import { AttachmentsSection } from '@/components/AttachmentsSection';
import type { Unit } from '@/types';

// Sentinel for "not specified" — Radix Select rejects an empty-string item
// value, and we need an explicit, selectable option to represent null
// (not just an unset/placeholder state).
const NOT_SPECIFIED = 'not-specified';
const CONDITIONS = ['חדש', 'משופץ', 'טוב', 'דורש שיפוץ'] as const;
const FURNISHINGS = ['מרוהט קומפלט', 'מרוהט חלקית', 'לא מרוהט'] as const;

interface UnitFormProps {
  onSubmit: (values: {
    name: string;
    default_rent: number | null;
    description: string | null;
    notes: string | null;
    area_sqm: number | null;
    rooms: number | null;
    condition: string | null;
    year_built_or_renovated: number | null;
    air_conditioned: boolean | null;
    furnishing: string | null;
  }) => void;
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
  const [areaSqm, setAreaSqm] = useState(initialData.area_sqm?.toString() ?? '');
  const [rooms, setRooms] = useState(initialData.rooms?.toString() ?? '');
  const [condition, setCondition] = useState(initialData.condition ?? NOT_SPECIFIED);
  const [yearBuiltOrRenovated, setYearBuiltOrRenovated] = useState(
    initialData.year_built_or_renovated?.toString() ?? '',
  );
  const [airConditioned, setAirConditioned] = useState(
    initialData.air_conditioned == null ? NOT_SPECIFIED : (initialData.air_conditioned ? 'yes' : 'no'),
  );
  const [furnishing, setFurnishing] = useState(initialData.furnishing ?? NOT_SPECIFIED);
  const [description, setDescription] = useState(initialData.description ?? '');
  const [notes, setNotes] = useState(initialData.notes ?? '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSubmit({
      name: name.trim(),
      default_rent: rent === '' ? null : Number(rent),
      description: description.trim() === '' ? null : description.trim(),
      notes: notes.trim() === '' ? null : notes.trim(),
      area_sqm: areaSqm === '' ? null : Number(areaSqm),
      rooms: rooms === '' ? null : Number(rooms),
      condition: condition === NOT_SPECIFIED ? null : condition,
      year_built_or_renovated: yearBuiltOrRenovated === '' ? null : Number(yearBuiltOrRenovated),
      air_conditioned: airConditioned === NOT_SPECIFIED ? null : airConditioned === 'yes',
      furnishing: furnishing === NOT_SPECIFIED ? null : furnishing,
    });
  };

  return (
    <Card className="w-full max-w-2xl card-hover">
      <CardHeader className="bg-primary/20 text-foreground border-b-[3px] border-primary">
        <CardTitle className="flex items-center gap-2 text-xl font-display">
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="unit-area" className="text-base font-medium">מ"ר — אופציונלי</Label>
              <Input
                id="unit-area" type="number" min="1" step="0.5" value={areaSqm} className="text-lg p-3 ltr"
                onChange={(e) => setAreaSqm(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="unit-rooms" className="text-base font-medium">חדרים — אופציונלי</Label>
              <Input
                id="unit-rooms" type="number" min="0.5" step="0.5" value={rooms} className="text-lg p-3 ltr"
                onChange={(e) => setRooms(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label className="text-base font-medium">מצב — אופציונלי</Label>
              <Select value={condition} onValueChange={setCondition}>
                <SelectTrigger className="text-lg p-3"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NOT_SPECIFIED}>לא צוין</SelectItem>
                  {CONDITIONS.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-base font-medium">ריהוט — אופציונלי</Label>
              <Select value={furnishing} onValueChange={setFurnishing}>
                <SelectTrigger className="text-lg p-3"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NOT_SPECIFIED}>לא צוין</SelectItem>
                  {FURNISHINGS.map((f) => (
                    <SelectItem key={f} value={f}>{f}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-base font-medium">ממוזגת — אופציונלי</Label>
              <Select value={airConditioned} onValueChange={setAirConditioned}>
                <SelectTrigger className="text-lg p-3"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NOT_SPECIFIED}>לא צוין</SelectItem>
                  <SelectItem value="yes">כן</SelectItem>
                  <SelectItem value="no">לא</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="unit-year" className="text-base font-medium">
                שנת בנייה / שיפוץ אחרון — אופציונלי
              </Label>
              <Input
                id="unit-year" type="number" min="1800" max="2100" value={yearBuiltOrRenovated}
                className="text-lg p-3 ltr"
                onChange={(e) => setYearBuiltOrRenovated(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="unit-description" className="text-base font-medium">תיאור — אופציונלי</Label>
            <Textarea
              id="unit-description" value={description} className="text-right"
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="unit-notes" className="text-base font-medium">הערות — אופציונלי</Label>
            <Textarea
              id="unit-notes" value={notes} className="text-right"
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {initialData.id && <AttachmentsSection unitId={initialData.id} />}

          <Button type="submit" className="w-full text-lg py-3">
            {submitLabel}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};
