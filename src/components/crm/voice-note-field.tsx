import { useEffect, useState } from "react";
import { Mic, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useSpeechToText } from "@/hooks/use-speech";
import { cn } from "@/lib/utils";

export function VoiceNoteField({
  value,
  onChange,
  label = "Voice note transcript",
}: {
  value: string;
  onChange: (v: string) => void;
  label?: string;
}) {
  const speech = useSpeechToText();
  const [active, setActive] = useState(false);

  useEffect(() => {
    if (active && speech.transcript) onChange(speech.transcript);
  }, [speech.transcript, active]);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>{label}</Label>
        <Button
          type="button"
          size="sm"
          variant={speech.recording ? "destructive" : "secondary"}
          onClick={() => {
            if (speech.recording) {
              speech.stop();
              setActive(false);
            } else {
              setActive(true);
              speech.start(value);
            }
          }}
          disabled={!speech.supported}
        >
          {speech.recording ? (
            <>
              <Square className="mr-1.5 size-3.5" /> Stop recording
            </>
          ) : (
            <>
              <Mic className="mr-1.5 size-3.5" /> Record voice note
            </>
          )}
        </Button>
      </div>
      <Textarea
        rows={4}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Speak or type the conversation summary…"
        className={cn(speech.recording && "ring-2 ring-destructive/40")}
      />
      {!speech.supported && (
        <p className="text-xs text-muted-foreground">
          Voice recognition isn&apos;t available in this browser — you can still type the note.
        </p>
      )}
      {speech.error && <p className="text-xs text-destructive">{speech.error}</p>}
      {speech.recording && (
        <p className="flex items-center gap-2 text-xs text-destructive">
          <span className="size-2 animate-pulse rounded-full bg-destructive" /> Listening…
        </p>
      )}
    </div>
  );
}
