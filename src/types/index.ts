import type { Database } from '@/types/database';

export type Unit = Database['public']['Tables']['units']['Row'];
export type Tenant = Database['public']['Tables']['tenants']['Row'];
export type Tenancy = Database['public']['Tables']['tenancies']['Row'];
export type Attachment = Database['public']['Tables']['attachments']['Row'];
export type Charge = Database['public']['Tables']['charges']['Row'];
export type Payment = Database['public']['Tables']['payments']['Row'];
export type PaymentAllocation = Database['public']['Tables']['payment_allocations']['Row'];
export type PaymentTerm = Database['public']['Tables']['tenancy_payment_terms']['Row'];
export type BillingSettings = Database['public']['Tables']['tenancy_billing_settings']['Row'];
export type BillingOccurrence = Database['public']['Tables']['billing_schedule_occurrences']['Row'];
export type MeterReading = Database['public']['Tables']['meter_readings']['Row'];

export type UnitInsert = Database['public']['Tables']['units']['Insert'];
export type TenantInsert = Database['public']['Tables']['tenants']['Insert'];
export type TenancyInsert = Database['public']['Tables']['tenancies']['Insert'];
export type AttachmentInsert = Database['public']['Tables']['attachments']['Insert'];
export type ChargeInsert = Database['public']['Tables']['charges']['Insert'];
export type PaymentInsert = Database['public']['Tables']['payments']['Insert'];
export type PaymentAllocationInsert = Database['public']['Tables']['payment_allocations']['Insert'];
export type PaymentTermInsert = Database['public']['Tables']['tenancy_payment_terms']['Insert'];
export type MeterReadingInsert = Database['public']['Tables']['meter_readings']['Insert'];
