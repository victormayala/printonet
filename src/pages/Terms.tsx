import MarketingLayout from "@/components/MarketingLayout";

export default function Terms() {
  return (
    <MarketingLayout>
      <section className="py-24 md:py-32">
        <div className="container">
          <div className="max-w-3xl mx-auto">
            <h1 className="font-display text-4xl md:text-5xl font-bold tracking-tight mb-8">
              Terms & Conditions
            </h1>
            <p className="text-sm text-muted-foreground mb-12">Last updated: {new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</p>

            <div className="prose prose-neutral max-w-none space-y-8 text-muted-foreground">
              <section>
                <h2 className="font-display text-xl font-semibold text-foreground mb-3">1. Acceptance of Terms</h2>
                <p className="leading-relaxed">By accessing or using Customizer Studio, you agree to be bound by these Terms and Conditions. If you do not agree to these terms, you may not use our services.</p>
              </section>

              <section>
                <h2 className="font-display text-xl font-semibold text-foreground mb-3">2. Account Responsibilities</h2>
                <p className="leading-relaxed">You are responsible for maintaining the confidentiality of your account credentials. You agree to accept responsibility for all activities that occur under your account. You must notify us immediately of any unauthorized use.</p>
              </section>

              <section>
                <h2 className="font-display text-xl font-semibold text-foreground mb-3">3. Acceptable Use</h2>
                <p className="leading-relaxed">You agree not to use the service to upload or distribute content that is illegal, infringing, defamatory, or harmful. We reserve the right to remove content or suspend accounts that violate these terms.</p>
              </section>

              <section>
                <h2 className="font-display text-xl font-semibold text-foreground mb-3">4. Intellectual Property</h2>
                <p className="leading-relaxed">You retain ownership of all designs and content you create using our tools. Customizer Studio retains ownership of the platform, software, documentation, and related intellectual property.</p>
              </section>

              <section>
                <h2 className="font-display text-xl font-semibold text-foreground mb-3">5. Payment & Billing</h2>
                <p className="leading-relaxed">Paid plans are billed monthly or annually. You may cancel at any time, and your subscription will remain active until the end of the current billing period. Refunds are handled on a case-by-case basis.</p>
              </section>

              <section>
                <h2 className="font-display text-xl font-semibold text-foreground mb-3">6. Limitation of Liability</h2>
                <p className="leading-relaxed">Customizer Studio is provided "as is" without warranties of any kind. We shall not be liable for any indirect, incidental, or consequential damages arising from your use of the service.</p>
              </section>

              <section>
                <h2 className="font-display text-xl font-semibold text-foreground mb-3">7. Modifications</h2>
                <p className="leading-relaxed">We may update these terms from time to time. Continued use of the service after changes constitutes acceptance of the new terms. We will notify registered users of material changes via email.</p>
              </section>

              <section>
                <h2 className="font-display text-xl font-semibold text-foreground mb-3">8. Contact</h2>
                <p className="leading-relaxed">For questions about these Terms, contact us at support@customizerstudio.com.</p>
              </section>
            </div>
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
}
