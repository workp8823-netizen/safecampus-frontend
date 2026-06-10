import { Component, type ErrorInfo, type ReactNode } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, RotateCcw, Copy, Check, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "./ui/button";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  copied: boolean;
  showDetails: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
    copied: false,
    showDetails: false,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null, copied: false, showDetails: false };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ error, errorInfo });
    console.error("Uncaught error:", error, errorInfo);
  }

  private handleCopy = () => {
    const errorText = `
Error: ${this.state.error?.message}
Stack Trace: ${this.state.error?.stack}
Component Stack: ${this.state.errorInfo?.componentStack}
    `.trim();

    navigator.clipboard.writeText(errorText);
    this.setState({ copied: true });
    setTimeout(() => this.setState({ copied: false }), 2000);
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen w-full flex items-center justify-center bg-background p-6">
          <div className="absolute inset-0 grid-pattern opacity-20" />
          
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative w-full max-w-2xl rounded-3xl border border-destructive/20 bg-surface/50 glass-strong p-8 shadow-2xl overflow-hidden"
          >
            <div className="absolute top-0 left-0 w-full h-1 bg-destructive" />
            
            <div className="flex flex-col items-center text-center space-y-6">
              <div className="h-16 w-16 rounded-2xl bg-destructive/10 flex items-center justify-center text-destructive ring-1 ring-destructive/20">
                <AlertTriangle className="h-10 w-10" />
              </div>
              
              <div className="space-y-2">
                <h1 className="text-3xl font-bold font-display tracking-tight">System Encountered a Glitch</h1>
                <p className="text-muted-foreground text-sm max-w-md mx-auto">
                  Something went wrong in the application. Our security systems have isolated the issue to prevent data loss.
                </p>
              </div>

              <div className="flex gap-4 w-full sm:w-auto">
                <Button 
                  className="flex-1 sm:flex-none py-6 px-8 rounded-xl"
                  variant="hero"
                  onClick={() => window.location.reload()}
                >
                  <RotateCcw className="mr-2 h-4 w-4" /> Restart Session
                </Button>
                
                <Button 
                  variant="outline"
                  className="flex-1 sm:flex-none py-6 px-8 rounded-xl border-dashed"
                  onClick={this.handleCopy}
                >
                  {this.state.copied ? (
                    <><Check className="mr-2 h-4 w-4 text-primary" /> Copied!</>
                  ) : (
                    <><Copy className="mr-2 h-4 w-4" /> Copy Debug Info</>
                  )}
                </Button>
              </div>

              {/* Dev Mode Details */}
              <div className="w-full mt-8 pt-8 border-t border-border/40">
                <button 
                  onClick={() => this.setState({ showDetails: !this.state.showDetails })}
                  className="flex items-center gap-2 text-[10px] uppercase font-bold tracking-widest text-muted-foreground hover:text-foreground transition-colors mx-auto"
                >
                  {this.state.showDetails ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  {this.state.showDetails ? "Hide Technical Details" : "View Technical Details"}
                </button>

                {this.state.showDetails && (
                  <motion.div 
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    className="mt-4 text-left"
                  >
                    <div className="rounded-xl bg-background/50 border border-border/40 p-4 font-mono text-[11px] overflow-auto max-h-[300px] custom-scrollbar">
                      <div className="text-destructive font-bold mb-2">Error: {this.state.error?.message}</div>
                      <div className="text-muted-foreground whitespace-pre-wrap opacity-80">
                        {this.state.error?.stack}
                        {"\n\n--- Component Stack ---\n"}
                        {this.state.errorInfo?.componentStack}
                      </div>
                    </div>
                  </motion.div>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      );
    }

    return this.props.children;
  }
}
