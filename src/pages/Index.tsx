
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Users, Receipt, BarChart } from 'lucide-react';
import { TenantForm } from '@/components/TenantForm';
import { TenantCard } from '@/components/TenantCard';
import { PaymentManagement } from '@/components/PaymentManagement';
import { useTenants } from '@/hooks/useTenants';
import { Tenant } from '@/types';

type ViewMode = 'dashboard' | 'add-tenant' | 'manage-payments';

const Index = () => {
  const { tenants, addTenant, deleteTenant } = useTenants();
  const [viewMode, setViewMode] = useState<ViewMode>('dashboard');
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);

  const handleAddTenant = (tenantData: Omit<Tenant, 'id' | 'createdAt'>) => {
    addTenant(tenantData);
    setViewMode('dashboard');
  };

  const handleDeleteTenant = (tenantId: string) => {
    if (confirm('האם אתה בטוח שברצונך למחוק את השוכר?')) {
      deleteTenant(tenantId);
    }
  };

  const handleViewPayments = (tenant: Tenant) => {
    setSelectedTenant(tenant);
    setViewMode('manage-payments');
  };

  const totalMonthlyIncome = tenants.reduce((sum, tenant) => 
    sum + (tenant.monthlyRent || 0) + (tenant.monthlyElectricity || 0) + (tenant.monthlyWater || 0) + (tenant.monthlyCommittee || 0) + (tenant.monthlyGas || 0), 0
  );

  if (viewMode === 'add-tenant') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-cyan-50 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="mb-6">
            <Button 
              onClick={() => setViewMode('dashboard')} 
              variant="outline"
              className="mb-4"
            >
              ← חזור לדשבורד
            </Button>
          </div>
          <div className="flex justify-center">
            <TenantForm onSubmit={handleAddTenant} />
          </div>
        </div>
      </div>
    );
  }

  if (viewMode === 'manage-payments' && selectedTenant) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-cyan-50 p-6">
        <div className="max-w-6xl mx-auto">
          <PaymentManagement 
            tenant={selectedTenant}
            onBack={() => {
              setViewMode('dashboard');
              setSelectedTenant(null);
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-cyan-50">
      {/* Header */}
      <div className="gradient-bg text-white p-6">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-4xl font-bold mb-2">מערכת ניהול שוכרים</h1>
          <p className="text-xl opacity-90">ניהול מקצועי של נכסים ותשלומים</p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-6">
        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card className="card-hover">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <Users className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{tenants.length}</p>
                  <p className="text-sm text-muted-foreground">שוכרים פעילים</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="card-hover">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
                  <BarChart className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">₪{totalMonthlyIncome.toLocaleString()}</p>
                  <p className="text-sm text-muted-foreground">הכנסה חודשית</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="card-hover">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center">
                  <Receipt className="w-6 h-6 text-orange-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{tenants.length * 5}</p>
                  <p className="text-sm text-muted-foreground">כמה נשאר לשלם</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-4 mb-8">
          <Button 
            onClick={() => setViewMode('add-tenant')}
            className="gradient-bg hover:opacity-90 text-lg px-6 py-3"
            size="lg"
          >
            <Plus className="w-5 h-5 ml-2" />
            הוסף שוכר חדש
          </Button>
        </div>

        {/* Tenants Grid */}
        {tenants.length === 0 ? (
          <Card className="text-center p-12">
            <CardContent>
              <Users className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">אין שוכרים במערכת</h3>
              <p className="text-muted-foreground mb-6">הוסף שוכר ראשון כדי להתחיל</p>
              <Button 
                onClick={() => setViewMode('add-tenant')}
                className="gradient-bg hover:opacity-90"
              >
                <Plus className="w-4 h-4 ml-2" />
                הוסף שוכר ראשון
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div>
            <h2 className="text-2xl font-bold mb-6">רשימת שוכרים</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {tenants.map((tenant) => (
                <TenantCard
                  key={tenant.id}
                  tenant={tenant}
                  onDelete={handleDeleteTenant}
                  onViewPayments={handleViewPayments}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Index;
