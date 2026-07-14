import type { Database } from '@/types/database';

export type Unit = Database['public']['Tables']['units']['Row'];
export type Tenant = Database['public']['Tables']['tenants']['Row'];
export type Tenancy = Database['public']['Tables']['tenancies']['Row'];
export type Attachment = Database['public']['Tables']['attachments']['Row'];

export type UnitInsert = Database['public']['Tables']['units']['Insert'];
export type TenantInsert = Database['public']['Tables']['tenants']['Insert'];
export type TenancyInsert = Database['public']['Tables']['tenancies']['Insert'];
export type AttachmentInsert = Database['public']['Tables']['attachments']['Insert'];
