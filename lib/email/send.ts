import "server-only";
import nodemailer from "nodemailer";
import { serverEnv } from "@/lib/env";

export type Email = { to: string; subject: string; html: string; text: string };

let transport: nodemailer.Transporter | null = null;

/** Sends through Gmail with an app password. Swap this file to change provider; callers only see sendEmail. */
export async function sendEmail(email: Email) {
  transport ??= nodemailer.createTransport({
    service: "gmail",
    auth: { user: serverEnv.gmailUser(), pass: serverEnv.gmailAppPassword() },
  });
  await transport.sendMail({ from: `"Move & Nourish" <${serverEnv.gmailUser()}>`, ...email });
}
