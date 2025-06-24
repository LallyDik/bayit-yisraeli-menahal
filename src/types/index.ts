
export interface Tenant {
  id: string;
  name: string;
  monthlyRent: number;
  monthlyElectricity: number;
  monthlyWater: number;
  monthlyCommittee: number;
  createdAt: Date;
}

export interface MonthlyPayment {
  id: string;
  tenantId: string;
  hebrewMonth: string;
  hebrewYear: string;
  rentPaid: boolean;
  electricityPaid: boolean;
  waterPaid: boolean;
  committeePaid: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type PaymentType = 'rent' | 'electricity' | 'water' | 'committee';

export interface PaymentSummary {
  tenant: Tenant;
  unpaidItems: PaymentType[];
  totalUnpaid: number;
}
