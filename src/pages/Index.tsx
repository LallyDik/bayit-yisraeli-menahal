
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Users, Receipt, BarChart, LogOut } from 'lucide-react';
import { TenantForm } from '@/components/TenantForm';
import { TenantCard } from '@/components/TenantCard';
import { PaymentManagement } from '@/components/PaymentManagement';
import { Auth } from '@/components/Auth';
import { useTenants } from '@/hooks/useTenants';
import { useAuth } from '@/hooks/useAuth';
import { usePayments } from '@/hooks/usePayments';
import { getCurrentHebrewDate } from '@/utils/hebrewDates';
import { Tenant } from '@/types';

type ViewMode = 'dashboard' | 'add-tenant' | 'edit-tenant' | 'manage-payments';

const Index = () => {
  const { user, loading, signOut } = useAuth();
  const { tenants, addTenant, updateTenant, deleteTenant } = useTenants();
  const { payments } = usePayments();
  const [viewMode, setViewMode] = useState<ViewMode>('dashboard');
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);

  const currentDate = getCurrentHebrewDate();

  // Show loading screen while checking authentication
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-cyan-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-lg">טוען...</p>
        </div>
      </div>
    );
  }

  // Show authentication screen if user is not logged in
  if (!user) {
    return <Auth />;
  }

  const handleAddTenant = (tenantData: Omit<Tenant, 'id' | 'createdAt'>) => {
    addTenant(tenantData);
    setViewMode('dashboard');
  };

  const handleEditTenant = (tenantData: Omit<Tenant, 'id' | 'createdAt'>) => {
    if (selectedTenant) {
      updateTenant(selectedTenant.id, tenantData);
      setViewMode('dashboard');
      setSelectedTenant(null);
    }
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

  const handleEditTenantClick = (tenant: Tenant) => {
    setSelectedTenant(tenant);
    setViewMode('edit-tenant');
  };

  const totalMonthlyIncome = tenants.reduce((sum, tenant) => 
    sum + (tenant.monthlyRent || 0) + (tenant.monthlyElectricity || 0) + (tenant.monthlyWater || 0) + (tenant.monthlyCommittee || 0) + (tenant.monthlyGas || 0), 0
  );

  // Calculate total remaining to pay across all tenants
  const totalRemainingToPay = tenants.reduce((sum, tenant) => {
    const tenantTotal = (tenant.monthlyRent || 0) + (tenant.monthlyElectricity || 0) + 
                       (tenant.monthlyWater || 0) + (tenant.monthlyCommittee || 0) + (tenant.monthlyGas || 0);
    
    const currentPayment = payments.find(payment => 
      payment.tenantId === tenant.id && 
      payment.hebrewMonth === currentDate.month && 
      payment.hebrewYear === currentDate.year
    );
    
    const paidAmount = currentPayment ? 
      (currentPayment.rentPaid || 0) + (currentPayment.electricityPaid || 0) + 
      (currentPayment.waterPaid || 0) + (currentPayment.committeePaid || 0) + 
      (currentPayment.gasPaid || 0) : 0;
    
    return sum + (tenantTotal - paidAmount);
  }, 0);

  if (viewMode === 'add-tenant') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-cyan-50 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="mb-6 flex justify-between items-center">
            <Button 
              onClick={() => setViewMode('dashboard')} 
              variant="outline"
              className="mb-4"
            >
              ← חזור לדשבורד
            </Button>
            <Button onClick={signOut} variant="ghost" size="sm">
              <LogOut className="w-4 h-4 ml-2" />
              התנתק
            </Button>
          </div>
          <div className="flex justify-center">
            <TenantForm onSubmit={handleAddTenant} />
          </div>
        </div>
      </div>
    );
  }

  if (viewMode === 'edit-tenant' && selectedTenant) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-cyan-50 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="mb-6 flex justify-between items-center">
            <Button 
              onClick={() => {
                setViewMode('dashboard');
                setSelectedTenant(null);
              }} 
              variant="outline"
              className="mb-4"
            >
              ← חזור לדשבורד
            </Button>
            <Button onClick={signOut} variant="ghost" size="sm">
              <LogOut className="w-4 h-4 ml-2" />
              התנתק
            </Button>
          </div>
          <div className="flex justify-center">
            <TenantForm 
              onSubmit={handleEditTenant} 
              initialData={selectedTenant}
              submitLabel="עדכן שוכר"
            />
          </div>
        </div>
      </div>
    );
  }

  if (viewMode === 'manage-payments' && selectedTenant) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-cyan-50 p-6">
        <div className="max-w-6xl mx-auto">
          <div className="mb-6 flex justify-end">
            <Button onClick={signOut} variant="ghost" size="sm">
              <LogOut className="w-4 h-4 ml-2" />
              התנתק
            </Button>
          </div>
          <PaymentManagement 
            tenant={selectedTenant}
            onBack={() => {
              setViewMode('dashboard');
              setSelectedTenant(null);
            }}
            onTenantUpdate={updateTenant}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-cyan-50">
      {/* Header */}
      <div className="gradient-bg text-white p-6">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <div>
            <h1 className="text-4xl font-bold mb-2">מערכת ניהול שוכרים</h1>
            <p className="text-xl opacity-90">ניהול מקצועי של נכסים ותשלומים</p>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-lg">{user.email}</span>
            <Button onClick={signOut} variant="ghost" size="sm" className="text-white hover:bg-white/20">
              <LogOut className="w-4 h-4 ml-2" />
              התנתק
            </Button>
          </div>
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
                  <p className="text-2xl font-bold">₪{totalRemainingToPay.toLocaleString()}</p>
                  <p className="text-sm text-muted-foreground">נשאר לשלם</p>
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
                  onEdit={handleEditTenantClick}
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
