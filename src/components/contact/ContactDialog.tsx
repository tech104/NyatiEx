import { useState } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CheckCircle2, Loader2, Mail, MessageCircle, Phone } from "lucide-react";
import { SUPABASE_ANON_KEY, SUPABASE_FUNCTIONS_URL } from "@/integrations/supabase/client";

const contactSchema = z.object({
  name: z.string().trim().min(1, "Please enter your name").max(100, "Name must be under 100 characters"),
  email: z.string().trim().email("Enter a valid email address").max(255),
  subject: z.string().trim().max(150, "Subject must be under 150 characters"),
  message: z.string().trim().min(1, "Please enter a message").max(2000, "Message must be under 2000 characters"),
});

interface ContactDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ContactDialog({ open, onOpenChange }: ContactDialogProps) {
  const [form, setForm] = useState({ name: "", email: "", subject: "", message: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const reset = () => {
    setForm({ name: "", email: "", subject: "", message: "" });
    setErrors({});
    setSent(false);
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) setTimeout(reset, 200);
    onOpenChange(next);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = contactSchema.safeParse(form);
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        fieldErrors[issue.path[0] as string] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }

    setErrors({});
    setSubmitting(true);
    try {
      const res = await fetch(`${SUPABASE_FUNCTIONS_URL}/contact-message`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify(parsed.data),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.status !== "success") {
        throw new Error(data.error || "Could not send your message. Please try again.");
      }
      setSent(true);
    } catch (err) {
      setErrors({ form: (err as Error).message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        {sent ? (
          <div className="py-8 text-center space-y-4">
            <div className="mx-auto w-14 h-14 rounded-full bg-primary/15 flex items-center justify-center">
              <CheckCircle2 className="w-7 h-7 text-primary" />
            </div>
            <DialogTitle className="font-serif-display text-2xl">Message sent</DialogTitle>
            <DialogDescription className="text-base">
              Thanks for reaching out. Our team at info@nyatiex.com will get back to you shortly.
            </DialogDescription>
            <Button className="rounded-full px-6" onClick={() => handleOpenChange(false)}>
              Close
            </Button>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="font-serif-display text-2xl">Contact Us</DialogTitle>
              <DialogDescription>
                Send us a message and we&apos;ll reply to you by email.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="contact-name">Name</Label>
                  <Input
                    id="contact-name"
                    value={form.name}
                    maxLength={100}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="Your name"
                  />
                  {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contact-email">Email</Label>
                  <Input
                    id="contact-email"
                    type="email"
                    value={form.email}
                    maxLength={255}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="you@example.com"
                  />
                  {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="contact-subject">Subject (optional)</Label>
                <Input
                  id="contact-subject"
                  value={form.subject}
                  maxLength={150}
                  onChange={(e) => setForm({ ...form, subject: e.target.value })}
                  placeholder="How can we help?"
                />
                {errors.subject && <p className="text-xs text-destructive">{errors.subject}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="contact-message">Message</Label>
                <Textarea
                  id="contact-message"
                  value={form.message}
                  maxLength={2000}
                  rows={5}
                  onChange={(e) => setForm({ ...form, message: e.target.value })}
                  placeholder="Tell us a bit about what you need..."
                />
                {errors.message && <p className="text-xs text-destructive">{errors.message}</p>}
              </div>

              {errors.form && <p className="text-sm text-destructive">{errors.form}</p>}

              <Button type="submit" disabled={submitting} className="w-full rounded-full h-11 font-semibold">
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Sending...
                  </>
                ) : (
                  "Send message"
                )}
              </Button>
            </form>

            <div className="border-t border-border pt-4 flex flex-wrap gap-4 text-sm text-muted-foreground">
              <a href="mailto:info@nyatiex.com" className="flex items-center gap-2 hover:text-foreground">
                <Mail className="w-4 h-4" /> info@nyatiex.com
              </a>
              <a href="tel:+254746973276" className="flex items-center gap-2 hover:text-foreground">
                <Phone className="w-4 h-4" /> +254 746 973 276
              </a>
              <a
                href="https://wa.me/254746973276"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 hover:text-foreground"
              >
                <MessageCircle className="w-4 h-4" /> WhatsApp
              </a>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
