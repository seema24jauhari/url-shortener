import { MessageCircle } from "lucide-react";
import { Link } from "react-router-dom";

function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center h-screen">
      <div className="mx-auto max-w-[1500] rounded-xl p-6 mx-auto min-h-[500px] w-[500px] bg-[#1a1a19] flex flex-col items-center justify-center text-center">
        <div className="w-10 h-10 rounded-xl bg-[#032042] flex items-center justify-center mb-4">
          <MessageCircle className="w-5 h-5 text-[#6da7ec]" />
        </div>

        <div className="text-[3rem] text-[#fff] font-bold leading-none mb-2">
          404
        </div>

        <div className="text-[1.1rem] text-[#fff] font-bold mb-1">
          Page not found
        </div>

        <div className="text-[0.8rem] text-gray-400 mb-6 max-w-[300px]">
          The page you're looking for doesn't exist or may have been moved.
        </div>

        <Link
          to="/chatroom"
          className="text-[0.9rem] w-full rounded-md p-[0.5rem] bg-[#fff] text-[#242424] font-bold text-center hover:bg-[#f0f0f0] transition"
        >
          Go back ChatRoom
        </Link>
      </div>
    </div>
  );
}

export default NotFound;