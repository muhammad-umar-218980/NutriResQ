import { z } from 'zod';

export const PORTAL_IDS = ['donor', 'recipient', 'delivery'] as const;

const email = z.string().trim().email('Enter a valid email address.').max(254);
const password = z
  .string()
  .min(8, 'Use at least 8 characters.')
  .max(200, 'The password is too long.');
const phone = z
  .string()
  .trim()
  .regex(/^[+()\d\s-]{7,32}$/, 'Enter a valid phone number.');
const name = z.string().trim().min(1, 'This field is required.').max(120);
const choice = z.string().trim().min(1, 'Select an option.').max(80);

const donorProfile = z.object({
  businessName: name,
  businessType: choice,
  representativeName: name,
});

const recipientProfile = z.object({
  organizationName: name,
  organizationType: choice,
  representativeName: name,
});

const deliveryProfile = z.object({
  companyName: name,
  businessType: choice,
  fleetManagerName: name,
});

const registerBase = { email, phone, password };

export const registerSchema = z.discriminatedUnion('portal', [
  z.object({ ...registerBase, portal: z.literal('donor'), profile: donorProfile }),
  z.object({ ...registerBase, portal: z.literal('recipient'), profile: recipientProfile }),
  z.object({ ...registerBase, portal: z.literal('delivery'), profile: deliveryProfile }),
]);

export const loginSchema = z.object({
  portal: z.enum(PORTAL_IDS),
  email,
  password: z.string().min(1, 'Enter your password.').max(200),
  remember: z.boolean().optional().default(false),
});

export const adminLoginSchema = z.object({
  email,
  password: z.string().min(1, 'Enter your password.').max(200),
  remember: z.boolean().optional().default(false),
});

export const forgotPasswordSchema = z.object({ email });

export const resetPasswordSchema = z.object({
  token: z.string().min(20, 'The reset token is missing or malformed.'),
  password,
});

export const verifyEmailSchema = z.object({
  token: z.string().min(20, 'The verification token is missing or malformed.'),
});

export type RegisterBody = z.infer<typeof registerSchema>;
export type LoginBody = z.infer<typeof loginSchema>;
export type AdminLoginBody = z.infer<typeof adminLoginSchema>;
