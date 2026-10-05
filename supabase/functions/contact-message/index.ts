import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const CONTACT_EMAIL = "info@nyatiex.com";
const RESEND_API_URL = "https://api.resend.com/emails";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => null) as
      | { name?: string; email?: string; subject?: string; message?: string }
      | null;

    const name = (body?.name ?? "").trim();
    const email = (body?.email ?? "").trim();
    const subject = (body?.subject ?? "").trim();
    const message = (body?.message ?? "").trim();

    const errors: string[] = [];
    if (!name || name.length > 100) errors.push("Name is required (max 100 characters)");
    if (!email || email.length > 255 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      errors.push("A valid email address is required");
    }
    if (subject.length > 150) errors.push("Subject must be under 150 characters");
    if (!message || message.length > 2000) errors.push("Message is required (max 2000 characters)");
    if (errors.length) return json({ status: "error", error: errors.join(", ") }, 400);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { error } = await supabase.from("contact_messages").insert({
      name,
      email,
      subject: subject || null,
      message,
      recipient: CONTACT_EMAIL,
    });

    if (error) {
      console.error("Failed to store contact message:", error.message);
      return json({ status: "error", error: "Could not save your message. Please try again." }, 500);
    }

    // Email delivery via the Resend API directly (works on any Supabase project —
    // only requires a real Resend API key stored as the RESEND_API_KEY secret).
    const escapeHtml = (s: string) =>
      s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

    let emailed = false;
    let emailError: string | null = null;
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      emailError = "RESEND_API_KEY is not configured";
      console.warn("Email delivery skipped:", emailError);
    } else {
      try {
        const resendRes = await fetch(RESEND_API_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${RESEND_API_KEY}`,
          },
          body: JSON.stringify({
            from: `Nyati Contact Form <${Deno.env.get("RESEND_FROM_EMAIL") ?? "noreply@nyatiex.com"}>`,
            to: [CONTACT_EMAIL],
            reply_to: email,
            subject: `New contact message${subject ? `: ${subject}` : ""} from ${name}`,
            html: `<p><strong>Name:</strong> ${escapeHtml(name)}</p><p><strong>Email:</strong> ${escapeHtml(email)}</p><p><strong>Subject:</strong> ${escapeHtml(subject || "-")}</p><p><strong>Message:</strong></p><p>${escapeHtml(message).replace(/\n/g, "<br/>")}</p>`,
          }),
        });
        if (!resendRes.ok) {
          emailError = `Resend API ${resendRes.status}: ${await resendRes.text()}`;
          console.error(emailError);
        } else {
          await resendRes.text();
          emailed = true;
        }
      } catch (e) {
        emailError = (e as Error).message;
        console.error("Email delivery failed:", emailError);
      }
    }

    if (!emailed) {
      return json(
        {
          status: "error",
          error: "Your message was saved, but the notification email could not be delivered.",
          ...(emailError ? { email_error: emailError } : {}),
        },
        502,
      );
    }

    return json({ status: "success", emailed: true });
  } catch (e) {
    console.error("contact-message error:", (e as Error).message);
    return json({ status: "error", error: "Unexpected error. Please try again." }, 500);
  }
});
