"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAddTeacherHook } from "@/hooks/use-add-teacher";
import { Loader2, Lock, Mail, UserCircle, UserPlus } from "lucide-react";

export function AddTeacherDialog() {
  const { open, setOpen, loading, form, onSubmit } = useAddTeacherHook();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          suppressHydrationWarning={true}
          className="bg-blue-600 hover:bg-blue-500 text-white font-medium gap-2 shadow-lg shadow-blue-900/20 px-6 py-5 rounded-xl transition-all hover:scale-[1.02] active:scale-[0.98]"
        >
          <UserPlus className="h-4 w-4" /> Add Teacher
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px] bg-zinc-900/95 border-zinc-800 text-white backdrop-blur-xl rounded-2xl p-0 overflow-hidden shadow-2xl">
        <div className="absolute inset-0 bg-linear-to-br from-blue-500/5 via-transparent to-transparent pointer-events-none" />

        <DialogHeader className="p-8 pb-4">
          <DialogTitle className="text-2xl font-bold tracking-tight bg-linear-to-r from-blue-400 to-teal-400 bg-clip-text text-transparent">
            Add New Teacher
          </DialogTitle>
          <DialogDescription className="text-zinc-400 text-sm mt-2">
            Enter the teacher's information to create their account and access
            credentials.
          </DialogDescription>
        </DialogHeader>

        <div className="p-8 pt-2">
          <Form {...form}>
            <form onSubmit={onSubmit} className="space-y-5">
              <FormField
                control={form.control}
                name="fullName"
                render={({ field }) => (
                  <FormItem className="space-y-2">
                    <FormLabel className="text-zinc-300 flex items-center gap-2">
                      <UserCircle className="h-4 w-4 text-zinc-500" />
                      Full Name
                    </FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="Teacher's full name"
                        className="bg-zinc-950/50 border-zinc-800 focus:border-blue-500/50 focus:ring-blue-500/20 rounded-xl py-6 transition-all"
                      />
                    </FormControl>
                    <FormMessage className="text-red-400 text-xs" />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem className="space-y-2">
                    <FormLabel className="text-zinc-300 flex items-center gap-2">
                      <Mail className="h-4 w-4 text-zinc-500" />
                      Email Address
                    </FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="email"
                        placeholder="teacher@school.edu"
                        className="bg-zinc-950/50 border-zinc-800 focus:border-blue-500/50 focus:ring-blue-500/20 rounded-xl py-6 transition-all font-mono text-sm"
                      />
                    </FormControl>
                    <FormMessage className="text-red-400 text-xs" />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <FormField
                  control={form.control}
                  name="role"
                  render={({ field }) => (
                    <FormItem className="space-y-2">
                      <FormLabel className="text-zinc-300">Role</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger className="bg-zinc-950/50 border-zinc-800 focus:border-blue-500/50 py-6 rounded-xl transition-all">
                            <SelectValue placeholder="Select role" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="bg-zinc-900 border-zinc-800 text-white rounded-xl">
                          <SelectItem
                            value="teacher"
                            className="cursor-pointer focus:bg-zinc-800"
                          >
                            Teacher
                          </SelectItem>
                          <SelectItem
                            value="staff"
                            className="cursor-pointer focus:bg-zinc-800"
                          >
                            Staff
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage className="text-red-400 text-xs" />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem className="space-y-2">
                      <FormLabel className="text-zinc-300 flex items-center gap-2">
                        <Lock className="h-4 w-4 text-zinc-500" />
                        Password
                      </FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="password"
                          placeholder="••••••••"
                          className="bg-zinc-950/50 border-zinc-800 focus:border-blue-500/50 focus:ring-blue-500/20 rounded-xl py-6 transition-all"
                        />
                      </FormControl>
                      <FormMessage className="text-red-400 text-xs" />
                    </FormItem>
                  )}
                />
              </div>

              <DialogFooter className="pt-6 sm:pt-4">
                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-6 rounded-xl shadow-lg shadow-blue-500/20 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 gap-2"
                >
                  {loading ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <>
                      <UserPlus className="h-5 w-5 mr-1" />
                      Create Account
                    </>
                  )}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
