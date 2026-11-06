import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PLATFORMS, detectProfile, getPlatform } from "@/lib/platforms";
import { useCreateAccount } from "@/lib/queries";
import { useUI } from "@/lib/store";
import { PlatformDot } from "./bits";

/** Short form: paste a link or @handle, platform is detected automatically. */
export function AddProfileDialog() {
  const { addProfile, setAddProfile, openAccount } = useUI();
  const create = useCreateAccount();
  const [link, setLink] = useState("");
  const [name, setName] = useState("");
  const [platform, setPlatform] = useState("youtube");
  const [manual, setManual] = useState(false);

  useEffect(() => {
    if (addProfile) {
      setLink(""); setName(""); setManual(!!addProfile.platform);
      setPlatform(addProfile.platform ?? "youtube");
    }
  }, [addProfile]);

  const detected = detectProfile(link);
  useEffect(() => {
    if (!manual && detected.platform) setPlatform(detected.platform);
  }, [detected.platform, manual]);

  const submit = async () => {
    const p = getPlatform(platform);
    const handle = detected.handle;
    const url = detected.url ?? (handle && p.profileUrl ? p.profileUrl(handle.slice(1)) : null);
    const a = await create.mutateAsync({
      platform: p.id,
      name: name.trim() || handle || `${p.label} account`,
      handle,
      url,
    });
    setAddProfile(null);
    openAccount(a.id);
  };

  return (
    <Dialog open={!!addProfile} onOpenChange={(o) => !o && setAddProfile(null)}>
      <DialogContent className="sm:max-w-md">
        <DialogTitle>Add profile</DialogTitle>
        <DialogDescription>Paste a profile link or @handle. We'll figure out the platform.</DialogDescription>
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); submit(); }}>
          <Input autoFocus placeholder="youtube.com/@yourchannel or @handle" value={link} onChange={(e) => setLink(e.target.value)} />
          {link && (
            <p className="text-xs text-muted-foreground">
              {detected.platform && detected.platform !== "other"
                ? <>Looks like a <b className="text-foreground">{getPlatform(detected.platform).label}</b> profile{detected.handle && <> · {detected.handle}</>}</>
                : "Couldn't tell the platform — pick it below."}
            </p>
          )}
          <Select value={platform} onValueChange={(v) => { setPlatform(v); setManual(true); }}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {PLATFORMS.map((p) => (
                <SelectItem key={p.id} value={p.id}><span className="flex items-center gap-2"><PlatformDot platform={p.id} />{p.label}</span></SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input placeholder="Display name (optional)" value={name} onChange={(e) => setName(e.target.value)} />
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" onClick={() => setAddProfile(null)}>Cancel</Button>
            <Button type="submit" disabled={create.isPending}>Add profile</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
