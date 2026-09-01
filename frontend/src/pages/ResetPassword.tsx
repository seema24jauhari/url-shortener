import { useState } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import api from "../api/axios";
import { MessageCircle, Eye, EyeOff, Lock } from "lucide-react";
import z from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

const resetPasswordSchema = z
  .object({
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string().min(1, 'Required'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type ResetPasswordForm = z.infer<typeof resetPasswordSchema>;

const ResetPassword = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [apiError, setApiError] = useState("");
  const [sent, setSent] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordForm>({
    resolver: zodResolver(resetPasswordSchema),
  });

  const onSubmit = async (data: ResetPasswordForm) => {
    try {
      const token = new URLSearchParams(window.location.search).get("token");
      const newData = {
        ...data,
        token,
      };
      const res = await api.post("/auth/reset-password", newData);
      const result = await res.data;
      if (result.error) {
        if (res.status === 401) {
          setApiError("Invalid email or password");
        } else {
          setApiError(result.message || "Something went wrong");
        }
      } else {
        setSent(true);
      }
    } catch (err: any) {
      const data = err.response?.data;
      setApiError(data?.message || "Something went wrong");
    }
  };

  return (
    <div className="flex items-center justify-center h-screen bg-[#0d0d0d]">
      {sent ? (
          <div className="mx-auto max-w-[1500] rounded-xl p-6 mx-auto min-h-[350px] w-[500px] bg-[#1a1a19] flex flex-col items-center justify-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#032042] flex items-center justify-center mx-auto">
              <Lock className="w-5 h-5 text-[#6da7ec]" />
            </div>
            <div className="text-[1.3rem] text-[#fff] font-bold">
              Password updated successfully
            </div>
            <div className="text-[0.8rem] text-center text-[#888]">
               Your password has been updated successfully. Please log in with your new password. <br/>
               <Link to="/" className="text-[#6da7ec] ml-1">
                Login
              </Link>
            </div>
          </div>
        ) : (
      <div className="bg-[#1a1a19] rounded-xl p-8 w-[400px]">
        <div className="w-10 h-10 rounded-xl bg-[#032042] flex items-center justify-center mx-auto mb-4">
          <MessageCircle className="w-5 h-5 text-[#6da7ec]" />
        </div>
        <h2 className="text-white text-xl font-bold mb-6">Reset password</h2>
        <div>
          <div>
            <div className="text-[0.8rem] text-left mt-4">New Password</div>
            <div className="relative mt-1">
              <input
                {...register("password")}
                type={!showPassword ? "password" : "text"}
                placeholder="Enter new password"
                className="w-full rounded-md p-[0.5rem] pr-10 text-[0.9rem] bg-[#2c2c2a] border border-[#1f1f1e] text-white focus:border-[#6da7ec] focus:outline-none focus:ring-0"
              />
              <button
                type="button"
                onClick={() => setShowPassword((state) => !state)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white cursor-pointer"
              >
                {!showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
            {errors.password && (
              <p className="text-red-400 text-[0.75rem] mt-1 text-right">
                {errors.password.message}
              </p>
            )}
          </div>
          <div>
            <div className="text-[0.8rem] text-left mt-4">Confirm Password</div>
            <div className="relative mt-1">
              <input
                {...register("confirmPassword")}
                type={!showConfirmPassword ? "password" : "text"}
                placeholder="Enter confirm password"
                className="w-full rounded-md p-[0.5rem] pr-10 text-[0.9rem] bg-[#2c2c2a] border border-[#1f1f1e] text-white focus:border-[#6da7ec] focus:outline-none focus:ring-0"
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
            {errors.confirmPassword && (
              <p className="text-red-400 text-[0.75rem] mt-1 text-right">
                {errors.confirmPassword.message}
              </p>
            )}
          </div>
        </div>
        <div>
          <button
            className="text-[0.9rem] w-full rounded-md p-[0.5rem] mt-4 bg-[#fff] text-[#242424] font-bold cursor-pointer hover:bg-[#f0f0f0]"
            disabled={isSubmitting}
            onClick={handleSubmit(onSubmit)}
          >
            {isSubmitting ? "Updating Password..." : "Reset Password"}
          </button>
          {apiError && (
            <p className="text-red-400 text-[0.75rem] mt-3 text-center">
              {apiError}
            </p>
          )}
        </div>
        <div className="mt-5 text-[.8rem] flex flex-row w-full">
          <div className="w-[50%] text-left">
            <Link to="/" className="text-[#6da7ec] ml-1">
              Login
            </Link>
          </div>
          <div className="w-[50%] text-right">
            <Link to="/forget-password" className="text-[#6da7ec]">
              Back
            </Link>
          </div>
        </div>
      </div>)}
    </div>
  );
};

export default ResetPassword;
