import { forwardRef } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { beneficiariosApi } from '../api/vivienda.api'

const schema = z.object({
  dni: z.string().min(7, 'DNI inválido').max(10),
  nombre: z.string().min(1, 'Requerido'),
  apellido: z.string().min(1, 'Requerido'),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  telefono: z.string().optional(),
  fecha_nacimiento: z.string().optional(),
  domicilio_calle: z.string().optional(),
  domicilio_numero: z.string().optional(),
  domicilio_localidad: z.string().optional(),
  domicilio_departamento: z.string().optional(),
})

type FormData = z.infer<typeof schema>

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      {children}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  )
}

const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  (props, ref) => (
    <input
      ref={ref}
      {...props}
      className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
    />
  )
)

export function BeneficiarioFormPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  const mutation = useMutation({
    mutationFn: (data: FormData) =>
      beneficiariosApi.create({
        ...data,
        email: data.email || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['beneficiarios'] })
      navigate('/vivienda/beneficiarios')
    },
  })

  return (
    <div className="max-w-2xl">
      <h2 className="text-xl font-semibold text-gray-800 mb-6">Nuevo Beneficiario</h2>

      <form onSubmit={handleSubmit((data) => mutation.mutate(data))} noValidate className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Field label="DNI *" error={errors.dni?.message}>
            <Input {...register('dni')} placeholder="12345678" />
          </Field>
          <Field label="Fecha de nacimiento" error={errors.fecha_nacimiento?.message}>
            <Input {...register('fecha_nacimiento')} type="date" />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Nombre *" error={errors.nombre?.message}>
            <Input {...register('nombre')} placeholder="Juan" />
          </Field>
          <Field label="Apellido *" error={errors.apellido?.message}>
            <Input {...register('apellido')} placeholder="Pérez" />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Email" error={errors.email?.message}>
            <Input {...register('email')} type="email" placeholder="juan@ejemplo.com" />
          </Field>
          <Field label="Teléfono" error={errors.telefono?.message}>
            <Input {...register('telefono')} placeholder="0351-1234567" />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Departamento" error={errors.domicilio_departamento?.message}>
            <Input {...register('domicilio_departamento')} placeholder="Capital" />
          </Field>
          <Field label="Localidad" error={errors.domicilio_localidad?.message}>
            <Input {...register('domicilio_localidad')} placeholder="Córdoba" />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Calle" error={errors.domicilio_calle?.message}>
            <Input {...register('domicilio_calle')} placeholder="Av. Colón" />
          </Field>
          <Field label="Número" error={errors.domicilio_numero?.message}>
            <Input {...register('domicilio_numero')} placeholder="123" />
          </Field>
        </div>

        {mutation.isError && (
          <p className="text-sm text-red-600">Error al guardar. Verificá que el DNI no esté registrado.</p>
        )}

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={mutation.isPending}
            className="bg-blue-700 text-white px-5 py-2 rounded text-sm hover:bg-blue-600 disabled:opacity-50"
          >
            {mutation.isPending ? 'Guardando...' : 'Guardar beneficiario'}
          </button>
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="px-5 py-2 rounded text-sm border border-gray-300 hover:bg-gray-50"
          >
            Cancelar
          </button>
        </div>
      </form>
    </div>
  )
}
