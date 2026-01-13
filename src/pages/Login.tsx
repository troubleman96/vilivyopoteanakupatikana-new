import { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Shield, Mail, Lock, AlertCircle, Eye, EyeOff } from 'lucide-react';

export default function Login() {
  const navigate = useNavigate();
  const { login, isAuthenticated, validateEmail } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleEmailChange = (value: string) => {
    setEmail(value);
    setError('');

    if (value && value.includes('@')) {
      const validation = validateEmail(value);
      setEmailError(validation.valid ? '' : validation.error || '');
    } else {
      setEmailError('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, 800));

    const result = login(email, password);

    if (result.success) {
      navigate('/dashboard');
    } else {
      setError(result.error || 'Login failed');
    }

    setIsLoading(false);
  };

  return (
    <div className="min-h-screen flex">
      {/* Left Panel - Form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-background">
        <div className="w-full max-w-md space-y-8 animate-fade-in">
          {/* Logo */}
          <div className="text-center">
            <div className="inline-flex items-center justify-center mb-4">
              <img
                src="/vilivyopoteanakupatikana_favicon/web-app-manifest-192x192.png"
                alt="TZ UniFind Logo"
                className="h-16 w-16 rounded-2xl shadow-lg border-2 border-primary/10"
              />
            </div>
            <h1 className="text-3xl font-display font-bold text-foreground">
              TZ UniFind
            </h1>
            <p className="mt-2 text-muted-foreground">
              University Lost & Found Control System
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <Alert variant="destructive" className="animate-slide-up">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="admin@university.ac.tz"
                    value={email}
                    onChange={(e) => handleEmailChange(e.target.value)}
                    className="pl-10"
                    required
                  />
                </div>
                {emailError && (
                  <p className="text-sm text-destructive flex items-start gap-1.5">
                    <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    {emailError}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10 pr-10"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>
            </div>

            <Button
              type="submit"
              className="w-full h-12 text-base font-semibold"
              disabled={isLoading || !!emailError}
            >
              {isLoading ? 'Signing in...' : 'Sign In'}
            </Button>
          </form>

          {/* Demo Credentials */}
          <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
            <p className="text-sm font-medium text-foreground">Demo Credentials:</p>
            <div className="space-y-2 text-sm text-muted-foreground">
              <p><span className="font-medium">Super Admin:</span> superadmin@system.ac.tz</p>
              <p><span className="font-medium">Uni Admin:</span> admin@udsm.ac.tz</p>
              <p><span className="font-medium">Security:</span> security@udsm.ac.tz</p>
              <p className="text-xs">Password: <span className="font-mono">admin123</span> or <span className="font-mono">password123</span></p>
            </div>
          </div>

          {/* Footer */}
          <p className="text-center text-sm text-muted-foreground">
            Only authorized university personnel can access this system.
          </p>
        </div>
      </div>

      {/* Right Panel - Branding */}
      <div className="hidden lg:flex lg:flex-1 items-center justify-center p-12 bg-gradient-to-br from-primary via-primary-dark to-secondary">
        <div className="max-w-lg text-center space-y-8">
          <div className="space-y-4">
            <h2 className="text-4xl font-display font-bold text-primary-foreground">
              Tanzania University Lost & Found Control Center
            </h2>
            <p className="text-lg text-primary-foreground/80">
              A centralized platform for university administrators and security personnel to manage, verify, and connect lost item owners with finders.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 text-left">
            {[
              { title: 'Secure Access', desc: 'University email verification' },
              { title: 'Role-Based', desc: 'Admin, Security & Staff' },
              { title: 'Audit Trail', desc: 'Complete activity logs' },
              { title: 'Multi-Campus', desc: 'All Tanzania universities' },
            ].map((feature) => (
              <div key={feature.title} className="p-4 rounded-xl bg-white/10 backdrop-blur-sm">
                <h3 className="font-semibold text-primary-foreground">{feature.title}</h3>
                <p className="text-sm text-primary-foreground/70">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
