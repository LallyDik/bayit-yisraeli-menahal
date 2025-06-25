
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus } from 'lucide-react';
import { Tenant } from '@/types';

interface TenantFormProps {
  onSubmit: (tenant: Omit<Tenant, 'id' | 'createdAt'>) => void;
  initialData?: Partial<Tenant>;
  submitLabel?: string;
}

export const TenantForm: React.FC<TenantFormProps> = ({
  onSubmit,
  initialData = {},
  submitLabel = 'הוסף שוכר'
}) => {
  const [formData, setFormData] = useState({
    name: initialData.name,
    monthlyRent: initialData.monthlyRent,
    monthlyElectricity: initialData.monthlyElectricity,
    monthlyWater: initialData.monthlyWater,
    monthlyCommittee: initialData.monthlyCommittee,
    monthlyGas: initialData.monthlyGas,
    waterMeter: initialData.waterMeter,
    electricityMeter: initialData.electricityMeter,
    gasMeter: initialData.gasMeter,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.name.trim()) {
      onSubmit(formData);
      setFormData({
        name: '',
        monthlyRent: 0,
        monthlyElectricity: 0,
        monthlyWater: 0,
        monthlyCommittee: 0,
        monthlyGas: 0,
        waterMeter: 0,
        electricityMeter: 0,
        gasMeter: 0,
      });
    }
  };

  const handleInputChange = (field: string, value: string | number) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  return (
    <Card className="w-full max-w-4xl card-hover">
      <CardHeader className="gradient-bg text-white">
        <CardTitle className="flex items-center gap-2 text-xl">
          <Plus className="w-6 h-6" />
          {submitLabel}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="name" className="text-lg font-medium">
              שם השוכר
            </Label>
            <Input
              id="name"
              type="text"
              value={formData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              required
              className="text-lg p-3"
            />
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-semibold">תשלומים חודשיים</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="rent" className="text-base font-medium">
                  שכירות חודשית (₪)
                </Label>
                <Input
                  id="rent"
                  type="number"
                  value={formData.monthlyRent}
                  onChange={(e) => handleInputChange('monthlyRent', Number(e.target.value))}
                  min="0"
                  className="text-lg p-3 ltr"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="electricity" className="text-base font-medium">
                  חשמל חודשי (₪)
                </Label>
                <Input
                  id="electricity"
                  type="number"
                  value={formData.monthlyElectricity}
                  onChange={(e) => handleInputChange('monthlyElectricity', Number(e.target.value))}
                  min="0"
                  className="text-lg p-3 ltr"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="water" className="text-base font-medium">
                  מים חודשיים (₪)
                </Label>
                <Input
                  id="water"
                  type="number"
                  value={formData.monthlyWater}
                  onChange={(e) => handleInputChange('monthlyWater', Number(e.target.value))}
                  min="0"
                  className="text-lg p-3 ltr"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="committee" className="text-base font-medium">
                  ועד בית חודשי (₪)
                </Label>
                <Input
                  id="committee"
                  type="number"
                  value={formData.monthlyCommittee}
                  onChange={(e) => handleInputChange('monthlyCommittee', Number(e.target.value))}
                  min="0"
                  className="text-lg p-3 ltr"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="gas" className="text-base font-medium">
                  גז חודשי (₪)
                </Label>
                <Input
                  id="gas"
                  type="number"
                  value={formData.monthlyGas}
                  onChange={(e) => handleInputChange('monthlyGas', Number(e.target.value))}
                  min="0"
                  className="text-lg p-3 ltr"
                />
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-semibold">קריאות מונים</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="waterMeter" className="text-base font-medium">
                  מונה מים
                </Label>
                <Input
                  id="waterMeter"
                  type="number"
                  value={formData.waterMeter}
                  onChange={(e) => handleInputChange('waterMeter', Number(e.target.value))}
                  min="0"
                  className="text-lg p-3 ltr"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="electricityMeter" className="text-base font-medium">
                  מונה חשמל
                </Label>
                <Input
                  id="electricityMeter"
                  type="number"
                  value={formData.electricityMeter}
                  onChange={(e) => handleInputChange('electricityMeter', Number(e.target.value))}
                  min="0"
                  className="text-lg p-3 ltr"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="gasMeter" className="text-base font-medium">
                  מונה גז
                </Label>
                <Input
                  id="gasMeter"
                  type="number"
                  value={formData.gasMeter}
                  onChange={(e) => handleInputChange('gasMeter', Number(e.target.value))}
                  min="0"
                  className="text-lg p-3 ltr"
                />
              </div>
            </div>
          </div>

          <Button 
            type="submit" 
            className="w-full text-lg py-3 gradient-bg hover:opacity-90 transition-opacity"
          >
            {submitLabel}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};
