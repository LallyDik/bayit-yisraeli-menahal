
export interface Tenant {
  id: string;
  name: string;
  monthlyRent: number;
  monthlyElectricity: number;
  monthlyWater: number;
  monthlyCommittee: number;
  monthlyGas: number;
  waterMeter: number;
  electricityMeter: number;
  gasMeter: number;
  createdAt: Date;
}

export interface MonthlyPayment {
  id: string;
  tenantId: string;
  hebrewMonth: string;
  hebrewYear: string;
  rentPaid: number;
  electricityPaid: number;
  waterPaid: number;
  committeePaid: number;
  gasPaid: number;
  createdAt: Date;
  updatedAt: Date;
}

export type PaymentType = 'rent' | 'electricity' | 'water' | 'committee' | 'gas';

export interface PaymentSummary {
  tenant: Tenant;
  unpaidItems: PaymentType[];
  totalUnpaid: number;
}
