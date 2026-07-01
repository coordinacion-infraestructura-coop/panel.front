import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../shared/auth/AuthContext'

export function LoginPage() {
  const { user, loading, loginWithGoogle } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (!loading && user) navigate('/vivienda/programas', { replace: true })
  }, [user, loading, navigate])

  return (
    <div className="min-h-screen bg-gov-navy flex flex-col items-center justify-center px-4">
      <div className="fixed top-0 left-0 right-0 h-1 bg-gov-cyan" />

      <div className="mb-8 text-center">
        <p className="text-gov-cyan text-xs font-medium uppercase tracking-widest mb-3">
          Provincia de Córdoba
        </p>
        <h1 className="text-white text-2xl font-semibold leading-snug">
          Ministerio de Cooperativas<br />y Mutuales
        </h1>
      </div>

      <div className="bg-white rounded-xl shadow-2xl p-8 w-full max-w-sm">
        <p className="text-sm text-gray-500 mb-6 text-center">
          Ingresá con tu cuenta institucional
        </p>

        <button
          onClick={loginWithGoogle}
          disabled={loading}
          className="w-full flex items-center justify-center gap-3 border border-gray-200 rounded-lg px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50 shadow-sm cursor-pointer"
        >
          <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
            <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/>
            <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z"/>
            <path fill="#FBBC05" d="M3.964 10.707A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.039l3.007-2.332z"/>
            <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.961L3.964 7.293C4.672 5.166 6.656 3.58 9 3.58z"/>
          </svg>
          Ingresar con Google
        </button>

        <p className="text-xs text-gray-400 mt-5 text-center">
          Solo cuentas autorizadas por el Ministerio
        </p>
      </div>
    </div>
  )
}
