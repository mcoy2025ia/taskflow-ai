import { z } from 'zod'

export const SignInSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(8, 'Mínimo 8 caracteres'),
})

export const SignUpSchema = SignInSchema.extend({
  full_name: z.string().min(2, 'Nombre requerido').max(100),
  password_confirm: z.string(),
}).refine((d) => d.password === d.password_confirm, {
  message: 'Las contraseñas no coinciden',
  path: ['password_confirm'],
})

export type SignInInput = z.infer<typeof SignInSchema>
export type SignUpInput = z.infer<typeof SignUpSchema>