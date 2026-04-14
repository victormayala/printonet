import MarketingLayout from "@/components/MarketingLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Mail, MessageSquare, Send } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

export default function Contact() {
  const { toast } = useToast();
  const [sending, setSending] = useState(false);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSending(true);
    setTimeout(() => {
      toast({ title: "Message sent!", description: "We'll get back to you within 24 hours." });
      setSending(false);
      (e.target as HTMLFormElement).reset();
    }, 1000);
  };

  return (
    <MarketingLayout>
      <section className="py-28 md:py-36">
        <div className="container">
          <div className="text-center max-w-3xl mx-auto mb-20">
            <h1 className="font-display text-5xl md:text-[4.5rem] font-bold tracking-tight leading-[1.05]">
              Get in touch.
            </h1>
            <p className="mt-8 text-lg md:text-xl text-muted-foreground leading-relaxed">
              Have a question, need a custom integration, or want to discuss enterprise pricing? We'd love to hear from you.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-12 max-w-4xl mx-auto">
            <div className="space-y-8">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted text-foreground shrink-0">
                  <Mail className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-display font-semibold mb-1">Email</h3>
                  <p className="text-sm text-muted-foreground">support@customizerstudio.com</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted text-foreground shrink-0">
                  <MessageSquare className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-display font-semibold mb-1">Response Time</h3>
                  <p className="text-sm text-muted-foreground">We typically respond within 24 hours on business days.</p>
                </div>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="rounded-2xl border p-8 space-y-5">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input id="name" placeholder="Your name" required className="h-11 rounded-xl" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" placeholder="you@example.com" required className="h-11 rounded-xl" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="message">Message</Label>
                <Textarea id="message" placeholder="Tell us how we can help…" rows={5} required className="rounded-xl" />
              </div>
              <Button type="submit" className="w-full rounded-full h-12 font-semibold bg-foreground text-background hover:bg-foreground/90 gap-2" disabled={sending}>
                <Send className="h-4 w-4" /> {sending ? "Sending…" : "Send Message"}
              </Button>
            </form>
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
}
