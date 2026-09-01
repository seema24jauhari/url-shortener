import { useEffect, useState } from "react";
import { ArrowLeft, UserCircle } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import api from "../api/axios";
import { useNavigate } from "react-router-dom";
import { useUser } from "../context/UserContext";

const schema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  avatar: z
    .instanceof(File)
    .refine((f) => f.size <= 2 * 1024 * 1024, "Max 2MB")
    .refine(
      (f) => ["image/jpeg", "image/png", "image/webp"].includes(f.type),
      "Only jpg, png, webp",
    )
    .optional(),
});

type ProfileForm = z.infer<typeof schema>;

interface User {
  sub: string
  email: string
  name: string
  avatarUrl?: string  // add this
}

const UpdateProfile = () => {
  const { user, updateUser } = useUser();
  const [apiError, setApiError] = useState("");
  const [success, setSuccess] = useState(false);
  const navigate = useNavigate();
  const [imagePreview, setImagePreview] = useState<string | null>(
    user?.avatarUrl || null,
  );

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<ProfileForm>({
    resolver: zodResolver(schema),
    defaultValues: { name: user?.name || "" },
  });

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setValue("avatar", file); // wire to RHF
    setImagePreview(URL.createObjectURL(file));
  };

  const onSubmit = async (data: ProfileForm) => {
    try {
      setApiError("");
      const formData = new FormData();
      formData.append("name", data.name);
      if (data.avatar) formData.append("avatar", data.avatar);

      const res = await api.patch("/users/profile", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      updateUser({
        name: res.data.data.name,
        avatarUrl: res.data.data.avatarUrl
      })
      setSuccess(true);
      setTimeout(() => navigate("/dashboard"), 2000);
    } catch (err: any) {
      setApiError(err.response?.data?.message || "Something went wrong");
    }
  };

  const initials = user?.name
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  useEffect(() => {
    const fetchProfile = async () => {
      const res = await api.get("/users/me");
      setImagePreview(res.data.data.avatarUrl || null);
      // update form values
      setValue("name", res.data.data.name);
    };
    fetchProfile();
  }, []);

  return (
    <div className="flex items-center justify-center h-screen bg-[#0d0d0d]">
      <div className="bg-[#1a1a19] rounded-xl p-8 w-[450px]">
        <button
          onClick={() => navigate("/dashboard")}
          className="flex items-center gap-2 text-[#888] hover:text-white text-[0.8rem] mb-6 cursor-pointer"
        >
          <ArrowLeft size={14} />
          Back to chat
        </button>
        <div className="flex flex-col items-center mb-6">
          <label
            htmlFor="avatar-upload"
            className="relative cursor-pointer group"
          >
            <div className="w-16 h-16 rounded-full bg-[#1d1649] text-[#a096eb] flex items-center justify-center text-xl font-bold mb-4 overflow-hidden">
              {imagePreview ? (
                <img
                  src={imagePreview}
                  alt="Avatar"
                  className="w-full h-full object-cover"
                />
              ) : (
                initials
              )}
            </div>
            <div className="absolute inset-0 mb-4 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <UserCircle size={20} className="text-white" />
            </div>
          </label>
          <input
            id="avatar-upload"
            type="file"
            accept="image/*"
            onChange={handleImageChange}
            className="hidden"
          />
          <div className="text-[1.3rem] text-white font-bold">Your Profile</div>
          <div className="text-[0.8rem] text-[#888]">
            Update your name and email
          </div>
        </div>

        {success ? (
          <div className="text-center text-green-400 text-[0.85rem] mt-4">
            Profile updated successfully! Redirecting...
          </div>
        ) : (
          <>
            <div className="mb-4">
              <div className="text-[0.8rem] text-left mb-1">Full Name</div>
              <input
                type="text"
                {...register("name")}
                className="w-full bg-[#2c2c2a] text-white text-[0.85rem] rounded-md px-3 py-2 border border-[#1f1f1e] focus:outline-none focus:border-[#6da7ec]"
              />
              {errors.name && (
                <p className="text-red-400 text-[0.75rem] mt-1">
                  {errors.name.message}
                </p>
              )}
            </div>

            <button
              onClick={handleSubmit(onSubmit)}
              disabled={isSubmitting}
              className="text-[0.9rem] w-full rounded-md p-[0.5rem] mt-4 bg-[#fff] text-[#242424] font-bold cursor-pointer hover:bg-[#f0f0f0] disabled:opacity-50"
            >
              {isSubmitting ? "Saving..." : "Save Changes"}
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default UpdateProfile;
