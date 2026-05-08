import { z } from "zod";

export const signInSchema = z.object({
  email: z
    .string()
    .email("Enter a valid email address")
    .min(1, "Email is required"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export const signUpSchema = z.object({
  email: z
    .string()
    .email("Enter a valid email address")
    .min(1, "Email is required"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(100, "Password too long"),
  name: z
    .string()
    .min(2, "Enter your full name")
    .max(100, "Name too long"),
});

export const magicLinkSchema = z.object({
  email: z
    .string()
    .email("Enter a valid email address")
    .min(1, "Email is required"),
});

export type SignInInput = z.infer<typeof signInSchema>;
export type SignUpInput = z.infer<typeof signUpSchema>;
export type MagicLinkInput = z.infer<typeof magicLinkSchema>;
