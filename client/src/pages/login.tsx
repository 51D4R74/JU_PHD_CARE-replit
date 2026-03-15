import { useState } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Eye, EyeSlash, Envelope, Lock, ArrowRight, Check, X, Sparkle, User, Buildings } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import AnimatedBrandLogo from "@/components/animated-brand-logo";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";

function PasswordCriteria({ label, met }: Readonly<{ label: string; met: boolean }>) {
  return (
    <div className="flex items-center gap-2 text-xs" data-testid={`criteria-${label}`}>
      {met ? (
        <Check className="w-3.5 h-3.5 text-brand-teal" />
      ) : (
        <X className="w-3.5 h-3.5 text-muted-foreground/50" />
      )}
      <span className={met ? "text-brand-teal" : "text-muted-foreground/60"}>{label}</span>
    </div>
  );
}

type ViewMode = "login" | "register" | "forgot";

const resetCodeSlots = [
  { key: "slot-0", index: 0 },
  { key: "slot-1", index: 1 },
  { key: "slot-2", index: 2 },
  { key: "slot-3", index: 3 },
  { key: "slot-4", index: 4 },
  { key: "slot-5", index: 5 },
] as const;

export default function LoginPage() {
  const [, navigate] = useLocation();
  const { setUser } = useAuth();
  const { toast } = useToast();
  const [view, setView] = useState<ViewMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [department, setDepartment] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [resetCode, setResetCode] = useState(["", "", "", "", "", ""]);

  const criteria = {
    length: password.length >= 8,
    upper: /[A-Z]/.test(password),
    lower: /[a-z]/.test(password),
    number: /\d/.test(password),
    special: /[^A-Za-z\d]/.test(password),
  };

  const allCriteriaMet = Object.values(criteria).every(Boolean);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) return;
    setIsLoading(true);
    try {
      const res = await apiRequest("POST", "/api/auth/login", { username: email, password });
      const user = await res.json();
      setUser(user);
      toast({ title: "Boas-vindas!", description: "Que bom ter você por aqui." });
      if (user.role === "rh") {
        navigate("/rh");
      } else {
        navigate("/dashboard");
      }
    } catch (error: unknown) {
      console.warn("Login failed:", error);
      toast({ title: "Algo deu errado", description: "Verifique seu email e senha.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password || !name) {
      toast({ title: "Atenção", description: "Preencha nome, email e senha.", variant: "destructive" });
      return;
    }
    if (!allCriteriaMet) {
      toast({ title: "Senha fraca", description: "A senha precisa atender todos os critérios de segurança.", variant: "destructive" });
      return;
    }
    setIsLoading(true);
    try {
      const res = await apiRequest("POST", "/api/auth/register", {
        username: email,
        password,
        name,
        department: department || null,
      });
      const user = await res.json();
      setUser(user);
      toast({ title: "Conta criada!", description: "Boas-vindas, " + user.name + "!" });
      navigate("/dashboard");
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : "";
      const msg = errMsg.includes("409") ? "Esse email já está cadastrado." : "Não conseguimos criar a conta. Tente de novo.";
      toast({ title: "Algo deu errado", description: msg, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }

  function handleCodeInput(index: number, value: string) {
    if (value.length > 1) value = value.at(-1) ?? value;
    const newCode = [...resetCode];
    newCode[index] = value;
    setResetCode(newCode);
    if (value && index < 5) {
      const next = document.getElementById(`code-${index + 1}`);
      next?.focus();
    }
  }

  function switchView(newView: ViewMode) {
    setView(newView);
    setEmail("");
    setPassword("");
    setName("");
    setDepartment("");
    setShowPassword(false);
  }

  return (
    <div className="min-h-screen gradient-sunrise flex items-center justify-center p-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-brand-gold/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[300px] bg-brand-teal/8 rounded-full blur-[100px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-md relative z-10"
      >
        <div className="text-center mb-8">
          <AnimatedBrandLogo className="mx-auto" />
        </div>

        <AnimatePresence mode="wait">
          {view === "login" && (
            <motion.div
              key="login"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.3 }}
              className="glass-card rounded-2xl p-8"
            >
              <div className="mb-6">
                <h2 className="text-xl font-semibold text-foreground">Como você está hoje?</h2>
              </div>

              <form onSubmit={handleLogin} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-sm text-muted-foreground">E-mail</Label>
                  <div className="relative">
                    <Envelope className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      autoComplete="email"
                      placeholder="seu@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-10 bg-background/50 border-border/50 focus:border-brand-navy/50 h-11"
                      data-testid="input-email"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password" className="text-sm text-muted-foreground">Senha</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="current-password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-10 pr-10 bg-background/50 border-border/50 focus:border-brand-navy/50 h-11"
                      data-testid="input-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      data-testid="button-toggle-password"
                    >
                      {showPassword ? <EyeSlash className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={isLoading || !email || !password}
                  className="w-full h-11 bg-brand-navy hover:bg-brand-navy-hover text-white font-medium rounded-xl border-0"
                  data-testid="button-login"
                >
                  {isLoading ? (
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                      className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full"
                    />
                  ) : (
                    <>
                      Entrar
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </>
                  )}
                </Button>
              </form>

              <div className="flex items-center justify-between mt-4">
                <button
                  onClick={() => switchView("forgot")}
                  className="text-sm text-muted-foreground hover:text-brand-navy transition-colors"
                  data-testid="link-forgot-password"
                >
                  Esqueci minha senha
                </button>
              </div>

              <div className="mt-6 pt-4 border-t border-border/30">
                <p className="text-sm text-center text-muted-foreground mb-3">Ainda não tem conta?</p>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => switchView("register")}
                  className="w-full h-11 rounded-xl border-brand-navy/30 text-brand-navy hover:bg-brand-navy/10 hover:text-brand-navy-hover"
                  data-testid="button-go-to-register"
                >
                  <User className="w-4 h-4 mr-2" />
                  Criar nova conta
                </Button>
              </div>
            </motion.div>
          )}

          {view === "register" && (
            <motion.div
              key="register"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
              className="glass-card rounded-2xl p-8"
            >
              <div className="flex items-center gap-2 mb-6">
                <Sparkle className="w-4 h-4 text-brand-gold" weight="fill" />
                <h2 className="text-lg font-semibold text-foreground">Criar sua conta</h2>
              </div>

              <form onSubmit={handleRegister} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="reg-name" className="text-sm text-muted-foreground">Nome completo</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="reg-name"
                      type="text"
                      autoComplete="name"
                      placeholder="Maria Silva"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="pl-10 bg-background/50 border-border/50 focus:border-brand-navy/50 h-11"
                      data-testid="input-reg-name"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="reg-email" className="text-sm text-muted-foreground">E-mail</Label>
                  <div className="relative">
                    <Envelope className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="reg-email"
                      type="email"
                      autoComplete="email"
                      placeholder="seu@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-10 bg-background/50 border-border/50 focus:border-brand-navy/50 h-11"
                      data-testid="input-reg-email"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="reg-department" className="text-sm text-muted-foreground">Departamento (opcional)</Label>
                  <div className="relative">
                    <Buildings className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="reg-department"
                      type="text"
                      placeholder="Ex: Marketing, TI, Vendas..."
                      value={department}
                      onChange={(e) => setDepartment(e.target.value)}
                      className="pl-10 bg-background/50 border-border/50 focus:border-brand-navy/50 h-11"
                      data-testid="input-reg-department"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="reg-password" className="text-sm text-muted-foreground">Senha</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="reg-password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="new-password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-10 pr-10 bg-background/50 border-border/50 focus:border-brand-navy/50 h-11"
                      data-testid="input-reg-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showPassword ? <EyeSlash className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {password.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    className="grid grid-cols-2 gap-1.5 p-3 rounded-lg bg-background/30"
                  >
                    <PasswordCriteria label="8+ caracteres" met={criteria.length} />
                    <PasswordCriteria label="Maiúscula" met={criteria.upper} />
                    <PasswordCriteria label="Minúscula" met={criteria.lower} />
                    <PasswordCriteria label="Número" met={criteria.number} />
                    <PasswordCriteria label="Especial (!@#)" met={criteria.special} />
                  </motion.div>
                )}

                <Button
                  type="submit"
                  disabled={isLoading || !email || !password || !name || !allCriteriaMet}
                  className="w-full h-11 bg-brand-navy hover:bg-brand-navy-hover text-white font-medium rounded-xl border-0"
                  data-testid="button-register"
                >
                  {isLoading ? (
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                      className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full"
                    />
                  ) : (
                    <>
                      Criar conta
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </>
                  )}
                </Button>
              </form>

              <div className="mt-5 pt-4 border-t border-border/30 text-center">
                <button
                  onClick={() => switchView("login")}
                  className="text-sm text-muted-foreground hover:text-brand-navy transition-colors"
                  data-testid="link-back-to-login"
                >
                  Já tem uma conta? <span className="text-brand-navy font-medium">Entrar</span>
                </button>
              </div>
            </motion.div>
          )}

          {view === "forgot" && (
            <motion.div
              key="forgot"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
              className="glass-card rounded-2xl p-8"
            >
              <h2 className="text-lg font-semibold mb-2">Recuperar senha</h2>
              <p className="text-sm text-muted-foreground mb-6">
                Digite o código de 6 dígitos enviado para o seu e-mail.
              </p>

              <div className="flex gap-2 justify-center mb-6">
                {resetCodeSlots.map((slot) => (
                  <Input
                    key={slot.key}
                    id={`code-${slot.index}`}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={resetCode[slot.index]}
                    onChange={(e) => handleCodeInput(slot.index, e.target.value)}
                    className="w-12 h-14 text-center text-xl font-bold bg-background/50 border-border/50 focus:border-brand-navy/50"
                    data-testid={`input-code-${slot.index}`}
                  />
                ))}
              </div>

              <Button
                onClick={() => {
                  toast({ title: "Código verificado!", description: "Sua senha foi redefinida (simulação)." });
                  switchView("login");
                  setResetCode(["", "", "", "", "", ""]);
                }}
                className="w-full h-11 bg-brand-navy hover:bg-brand-navy-hover text-white font-medium rounded-xl border-0"
                data-testid="button-verify-code"
              >
                Verificar código
              </Button>

              <button
                onClick={() => switchView("login")}
                className="w-full text-center mt-4 text-sm text-muted-foreground hover:text-foreground transition-colors"
                data-testid="link-back-from-forgot"
              >
                Voltar ao login
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
