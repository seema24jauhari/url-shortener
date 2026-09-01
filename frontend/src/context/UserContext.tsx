import { jwtDecode } from "jwt-decode";
import { createContext, useContext, useState, ReactNode, useEffect } from "react";
import axios, { setAccessToken } from "../api/axios";
import api from "../api/axios";

interface User {
  sub: string;
  email: string;
  name: string;
  avatarUrl: string | null;
}

interface UserContextType {
  user: User | null;
  setUser: (user: User | null) => void;
  updateUser: (updates: Partial<User>) => void  // add this
}

const UserContext = createContext<UserContextType | null>(null);


export const UserProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const silentRefresh = async () => {
      try {
        // refresh token is in httpOnly cookie — sent automatically
        const res = await api.post('/auth/refresh', {}, {
          withCredentials: true
        })
        const newToken = res.data.data.access_token
        setAccessToken(newToken)

        const decoded = jwtDecode<User>(newToken)
        setUser({
          ...decoded,
          name: localStorage.getItem('userName') || decoded.name,
          avatarUrl: localStorage.getItem('userAvatar') || decoded.avatarUrl || null
        })

      } catch (err) {
        // refresh failed — user not logged in
        setUser(null)
      } finally {
        setLoading(false)
      }
    }


    silentRefresh()
  }, [])
  
  // move inside component so it has access to setUser
  const updateUser = (updates: Partial<User>) => {
    setUser(prev => {
      if (!prev) return null
      const updated = { ...prev, ...updates }
      if (updates.name) localStorage.setItem('userName', updates.name)
      if (updates.avatarUrl) localStorage.setItem('userAvatar', updates.avatarUrl)
      return updated
    })
  }

  if (loading) return (
    <div className="flex items-center justify-center h-screen bg-[#0d0d0d]">
      <div className="w-6 h-6 border-2 border-[#6da7ec] border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <UserContext.Provider value={{ user, setUser, updateUser }}>
      {children}
    </UserContext.Provider>
  )
}

export const useUser = () => {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error("useUser must be inside UserProvider");
  return ctx;
};
