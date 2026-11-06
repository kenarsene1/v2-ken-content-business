import { Trash2 } from "lucide-react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { useAccounts, useContent, useIdeas, useUpdateAccount, type Account } from "@/lib/queries";
import { ProfilePictureEditor } from './profile-picture-editor';
import { DeleteProfileDialog } from "./delete-profile-dialog";
import { useUI } from "@/lib/store";
import { PLATFORMS } from "@/lib/constants";
import { AutoInput, Field, PlatformDot } from "./bits";
import { AvatarInfoSection, OtherSocialsSection, SimilarCreatorsSection } from "./account-details";

export function AccountDrawer() {
  const { openAccountId, openAccount } = useUI();
  const { data: accounts } = useAccounts();
  const update = useUpdateAccount();
  const { data: content } = useContent();
  const { data: ideas } = useIdeas();
  const [deleting, setDeleting] = useState<Account | null>(null);
  const a = accounts?.find((x) => x.id === openAccountId);
  const save = (patch: Parameters<typeof update.mutate>[0]["patch"]) => a && update.mutate({ id: a.id, patch });

  return (
    <>
    <DeleteProfileDialog account={deleting} linked={deleting ? [...(content ?? []), ...(ideas ?? [])].filter((c) => c.account_id === deleting.id).length : 0} onClose={() => setDeleting(null)} />
    <Sheet open={!!openAccountId} onOpenChange={(o) => !o && openAccount(null)}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetTitle className="sr-only">{a?.name ?? "Account"}</SheetTitle>
        {a && (
          <div className="space-y-6 pb-10">
            <ProfilePictureEditor key={a.id} account={a} />
            <div className="pr-8">
              <AutoInput value={a.name} onSave={(name) => save({ name: name || "Untitled account" })} className="-ml-2 text-xl font-semibold" />
              <p className="text-xs text-muted-foreground">Changes save automatically</p>
            </div>
            <div className="space-y-1">
              <Field label="Platform">
                <Select value={a.platform} onValueChange={(platform) => save({ platform })}>
                  <SelectTrigger className="h-8 border-0 bg-transparent px-2 shadow-none hover:bg-muted/60"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PLATFORMS.map((p) => (
                      <SelectItem key={p.id} value={p.id}><span className="flex items-center gap-2"><PlatformDot platform={p.id} />{p.label}</span></SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Handle"><AutoInput value={a.handle} placeholder="@yourhandle" onSave={(handle) => save({ handle })} /></Field>
              <Field label="Link"><AutoInput value={a.url} placeholder="https://" onSave={(url) => save({ url })} /></Field>
              <Field label="Niche"><AutoInput value={a.niche} placeholder="What this account is about" onSave={(niche) => save({ niche })} /></Field>
              <Field label="Creation date"><AutoInput type="date" aria-label="Creation date" value={a.started_on} onSave={(v) => save({ started_on: v || null })} /></Field>
              <Field label="Followers">
                <AutoInput type="number" value={String(a.followers)} onSave={(v) => save({ followers: Number(v) || 0 })} />
              </Field>
              <Field label="Posting goal">
                <div className="flex items-center gap-1">
                  <AutoInput type="number" className="w-20" value={String(a.posting_goal_count)} onSave={(v) => save({ posting_goal_count: Number(v) || 0 })} />
                  <span className="text-sm text-muted-foreground">posts per</span>
                  <Select value={a.posting_goal_period} onValueChange={(posting_goal_period) => save({ posting_goal_period })}>
                    <SelectTrigger className="h-8 w-24 border-0 bg-transparent px-2 shadow-none hover:bg-muted/60"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="week">week</SelectItem>
                      <SelectItem value="month">month</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </Field>
              <Field label="Brand color">
                <div className="flex items-center gap-2 px-2">
                  <input type="color" value={a.brand_color} onChange={(e) => save({ brand_color: e.target.value })} className="h-7 w-10 cursor-pointer rounded border bg-transparent" />
                  <span className="font-mono text-xs text-muted-foreground">{a.brand_color}</span>
                </div>
              </Field>
            </div>
            <AvatarInfoSection account={a} save={save} />
            <SimilarCreatorsSection account={a} save={save} />
            <OtherSocialsSection account={a} save={save} />
            <section>
              <h3 className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Notes</h3>
              <AutoInput multiline value={a.notes} placeholder="Audience, tone, sponsors to avoid…" onSave={(notes) => save({ notes })} />
            </section>
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5 text-destructive hover:text-destructive"
              onClick={() => {
                openAccount(null);
                setDeleting(a);
              }}
            >
              <Trash2 className="h-4 w-4" /> Delete profile…
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
    </>
  );
}
