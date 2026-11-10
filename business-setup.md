# Business setup: what is done, what you do, drafts for review

## Done in the website (v1.5.1)
- **Contact page** (`#/contact`): shows "Ask a question" and "Request a customization" mail buttons as soon as an address is set. Until then it says contact details are being set up and shows no mail link.
- **Privacy page** (`#/privacy`): what stays on the device, what the browser stores, visit counts, email, hosting.
- **Footer and menu** link to both. Wording elsewhere changed from "nothing is tracked / no server" to the accurate "nothing you load is uploaded / no server receives your project".
- **Security policy** now allows Cloudflare's visit counter (`static.cloudflareinsights.com` for scripts, `cloudflareinsights.com` for the counter's report). Nothing else was opened.

## What you do
1. **Turn on the visit counter:** Cloudflare dashboard, Workers & Pages, the `spashta` project, Metrics, Web Analytics, Enable. Cloudflare then adds the counter on the next deployment. (The Privacy page already says the counter is used, so turn it on when this version goes live.) Cloudflare's documentation says EU and UK visitors can be excluded from collection in the dashboard.
2. **Choose the contact address** and tell me. I put it in one line (`packages/web/src/site/config.ts`) and the buttons appear. A shared address on your own domain (for example hello@yourdomain) is better than a personal one, because it will be public and attract spam.
3. **Have a lawyer review** the drafts below and `LICENSE` before payments go live.

## Pages a payment provider such as Razorpay asks for
Terms and conditions, Privacy policy (done), Cancellation and refunds, Contact us (done once the address is set), Pricing details, Shipping / delivery policy. Providers' exact requirements change, so check the provider's current list when you apply.

The drafts below hold **[square brackets]** where only you can decide. They are drafts, not legal advice. They are not on the website yet because the price, the free period and the legal details are not decided.

---

## Draft: Pricing details
Spashta has a free version and a paid version ("Pro").
- **Free:** [list of free tabs].
- **Pro:** [list of Pro tabs]. Price: [amount] per [month / year], [inclusive / exclusive] of taxes.
- **Free trial:** [number] days of Pro, then the free version continues unless you subscribe.
- Prices are in [currency]. We may change prices; a change does not affect a period you have already paid for.

## Draft: Delivery policy (shipping)
Spashta is a web application. Nothing is shipped. After payment, access to Pro is activated [immediately / within [x] hours] for [the email address / licence key] you used. If access is not active within [x] hours, write to [contact email].

## Draft: Cancellation and refunds
- You can cancel at any time. [Pro stays active until the end of the period you paid for / the subscription does not renew.]
- Refunds: [for example: within [x] days of the first payment if you have not [condition]]. After that, payments are not refundable except where the law requires.
- To request a refund, write to [contact email] with the email used for payment. Approved refunds are returned to the original payment method within [x] working days (timing also depends on your bank).

## Draft: Terms and conditions
1. **Who we are.** Spashta is provided by [legal name of Vidyaai, registered address].
2. **What Spashta is.** A tool that calculates project-management measures from data you load. Results depend on the data and the settings you enter. It is a guide for your own judgement and is not professional, legal or financial advice.
3. **Your data.** Files you load are processed in your browser and are not sent to us. You are responsible for the data you load and for keeping your own backups.
4. **Licence.** We grant you a personal, non-exclusive, non-transferable right to use Spashta [for your own or your organisation's internal use]. You may not copy, resell, reverse engineer or build a competing product from it, except where the law allows.
5. **Payment.** [Pro fees, billing period, taxes, trial, renewal; handled through the payment provider.]
6. **Availability.** We aim to keep Spashta available but do not guarantee uninterrupted service. We may change or remove features, with notice for paid features where reasonable.
7. **Liability.** To the extent the law allows, [we are not liable for indirect or consequential loss, and our total liability is limited to the amount you paid in the last 12 months].
8. **Governing law.** [Laws of India; courts of [city]].
9. **Contact.** [contact email].
