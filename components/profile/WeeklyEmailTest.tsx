"use client";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { sendTestWeeklyEmailAction } from "@/lib/profile/actions";

/** Sends this week's summary now, so people can see what arrives on Sunday. */
export function WeeklyEmailTest() {
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const send = () => start(async () => {
    const res = await sendTestWeeklyEmailAction();
    setStatus(res.ok ? { ok: true, text: `Sent to ${res.to}. Check your inbox (and spam, the first time).` } : { ok: false, text: res.error });
  });
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button type="button" variant="secondary" disabled={pending} onClick={send}>
        {pending ? "Sending…" : "Send me this week's summary now"}
      </Button>
      {status && <p className={`text-sm ${status.ok ? "text-brand" : "text-danger"}`}>{status.text}</p>}
    </div>
  );
}
