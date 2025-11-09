import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { motion } from 'motion/react'
import { OctagonXIcon } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSeparator,
  InputOTPSlot,
} from '@/components/ui/input-otp'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Spinner } from '@/components/ui/spinner'

export const Route = createFileRoute('/auth/reset-password-code')({
  component: ResetPasswordCodePage,
  validateSearch: (search: Record<string, unknown>) => {
    return {
      email: (search.email as string) || '',
    }
  },
})

function ResetPasswordCodePage() {
  const navigate = useNavigate()
  const { verifyPasswordResetCode } = useAuth()
  const [code, setCode] = useState('')
  const [isVerifying, setIsVerifying] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { email } = Route.useSearch()

  // Redirect if no email provided
  useEffect(() => {
    if (!email) {
      navigate({ to: '/auth/request-reset-password' })
    }
  }, [email, navigate])

  // Clear error when code changes
  useEffect(() => {
    if (error) {
      setError(null)
    }
  }, [code])

  // Auto-dismiss error after 5 seconds
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => {
        setError(null)
      }, 5000)
      return () => clearTimeout(timer)
    }
  }, [error])

  const handleVerify = useCallback(async () => {
    if (!email || isVerifying) return
    if (code.length !== 6) {
      setError('Please enter the complete 6-digit code')
      return
    }
    setIsVerifying(true)
    setError(null)
    // Backend only expects code, not email
    const result = await verifyPasswordResetCode({ code })

    if (result.success) {
      toast.success('Reset code verified successfully!')
      navigate({
        to: '/auth/reset-password',
        search: { email, code },
      })
    } else {
      setError(result.error || 'Failed to verify reset code')
      setIsVerifying(false)
    }
  }, [email, code, verifyPasswordResetCode, isVerifying, navigate])

  // Auto-submit when code is complete
  useEffect(() => {
    if (code.length === 6 && !isVerifying && email) {
      handleVerify()
    }
  }, [code, isVerifying, email, handleVerify])

  return (
    <motion.main
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="min-h-screen flex items-center justify-center p-4 relative"
      style={{
        backgroundColor: '#fafafa',
        backgroundImage: "url('/auth-background.png')",
        backgroundSize: 'cover',
        backgroundPosition: 'right center',
        backgroundRepeat: 'no-repeat',
      }}
    >
      <div className="absolute inset-0 bg-black/15" />
      <style>{`
        @media (max-width: 768px) {
          main {
            background-position: center center !important;
          }
        }
      `}</style>

      <motion.section
        initial={{ x: 20, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: -20, opacity: 0 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        className="w-full max-w-md p-8 rounded-[22px] flex flex-col items-start gap-8 bg-background/98 backdrop-blur-md shadow-2xl border border-border/20 relative z-10"
      >
        {/* Logo and heading section */}
        <section className="flex flex-col gap-2 w-full items-start">
          <img
            src="/shamp-logo.svg"
            alt="Shamp Logo"
            className="h-8 w-auto"
          />
          <h1 className="text-2xl font-semibold text-foreground">
            Verify reset code
          </h1>
          <p className="text-sm text-muted-foreground">
            Enter the 6-digit code sent to{' '}
            <span className="font-medium text-foreground">{email}</span>
          </p>
        </section>

        {/* Form section */}
        <section className="flex flex-col gap-4 w-full">
          {/* OTP Input */}
          <section className="flex flex-col gap-4 items-center w-full">
            <InputOTP
              maxLength={6}
              value={code}
              onChange={(value) => setCode(value)}
              disabled={isVerifying}
              containerClassName=""
            >
              <InputOTPGroup className="justify-center gap-x-2">
                <InputOTPSlot index={0} aria-invalid={code.length > 0 && code.length < 6} />
                <InputOTPSlot index={1} aria-invalid={code.length > 0 && code.length < 6} />
                <InputOTPSeparator />
                <InputOTPSlot index={2} aria-invalid={code.length > 0 && code.length < 6} />
                <InputOTPSlot index={3} aria-invalid={code.length > 0 && code.length < 6} />
                <InputOTPSeparator />
                <InputOTPSlot index={4} aria-invalid={code.length > 0 && code.length < 6} />
                <InputOTPSlot index={5} aria-invalid={code.length > 0 && code.length < 6} />
              </InputOTPGroup>
            </InputOTP>
          </section>

          {/* Error alert */}
          {error && (
            <Alert variant="destructive">
              <OctagonXIcon />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Verify button */}
          <Button
            type="button"
            variant="default-glass"
            className="w-full mt-4"
            disabled={isVerifying || code.length !== 6}
            size="lg"
            onClick={() => {
              if (!isVerifying) handleVerify()
            }}
          >
            {isVerifying ? (
              <>
                <Spinner className="mr-2" />
                Verifying...
              </>
            ) : (
              'Verify code'
            )}
          </Button>
        </section>
      </motion.section>
    </motion.main>
  )
}
