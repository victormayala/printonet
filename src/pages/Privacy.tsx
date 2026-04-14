import MarketingLayout from "@/components/MarketingLayout";

export default function Privacy() {
  return (
    <MarketingLayout>
      <section className="py-28 md:py-36">
        <div className="container">
          <div className="max-w-3xl mx-auto">
            <h1 className="font-display text-4xl md:text-5xl font-bold tracking-tight mb-4">
              Privacy Policy
            </h1>
            <p className="text-sm text-muted-foreground mb-16">Last updated: {new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</p>

            <div className="space-y-10 text-muted-foreground">
              <section>
                <h2 className="font-display text-xl font-semibold text-foreground mb-3">1. Information We Collect</h2>
                <p className="leading-relaxed">We collect information you provide directly to us, including your name, email address, store name, and payment information when you create an account or make a purchase. We also collect usage data such as pages visited, features used, and design sessions created.</p>
              </section>

              <section>
                <h2 className="font-display text-xl font-semibold text-foreground mb-3">2. How We Use Your Information</h2>
                <p className="leading-relaxed">We use the information we collect to provide, maintain, and improve our services; process transactions; send you technical notices and support messages; and respond to your comments and questions.</p>
              </section>

              <section>
                <h2 className="font-display text-xl font-semibold text-foreground mb-3">3. Data Storage & Security</h2>
                <p className="leading-relaxed">Your data is stored securely using industry-standard encryption. Design files and session data are stored in isolated cloud storage with row-level security policies ensuring only authorized users can access their own data.</p>
              </section>

              <section>
                <h2 className="font-display text-xl font-semibold text-foreground mb-3">4. Third-Party Services</h2>
                <p className="leading-relaxed">We use third-party services for payment processing (Stripe), analytics, and cloud infrastructure. These services have their own privacy policies governing the use of your information.</p>
              </section>

              <section>
                <h2 className="font-display text-xl font-semibold text-foreground mb-3">5. Your Rights</h2>
                <p className="leading-relaxed">You may access, update, or delete your account information at any time through your profile settings. You may also request a complete export of your data by contacting us at support@customizerstudio.com.</p>
              </section>

              <section>
                <h2 className="font-display text-xl font-semibold text-foreground mb-3">6. Contact</h2>
                <p className="leading-relaxed">If you have questions about this Privacy Policy, please contact us at support@customizerstudio.com.</p>
              </section>
            </div>
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
}
