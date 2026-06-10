import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Mail, ArrowLeft, Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { api } from "@/lib/api";

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [loading, setLoading] = useState(false);

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/auth/forgot-password', { email });
      setStep('code');
      toast.success("Verification code sent to your email");
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to send reset code");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    // In this flow, we actually just store the code and email to use in the final reset call
    // But we could add a verification endpoint if we wanted. 
    // For now, let's just pass them to the next page.
    setTimeout(() => {
      sessionStorage.setItem('resetEmail', email);
      sessionStorage.setItem('resetCode', code);
      sessionStorage.setItem('resetAllowed', 'true');
      navigate("/reset-password");
      setLoading(false);
    }, 500);
  };

  return (
    <div className="min-h-[calc(100vh-80px)] flex items-center justify-center px-4 py-12 relative overflow-hidden">
      <div className="absolute inset-0 grid-pattern opacity-30" />
      
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative w-full max-w-md space-y-8 rounded-3xl border border-border/60 bg-surface/80 p-8 backdrop-blur-xl shadow-2xl"
      >
        <Link to="/" className="absolute left-8 top-8 flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors group">
          <ArrowLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-1" />
          Home
        </Link>
        <div className="text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            {step === 'email' ? <Mail className="h-8 w-8" /> : <ShieldCheck className="h-8 w-8" />}
          </div>
          <h2 className="mt-6 font-display text-3xl font-bold tracking-tight text-foreground">
            {step === 'email' ? 'Reset Password' : 'Verify Identity'}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {step === 'email' 
              ? "Enter your primary or recovery email and we'll send you a verification code." 
              : `Enter the 6-digit code sent to ${email}`}
          </p>
        </div>

        {step === 'email' ? (
          <form className="mt-8 space-y-6" onSubmit={handleSendCode}>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Primary or recovery email"
                className="w-full rounded-xl border border-border bg-background/50 py-3 pl-10 pr-4 text-sm transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>

            <Button type="submit" variant="hero" className="w-full py-6 text-base" disabled={loading}>
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Send Code"}
            </Button>
          </form>
        ) : (
          <form className="mt-8 space-y-6" onSubmit={handleVerifyCode}>
            <div className="relative">
              <ShieldCheck className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                required
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                placeholder="Enter 6-digit code"
                className="w-full rounded-xl border border-border bg-background/50 py-3 pl-10 pr-4 text-center text-lg font-bold tracking-[0.5em] transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>

            <Button type="submit" variant="hero" className="w-full py-6 text-base" disabled={loading || code.length < 6}>
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Verify Code"}
            </Button>
            
            <button 
              type="button" 
              onClick={() => setStep('email')}
              className="w-full text-xs text-muted-foreground hover:text-primary transition-colors"
            >
              Didn't receive a code? Edit email
            </button>
          </form>
        )}

        <div className="text-center mt-6">
          <Link to="/login" className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-primary transition-colors">
            <ArrowLeft className="h-4 w-4" /> Back to sign in
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
