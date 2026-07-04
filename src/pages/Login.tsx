import { Navigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/Button";

const appleSignInEnabled = import.meta.env.VITE_ENABLE_APPLE_SIGNIN === "true";

export function Login() {
  const { user, loading, signInWithGoogle, signInWithApple } = useAuth();

  if (!loading && user) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="motion-page min-h-dvh bg-bg flex flex-col items-center justify-center px-6 gap-10">
      <div className="text-[28px] font-extrabold tracking-tight text-ink">
        bonado<span className="text-teal">.</span>
      </div>

      <div className="w-full max-w-[340px] flex flex-col items-center gap-6 text-center">
        <p className="text-secondary text-[14.5px] leading-relaxed">
          Split shared trip expenses with friends — track who paid, who owes,
          and settle up.
        </p>

        <div className="flex w-full flex-col gap-3">
          <Button
            variant="outline"
            fullWidth
            className="!border-[var(--color-faint-2)] !text-ink flex items-center justify-center gap-2"
            onClick={() => void signInWithGoogle()}
          >
            <span className="text-base">Ⓖ</span> Continue with Google
          </Button>
          {appleSignInEnabled && (
            <Button
              variant="outline"
              fullWidth
              className="!border-[var(--color-faint-2)] !text-ink flex items-center justify-center gap-2"
              onClick={() => void signInWithApple()}
            >
              <span className="text-base"></span> Continue with Apple
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
