import { useState } from "react";
import { useDeleteProfile, useUpdateAccount, type Account } from "@/lib/queries";
import { Input } from "@/components/ui/input";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

/** Asks what happens to linked content; deleting content too requires typing the profile name. */
export function DeleteProfileDialog({ account, linked, onClose }: { account: Account | null; linked: number; onClose: () => void }) {
  const [mode, setMode] = useState<"unassign" | "delete">("unassign");
  const [confirm, setConfirm] = useState("");
  const del = useDeleteProfile();
  const update = useUpdateAccount();
  const needsTyping = mode === "delete" && linked > 0;
  const ok = !needsTyping || confirm.trim() === account?.name.trim();

  const close = () => {
    setMode("unassign");
    setConfirm("");
    onClose();
  };

  return (
    <AlertDialog open={!!account} onOpenChange={(o) => !o && close()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete “{account?.name}”?</AlertDialogTitle>
          <AlertDialogDescription>
            {linked > 0
              ? `${linked} content items and ideas are linked to this profile. Choose what happens to them.`
              : "No content is linked to this profile."}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {linked > 0 && (
          <div className="space-y-2">
            {([
              ["unassign", "Keep content and ideas", "Items stay in your workspace with no profile."],
              ["delete", "Delete content and ideas too", `All ${linked} items are removed permanently.`],
            ] as const).map(([id, title, hint]) => (
              <label key={id} className={cn("flex cursor-pointer gap-3 rounded-lg border p-3 text-sm", mode === id && "border-primary")}>
                <input type="radio" name="mode" checked={mode === id} onChange={() => setMode(id)} className="mt-0.5" />
                <span>
                  <span className="block font-medium">{title}</span>
                  <span className="text-xs text-muted-foreground">{hint}</span>
                </span>
              </label>
            ))}
            {needsTyping && (
              <div className="space-y-1 pt-1">
                <p className="text-xs text-muted-foreground">Type <b>{account?.name}</b> to confirm.</p>
                <Input value={confirm} onChange={(e) => setConfirm(e.target.value)} autoFocus />
              </div>
            )}
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          Tip: archiving hides the profile but keeps everything.{" "}
          <button
            className="underline"
            onClick={() => {
              if (account) update.mutate({ id: account.id, patch: { archived_at: new Date().toISOString() } });
              close();
            }}
          >
            Archive instead
          </button>
        </p>

        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={!ok}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={() => {
              if (account) del(account, mode);
              close();
            }}
          >
            Delete profile
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
