import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Lock, Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { api } from "@/lib/api";

export default function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    const isAllowed = sessionStorage.getItem('resetAllowed');
    if (!isAllowed) {
      navigate('/forgot-password');
    }
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      return toast.error("Passwords do not match");
    }
    
    const email = sessionStorage.getItem('resetEmail');
    const code = sessionStorage.getItem('resetCode');

    if (!email || !code) {
      toast.error("Session expired. Please try again.");
      return navigate('/forgot-password');
    }

    setLoading(true);
    try {
      await api.post('/auth/reset-password', {
        email,
        code,
        newPassword: password
      });
      
      setSubmitted(true);
      sessionStorage.removeItem('resetAllowed');
      sessionStorage.removeItem('resetEmail');
      sessionStorage.removeItem('resetCode');
      setTimeout(() => navigate("/login"), 3000);
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to reset password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-80px)] flex items-center justify-center px-4 py-12 relative overflow-hidden">
      <div className="absolute inset-0 grid-pattern opacity-30" />
      
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative w-full max-w-md space-y-8 rounded-3xl border border-border/60 bg-surface/80 p-8 backdrop-blur-xl shadow-2xl"
      >
        {!submitted ? (
          <>
            <div className="text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Lock className="h-8 w-8" />
              </div>
              <h2 className="mt-6 font-display text-3xl font-bold tracking-tight text-foreground">
                Set New Password
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Create a strong password for your SafeCampus account.
              </p>
            </div>

            <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
              <div className="space-y-4">
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="New password"
                    className="w-full rounded-xl border border-border bg-background/50 py-3 pl-10 pr-4 text-sm transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm new password"
                    className="w-full rounded-xl border border-border bg-background/50 py-3 pl-10 pr-4 text-sm transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              </div>

              <Button type="submit" variant="hero" className="w-full py-6 text-base" disabled={loading}>
                {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Update Password"}
              </Button>
            </form>
          </>
        ) : (
          <div className="text-center py-4">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
              <CheckCircle2 className="h-10 w-10" />
            </div>
            <h2 className="mt-6 font-display text-2xl font-bold">Password Updated</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Your password has been reset successfully. Redirecting you to login...
            </p>
          </div>
        )}
      </motion.div>
    </div>
  );
}
