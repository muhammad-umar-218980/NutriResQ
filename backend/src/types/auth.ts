export type Role = 'donor' | 'recipient' | 'delivery' | 'admin';

export type AccountStatus = 'active' | 'suspended';

export const ROLE_LABELS: Record<Role, string> = {
  donor: 'Food Donor',
  recipient: 'Food Recipient',
  delivery: 'Delivery Partner',
  admin: 'Administrator',
};

export interface PublicUser {
  id: string;
  email: string;
  phone: string | null;
  role: Role;
  status: AccountStatus;
  emailVerifiedAt: string | null;
  createdAt: string;
  profile: Record<string, string | null> | null;
}
