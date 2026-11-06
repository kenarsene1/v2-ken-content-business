import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { LogOut } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel } from "@/components/ui/alert-dialog";

export function SignOutButton({ className, collapsed = false, size }: { className?: string; collapsed?: boolean; size?: "sm" }) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const navigate = useNavigate();
  const qc = useQueryClient();
  async function confirm() {
    setPending(true);
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      await qc.cancelQueries();
      qc.clear();
      setOpen(false);
      await navigate({ to: "/auth", replace: true });
    } catch {
      toast.error("Couldn't sign out. Please try again.");
    } finally {
      setPending(false);
    }
  }
  return <>
    <Button variant={size ? "outline" : "ghost"} size={size} title="Sign out" aria-label="Sign out" className={className} onClick={() => setOpen(true)}>
      <LogOut className="h-4 w-4" />{!collapsed && <span>Sign out</span>}
    </Button>
    <AlertDialog open={open} onOpenChange={(next) => { if (!pending) setOpen(next); }}>
      <AlertDialogContent>
        <AlertDialogHeader><AlertDialogTitle>Sign out?</AlertDialogTitle><AlertDialogDescription>Your saved work will be here when you return.</AlertDialogDescription></AlertDialogHeader>
        <AlertDialogFooter><AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel><Button disabled={pending} onClick={confirm}><LogOut />{pending ? "Signing out…" : "Sign out"}</Button></AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </>;
}