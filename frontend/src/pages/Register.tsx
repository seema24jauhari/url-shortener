import { Eye, EyeOff, UserPlus } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from "react-router-dom";
import z from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import api from '../api/axios';


const registerSchema = z.object({
      name: z.string().min(2, 'Name must be at least 2 characters'),
      email: z.string().email('Enter a valid email'),
      password: z.string().min(8, 'Password must be at least 8 characters'),
})

type RegisterForm = z.infer<typeof registerSchema>

function Register() {
    const [email, setEmail] = useState('')
    const [name, setName] = useState('')
    const [password, setPassword] = useState('')
    const navigate = useNavigate()
    
    const { register, handleSubmit, formState: { errors, isSubmitting, }, setError } = useForm<RegisterForm>({
        resolver: zodResolver(registerSchema)
    
    })
    const [apiError, setApiError] = useState('')
    const [showPassword, setShowPassword] = useState(false)

    const onSubmit = async (data: RegisterForm) => {
      try {
        setApiError('')
        const res = await api.post('/auth/register', data, { withCredentials: true })
        const result = res.data.data

        if (result.email) {
          navigate('/')
          return 
        }

      } catch (err: any) {
        const status = err.response?.status
        const data = err.response?.data

        if (status === 409) {
          setApiError('Email already exists')
        } else if (status === 400) {
          Object.entries(data.errors).forEach(([field, message]) => {
            setError(field as keyof RegisterForm, {
              message: message as string
            })
          })
        } else {
          setApiError('Something went wrong. Please try again.')
        }
      }
    }
  return (
    <>
      <div className='flex flex-col items-center justify-center h-screen'>
          <div className='mx-auto max-w-[1500] rounded-xl p-6 mx-auto min-h-[600px] w-[500px] bg-[#1a1a19]'>
            <div>
              <div className="w-12 h-10 rounded-xl bg-[#11260f] flex items-center justify-center mx-auto mb-4">
                <UserPlus className="w-5 h-5 text-[#0ca30c]" />
              </div>
              <div className='text-[1.3rem] text-[#fff] font-bold mb-[0.1rem]'>Create an account</div>
              <div className='text-[0.8rem]'>Start chatting with your friends</div>
            </div>
            <div>
              <div>
                  <div className='text-[0.8rem] text-left mt-4'>Fullname</div> 
                  <input {...register('name')} type="text" className='text-[0.9rem] w-full rounded-md p-[0.5rem] mt-1 focus:border-[#6da7ec] focus:outline-none focus:ring-0 bg-[#2c2c2a] border border-[#1f1f1e] text-[#fff]' placeholder='Jane Cooper' value={name} onChange={(e) => setName(e.target.value)}/>
                  {errors.name && (
                    <p className='text-red-400 text-[0.75rem] mt-1 text-right'>{errors.name.message}</p>
                  )}
              </div>
              <div>
                  <div className='text-[0.8rem] text-left mt-4'>Email</div> 
                  <input {...register('email')} type="text" className='text-[0.9rem] w-full rounded-md p-[0.5rem] mt-1 focus:border-[#6da7ec] focus:outline-none focus:ring-0 bg-[#2c2c2a] border border-[#1f1f1e] text-[#fff]' placeholder='abc@gmail.com' value={email} onChange={(e) => setEmail(e.target.value)}/>
                  {errors.email && (
                    <p className='text-red-400 text-[0.75rem] mt-1 text-right'>{errors.email.message}</p>
                  )}
              </div>
              <div>
                  <div className='text-[0.8rem] text-left mt-4'>Password</div> 
                  <div className="relative mt-1">
                  <input
                    type={(!showPassword)?"password":"text"}
                    {...register('password')} className='text-[0.9rem] w-full rounded-md p-[0.5rem] focus:border-[#6da7ec] focus:outline-none focus:ring-0 bg-[#2c2c2a] border border-[#1f1f1e] text-[#fff]' placeholder='Enter your password' value={password} onChange={(e) => setPassword(e.target.value)}

                  />
                  <button
                    type="button"
                    className='absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white cursor-pointer'
                    onClick={() => setShowPassword(state=>!state) }
                  >
                    {(!showPassword)?<EyeOff size={20} />:<Eye size={20} />}
                  </button>
                </div>
                  {errors.password && (
                    <p className='text-red-400 text-[0.75rem] mt-1 text-right'>{errors.password.message}</p>
                  )}
              </div>
              <div>
                    <button className='text-[0.9rem] w-full rounded-md p-[0.5rem] mt-4 bg-[#fff] text-[#242424] font-bold cursor-pointer hover:bg-[#f0f0f0]' 
                    disabled={isSubmitting}
                    onClick={handleSubmit(onSubmit)}
                    >{isSubmitting ? 'Signing up...' : 'Sign up'}</button>
                    {apiError && (
                      <p className="text-red-400 text-[0.75rem] mt-3 text-center">{apiError}</p>
                    )}
              </div>
              <div className='text-[0.8rem] mt-4 text-center'>Already have an account? 
                <Link to="/" className="text-[#6da7ec] ml-1">
                    Log in
                </Link>
              </div>
              </div>
          </div>
      </div>
    </>
  )
}

export default Register
