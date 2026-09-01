import { MessageCircle } from "lucide-react";
import { useState } from "react";
import api from "../api/axios";
import z from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Link } from "react-router-dom";

const forgetPasswordSchema = z.object({
  email: z.string().email("Enter a valid email"),
});

type ForgetPasswordForm = z.infer<typeof forgetPasswordSchema>;

function ForgetPassword() {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgetPasswordForm>({
    resolver: zodResolver(forgetPasswordSchema),
  });

  const [apiError, setApiError] = useState("");
  const [sent, setSent] = useState(false);

  const onSubmit = async (data: ForgetPasswordForm) => {
    try {
      const res = await api.post("/auth/forget-password", data);
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
      const status = err.response?.status;
      const data = err.response?.data;

      if (status === 409) {
        setApiError("Email already exists");
      } else if (status === 400) {
        // Object.entries(data.errors).forEach(([field, message]) => {
        //   setError(field as keyof LoginForm, {
        //     message: message as string
        //   })
        // })
      } else {
        setApiError(data?.message || "Something went wrong");
      }
    }
  };

  return (
    <>
      <div className="flex flex-col items-center justify-center h-screen">
        {sent ? (
          <div className="mx-auto max-w-[1500] rounded-xl p-6 mx-auto min-h-[350px] w-[500px] bg-[#1a1a19] flex flex-col items-center justify-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#032042] flex items-center justify-center mx-auto">
              <MessageCircle className="w-5 h-5 text-[#6da7ec]" />
            </div>
            <div className="text-[1.3rem] text-[#fff] font-bold">
              Check your email
            </div>
            <div className="text-[0.8rem] text-center text-[#888]">
              Reset link sent to your email. Check your inbox and spam folder.
            </div>
          </div>
        ) : (
          <div className="mx-auto max-w-[1500] rounded-xl p-6 mx-auto min-h-[350px] w-[500px] bg-[#1a1a19]">
            <div>
              <div className="w-10 h-10 rounded-xl bg-[#032042] flex items-center justify-center mx-auto mb-4">
                <MessageCircle className="w-5 h-5 text-[#6da7ec]" />
              </div>
              <div className="text-[1.3rem] text-[#fff] font-bold mb-[0.1rem]">
                Forget Password
              </div>
              <div className="text-[0.8rem]">
                Enter your email to reset your password
              </div>
            </div>
            <div>
              <div>
                <div className="text-[0.8rem] text-left mt-4">Email</div>
                <input
                  {...register("email")}
                  type="text"
                  className="text-[0.9rem] w-full rounded-md p-[0.5rem] mt-1 focus:border-[#6da7ec] focus:outline-none focus:ring-0 bg-[#2c2c2a] border border-[#1f1f1e] text-[#fff]"
                  placeholder="abc@gmail.com"
                />
                {errors.email && (
                  <p className="text-red-400 text-[0.75rem] mt-1 text-right">
                    {errors.email.message}
                  </p>
                )}
              </div>
              <div>
                <button
                  onClick={handleSubmit(onSubmit)}
                  disabled={isSubmitting}
                  className="text-[0.9rem] w-full rounded-md p-[0.5rem] mt-4 bg-[#fff] text-[#242424] font-bold cursor-pointer hover:bg-[#f0f0f0]"
                >
                  {isSubmitting ? "Sending..." : "Send Reset Link"}
                </button>
                {apiError && (
                  <p className="text-red-400 text-[0.75rem] mt-3 text-center">
                    {apiError}
                  </p>
                )}
              </div>
              <div className="mt-5 text-[.8rem] flex flex-row w-full">
                <div className="w-[50%] text-left">
                  <Link to="/register" className="text-[#6da7ec]">
                    Sign up
                  </Link>
                </div>
                <div className="w-[50%] text-right">
                  <Link to="/" className="text-[#6da7ec] ml-1">
                    Login
                  </Link>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

export default ForgetPassword;
