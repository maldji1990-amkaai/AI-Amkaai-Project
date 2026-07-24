export default function ContactPage() {
  return (
    <main className="max-w-4xl mx-auto px-6 py-12">
      <h1 className="text-4xl font-bold mb-6">Contact Us</h1>

      <p className="mb-6">
        We'd love to hear from you. If you have any questions about our
        services, subscriptions, billing, or technical support, please contact
        us using the information below.
      </p>

      <div className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold">Email</h2>
          <p>contact@amkaai.net</p>
        </div>

        <div>
          <h2 className="text-xl font-semibold">Website</h2>
          <p>https://www.amkaai.net</p>
        </div>

        <div>
          <h2 className="text-xl font-semibold">Support</h2>
          <p>We usually respond within 24–48 hours.</p>
        </div>
      </div>

      <p className="mt-10 text-gray-500">
        © 2026 AMKAAI. All rights reserved.
      </p>
    </main>
  );
}