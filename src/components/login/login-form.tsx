'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertCircle, Loader2 } from 'lucide-react';

// Import Logic Baru (Local DB & Store)
import { login } from '@/lib/auth/service';
import { useStore } from '@/lib/store/use-store';

// --- SENSORY UTILS (Fitur Baru) ---
const triggerErrorHaptic = () => {
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    navigator.vibrate([100, 50, 100]); // Getar bzz-bzz
  }
};

const playSuccessSound = () => {
  const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
  if (AudioContext) {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    // Nada Futuristik Halus
    osc.type = 'sine';
    osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
    osc.frequency.exponentialRampToValueAtTime(659.25, ctx.currentTime + 0.1); // Slide ke E5
    
    gain.gain.setValueAtTime(0.05, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
    
    osc.start();
    osc.stop(ctx.currentTime + 0.2);
  }
};

export function LoginForm() {
  const router = useRouter();
  
  // Menggunakan Global Store untuk simpan sesi
  const setAuth = useStore((state) => state.login);
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  async function onSubmit(event: React.SyntheticEvent) {
    event.preventDefault();
    setIsLoading(true);
    setError('');

    const target = event.target as typeof event.target & {
      email: { value: string };
      password: { value: string };
    };

    const email = target.email.value;
    const password = target.password.value;

    try {
      // 1. Panggil Service Login (SQLite Local)
      const result = await login(email, password);

      // CUKUP CEK SUCCESS SAJA
      if (result.success) { 
        // ✅ SUKSES: TypeScript otomatis tahu di sini ada result.user
        playSuccessSound(); 
        setAuth(result.user); 
        router.push('/dashboard');
      } else {
        // ❌ GAGAL: TypeScript otomatis tahu di sini ada result.error
        triggerErrorHaptic(); 
        setError(result.error); // Error merah akan hilang di sini
        setIsLoading(false);
      }
    } catch (e) {
      triggerErrorHaptic();
      console.error('Login error:', e);
      setError('Terjadi kesalahan sistem');
      setIsLoading(false);
    }
  }

  return (
    <Card className="w-full max-w-sm bg-zinc-900/90 border-zinc-800 text-zinc-100 shadow-2xl backdrop-blur-xl">
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl font-bold text-center bg-gradient-to-r from-blue-400 to-teal-400 bg-clip-text text-transparent">
          Educore Access
        </CardTitle>
        <CardDescription className="text-center text-zinc-400">
          Local-First School System
        </CardDescription>
      </CardHeader>
      <form onSubmit={onSubmit}>
        <CardContent className="grid gap-4">
          {error && (
            <div className="p-3 rounded bg-red-900/30 border border-red-800 text-red-200 text-sm flex items-center gap-2 animate-pulse">
              <AlertCircle className="h-4 w-4" />
              {error}
            </div>
          )}

          <div className="grid gap-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="admin@educore.school"
              className="bg-zinc-950/50 border-zinc-700 focus-visible:ring-blue-500 transition-all"
              disabled={isLoading}
              required
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              placeholder="••••••••"
              className="bg-zinc-950/50 border-zinc-700 focus-visible:ring-blue-500 transition-all"
              disabled={isLoading}
              required
            />
          </div>
        </CardContent>
        <CardFooter className="pt-6">
          <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white transition-all active:scale-[0.98]" disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Verifying...
              </>
            ) : (
              'Masuk'
            )}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}