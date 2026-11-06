import { useRef, useState } from "react";
import { ExternalLink, Loader2, Plus, Trash2, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { useUpdateAccount, type Account, type AccountPatch } from "@/lib/queries";
import { PLATFORMS } from "@/lib/constants";
import {
  addOtherSocial, addSimilarCreator, MAX_LIST, parseOtherSocials, parseSimilarCreators, removeById, socialHref, updateOtherSocial,
} from "@/lib/profile-details";
import { AutoInput, Field, PlatformDot } from "./bits";
import { ProfileAvatar } from "./profile-avatar";

type Save = (patch: AccountPatch) => void;
const heading = "mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground";
const BUCKET = "profile-pictures";

/** The avatar (persona) of a profile: its name, picture and identity, or no avatar at all. */
export function AvatarInfoSection({ account, save }: { account: Account; save: Save }) {
  const update = useUpdateAccount();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const on = account.avatar_enabled;

  const upload = async (file: File) => {
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 5 * 1024 * 1024) {
      toast.error("Choose a JPG, PNG, or WebP smaller than 5 MB.");
      return;
    }
    setBusy(true);
    try {
      const { data } = await supabase.auth.getUser();
      if (!data.user) throw new Error("Please sign in again.");
      const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
      const path = `${data.user.id}/${account.id}/avatar-${crypto.randomUUID()}.${ext}`;
      const result = await supabase.storage.from(BUCKET).upload(path, file);
      if (result.error) throw new Error(result.error.message);
      try {
        await update.mutateAsync({ id: account.id, patch: { avatar_image_path: path } });
      } catch (error) {
        await supabase.storage.from(BUCKET).remove([path]);
        throw error;
      }
      if (account.avatar_image_path) await supabase.storage.from(BUCKET).remove([account.avatar_image_path]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Picture upload failed.");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  };

  const removeImage = async () => {
    const old = account.avatar_image_path;
    if (!old) return;
    setBusy(true);
    try {
      await update.mutateAsync({ id: account.id, patch: { avatar_image_path: null } });
      await supabase.storage.from(BUCKET).remove([old]);
    } catch {
      /* The update already showed why. */
    } finally {
      setBusy(false);
    }
  };

  return (
    <section>
      <h3 className={heading}>Avatar info</h3>
      <div className="flex gap-1" role="group" aria-label="Avatar">
        {([[false, "No avatar"], [true, "Has an avatar"]] as const).map(([value, label]) => (
          <Button
            key={label}
            type="button"
            size="sm"
            variant={on === value ? "secondary" : "ghost"}
            aria-pressed={on === value}
            className="h-7 text-xs"
            onClick={() => on !== value && save({ avatar_enabled: value })}
          >
            {label}
          </Button>
        ))}
      </div>
      {on ? (
        <div className="mt-3 space-y-3">
          <div className="flex items-center gap-3">
            <ProfileAvatar account={{ name: account.avatar_name || account.name, avatar_path: account.avatar_image_path }} className="h-14 w-14 text-lg" />
            <div className="flex flex-wrap gap-1.5">
              <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => input.current?.click()}>
                {busy ? <Loader2 className="animate-spin" /> : <Upload />}Avatar image
              </Button>
              {account.avatar_image_path && (
                <Button type="button" size="icon" variant="ghost" className="h-8 w-8" disabled={busy} title="Remove avatar image" aria-label="Remove avatar image" onClick={() => void removeImage()}>
                  <Trash2 />
                </Button>
              )}
            </div>
            <input ref={input} type="file" className="hidden" aria-label="Upload avatar image" accept="image/jpeg,image/png,image/webp" onChange={(e) => { const file = e.target.files?.[0]; if (file) void upload(file); }} />
          </div>
          <Field label="Name"><AutoInput value={account.avatar_name} placeholder="The avatar's name" onSave={(v) => save({ avatar_name: v.trim().slice(0, 80) || null })} /></Field>
          <div>
            <p className="mb-1 text-xs text-muted-foreground">Identity</p>
            <AutoInput multiline aria-label="Avatar identity" value={account.avatar_identity} placeholder="Who the avatar is: background, personality, voice, style…" onSave={(v) => save({ avatar_identity: v.trim().slice(0, 2000) || null })} />
          </div>
        </div>
      ) : (
        <p className="mt-2 text-xs text-muted-foreground">This profile has no avatar. Your avatar details are kept if you switch back.</p>
      )}
    </section>
  );
}

/** Links to creators that are like this one. */
export function SimilarCreatorsSection({ account, save }: { account: Account; save: Save }) {
  const list = parseSimilarCreators(account.similar_creators);
  const [link, setLink] = useState("");
  const write = (next: ReturnType<typeof parseSimilarCreators>) => save({ similar_creators: next as unknown as Json });
  const add = () => {
    if (!link.trim()) return;
    const next = addSimilarCreator(list, link);
    if (!next) return void toast.error(list.length >= MAX_LIST ? `You can keep up to ${MAX_LIST} links.` : "Enter a valid link");
    write(next);
    setLink("");
  };
  return (
    <section>
      <h3 className={heading}>Similar creators</h3>
      {list.length > 0 && (
        <ul className="mb-1.5 space-y-px">
          {list.map((c) => (
            <li key={c.id} className="group flex items-center gap-2 rounded-md px-2 py-1 text-xs hover:bg-muted/60">
              <a href={c.url} target="_blank" rel="noopener noreferrer" className="min-w-0 flex-1 truncate hover:underline" title={c.url}>{c.label}</a>
              <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground" aria-hidden />
              <button type="button" aria-label={`Remove ${c.label}`} onClick={() => write(removeById(list, c.id))} className="text-muted-foreground hover:text-foreground">
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <Input
        aria-label="Add a similar creator link"
        value={link}
        placeholder="Paste a creator's link and press Enter"
        onChange={(e) => setLink(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
        className="h-8 text-xs"
      />
    </section>
  );
}

/** The same person or brand on other platforms. */
export function OtherSocialsSection({ account, save }: { account: Account; save: Save }) {
  const list = parseOtherSocials(account.other_socials);
  const write = (next: ReturnType<typeof parseOtherSocials>) => save({ other_socials: next as unknown as Json });
  const add = () => {
    // Suggest a platform that is neither this profile's own nor already listed.
    const used = new Set([account.platform, ...list.map((s) => s.platform)]);
    const next = addOtherSocial(list, PLATFORMS.find((p) => p.id !== "other" && !used.has(p.id))?.id ?? "other");
    if (!next) return void toast.error(`You can keep up to ${MAX_LIST} platforms.`);
    write(next);
  };
  return (
    <section>
      <h3 className={heading}>Other platforms</h3>
      {list.length > 0 && (
        <ul className="mb-1.5 space-y-1">
          {list.map((s) => {
            const href = socialHref(s.platform, s.handle);
            return (
              <li key={s.id} className="flex items-center gap-1">
                <Select value={s.platform} onValueChange={(platform) => write(updateOtherSocial(list, s.id, { platform }))}>
                  <SelectTrigger aria-label="Platform" className="h-8 w-32 shrink-0 border-0 bg-transparent px-2 text-xs shadow-none hover:bg-muted/60"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PLATFORMS.map((p) => <SelectItem key={p.id} value={p.id}><span className="flex items-center gap-2"><PlatformDot platform={p.id} />{p.label}</span></SelectItem>)}
                  </SelectContent>
                </Select>
                <div className="min-w-0 flex-1">
                  <AutoInput aria-label="Handle or link" value={s.handle} placeholder="@handle or link" className="py-1.5 text-xs" onSave={(handle) => write(updateOtherSocial(list, s.id, { handle }))} />
                </div>
                {href && (
                  <a href={href} target="_blank" rel="noopener noreferrer" className="p-1.5 text-muted-foreground hover:text-foreground" aria-label="Open profile">
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                )}
                <button type="button" aria-label="Remove platform" onClick={() => write(removeById(list, s.id))} className="p-1.5 text-muted-foreground hover:text-foreground">
                  <X className="h-3.5 w-3.5" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={add}><Plus className="h-3.5 w-3.5" />Add platform</Button>
    </section>
  );
}
