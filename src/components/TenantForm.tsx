import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus } from 'lucide-react';
import type { Tenant } from '@/types';

interface TenantFormProps {
  onSubmit: (values: {
    name: string;
    phone: string | null;
    email: string | null;
    description: string | null;
    notes: string | null;
  }) => void;
  initialData?: Partial<Tenant>;
  submitLabel?: string;
}

export const TenantForm: React.FC<TenantFormProps> = ({
  onSubmit,
  initialData = {},
  submitLabel = 'הוסף שוכר',
}) => {
  const [name, setName] = useState(initialData.name ?? '');
  const [phone, setPhone] = useState(initialData.phone ?? '');
  const [email, setEmail] = useState(initialData.email ?? '');
  const [description, setDescription] = useState(initialData.description ?? '');
  const [notes, setNotes] = useState(initialData.notes ?? '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSubmit({
      name: name.trim(),
      phone: phone.trim() === '' ? null : phone.trim(),
      email: email.trim() === '' ? null : email.trim(),
      description: description.trim() === '' ? null : description.trim(),
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
            <Label htmlFor="tenant-name" className="text-lg font-medium">שם השוכר</Label>
            <Input
              id="tenant-name" value={name} required className="text-lg p-3"
              onChange={(e) => setName(e.target.value)}
            />
            <p className="text-sm text-muted-foreground">
              זה כל מה שצריך. את השיוך ליחידה ואת שכר הדירה מגדירים בשלב הבא.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="tenant-phone" className="text-base font-medium">טלפון — אופציונלי</Label>
            <Input
              id="tenant-phone" type="tel" value={phone} className="text-lg p-3 ltr"
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="tenant-email" className="text-base font-medium">מייל — אופציונלי</Label>
            <Input
              id="tenant-email" type="email" value={email} className="text-lg p-3 ltr"
              onChange={(e) => setEmail(e.target.value)}
            />
            <p className="text-sm text-muted-foreground">יידרש בהמשך לתזכורות תשלום.</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="tenant-description" className="text-base font-medium">תיאור — אופציונלי</Label>
            <Textarea
              id="tenant-description" value={description} className="text-right"
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="tenant-notes" className="text-base font-medium">הערות — אופציונלי</Label>
            <Textarea
              id="tenant-notes" value={notes} className="text-right"
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
