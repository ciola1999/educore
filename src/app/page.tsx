import { LoginForm } from '@/components/login/login-form';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center relative bg-zinc-950 overflow-hidden">
      
      {/* Background Effects (Grid & Glow) */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]"></div>
      <div className="absolute left-0 right-0 top-0 -z-10 m-auto h-[310px] w-[310px] rounded-full bg-blue-500 opacity-20 blur-[100px]"></div>
      
      {/* Content */}
      <div className="z-10 w-full flex flex-col items-center gap-8">
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-extrabold tracking-tight text-white lg:text-5xl">
            Educore
          </h1>
          <p className="text-zinc-400">Integrated School Management System</p>
        </div>

        <LoginForm />
        
        <p className="text-xs text-zinc-600 font-mono mt-8">
          v1.0.0 (Local-First Architecture)
        </p>
      </div>
    </main>
  );
}