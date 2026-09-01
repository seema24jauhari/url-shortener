import { useState } from 'react'
import { ArrowLeft, Eye, EyeOff, Lock } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import api from '../api/axios'
import { useNavigate } from 'react-router-dom'

const schema = z.object({
  currentPassword: z.string().min(1, 'Required'),
  newPassword: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string().min(1, 'Required'),
}).refine(d => d.newPassword === d.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword']
})

type ChangePasswordForm = z.infer<typeof schema>

const ChangePassword = () => {
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [apiError, setApiError] = useState('')
  const [success, setSuccess] = useState(false)
  const navigate = useNavigate()

  const { register, handleSubmit, formState: { errors, isSubmitting }, setError } = useForm<ChangePasswordForm>({
    resolver: zodResolver(schema)
  })

  const onSubmit = async (data: ChangePasswordForm) => {    
    try {
      setApiError('')
      const res = await api.post('/users/update-password',{
        currentPassword: data.currentPassword,
        newPassword: data.newPassword
      });
      const result = await res.data.data;
      if (result.error) {
        if (res.status === 401) {
          setApiError('Invalid email or password')
        } else {
          setApiError(result.message || 'Something went wrong')
        }
      }
      else{
        setSuccess(true)
        setTimeout(() => navigate('/dashboard'), 2000)  
      }
    } catch (err: any) {
        const status = err.response?.status
        const data = err.response?.data

        if (status === 409) {
          setApiError('Email already exists')
        } else if (status === 400) {
          Object.entries(data.errors).forEach(([field, message]) => {
            setError(field as keyof ChangePasswordForm, {
              message: message as string
            })
          })
        } else {
          setApiError(data?.message || 'Something went wrong')
        }
    }
  }

  return (
    <div className="flex items-center justify-center h-screen bg-[#0d0d0d]">
      <div className="bg-[#1a1a19] rounded-xl p-8 w-[450px] min-h-[400px]">
        <button
            onClick={() => navigate('/dashboard')}
            className="flex items-center gap-2 text-[#888] hover:text-white text-[0.8rem] mb-6 cursor-pointer"
            >
            <ArrowLeft size={14} />
            Back to chat
        </button>
        <div className="flex flex-col items-center mb-6">
          <div className="w-10 h-10 rounded-xl bg-[#032042] flex items-center justify-center mb-4">
            <Lock className="w-5 h-5 text-[#6da7ec]" />
          </div>
          <div className="text-[1.3rem] text-white font-bold">Change Password</div>
          <div className="text-[0.8rem] text-[#888]">Update your account password</div>
        </div>

        {success ? (
          <div className="text-center text-green-400 text-[0.85rem] mt-4">
            Password changed successfully! Redirecting...
          </div>
        ) : (
          <>
            <div>
              <div className="text-[0.8rem] text-left mb-1">Current Password</div>
              <div className="relative mt-1">
              <input
                type={!showCurrentPassword ? "password" : "text"}
                {...register('currentPassword')}
                placeholder="Enter current password"
                className="w-full bg-[#2c2c2a] text-white text-[0.85rem] rounded-md px-3 py-2 border border-[#1f1f1e] focus:outline-none focus:border-[#6da7ec]"
              />
                            <button
                type="button"
                onClick={() => setShowCurrentPassword((state) => !state)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white cursor-pointer"
              >
                {!showCurrentPassword ? (
                  <EyeOff size={20} />
                ) : (
                  <Eye size={20} />
                )}
              </button>
              </div>

              {errors.currentPassword && <p className="text-red-400 text-[0.75rem] mt-1 text-right">{errors.currentPassword.message}</p>}
            </div>

            <div>
              <div className="text-[0.8rem] text-left mb-1  mt-4">New Password</div>
              <div className="relative mt-1">
              <input
                type={showPassword?"text":"password"}
                {...register('newPassword')}
                placeholder="Enter new password"
                className="w-full bg-[#2c2c2a] text-white text-[0.85rem] rounded-md px-3 py-2 border border-[#1f1f1e] focus:outline-none focus:border-[#6da7ec]"
              />
              <button
                type="button"
                onClick={() => setShowPassword((state) => !state)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white cursor-pointer"
              >
                {!showPassword ? (
                  <EyeOff size={20} />
                ) : (
                  <Eye size={20} />
                )}
              </button>
              </div>
              {errors.newPassword && <p className="text-red-400 text-[0.75rem] mt-1 text-right">{errors.newPassword.message}</p>}
            </div>

            <div>
              <div className="text-[0.8rem] text-left mb-1 mt-4">Confirm New Password</div>
              <div className="relative mt-1">
              <input
                type={!showConfirmPassword ? "password" : "text"}
                {...register('confirmPassword')}
                placeholder="Confirm new password"
                className="w-full bg-[#2c2c2a] text-white text-[0.85rem] rounded-md px-3 py-2 border border-[#1f1f1e] focus:outline-none focus:border-[#6da7ec]"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword((state) => !state)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white cursor-pointer"
              >
                {!showConfirmPassword ? (
                  <EyeOff size={20} />
                ) : (
                  <Eye size={20} />
                )}
              </button>
              </div>
              {errors.confirmPassword && <p className="text-red-400 text-[0.75rem] mt-1 text-right">{errors.confirmPassword.message}</p>}
            </div>

            <div>
            <button
            className="text-[0.9rem] w-full rounded-md p-[0.5rem] mt-8 bg-[#fff] text-[#242424] font-bold cursor-pointer hover:bg-[#f0f0f0]"
            disabled={isSubmitting}
            onClick={handleSubmit(onSubmit)}
          >
              {isSubmitting ? 'Updating...' : 'Update Password'}
          </button>
          {apiError && (
            <p className="text-red-400 text-[0.75rem] mt-3 text-center">
              {apiError}
            </p>
          )}

            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default ChangePassword