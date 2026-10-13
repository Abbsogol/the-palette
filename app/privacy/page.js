import Link from 'next/link'
import styles from './privacy.module.css'

export const metadata = {
  title: 'Privacy Policy | LaQue',
  description: 'How LaQue handles account information, designs, messages, bookings, payments and your privacy choices.',
  alternates: { canonical: 'https://www.laque.app/privacy' },
  openGraph: {
    title: 'Privacy Policy | LaQue',
    description: 'Your information, your choices, and how to contact LaQue about privacy.',
    url: 'https://www.laque.app/privacy',
    type: 'website',
  },
}

const contents = [
  ['who-we-are', 'Who we are'],
  ['information', 'Information we handle'],
  ['purposes', 'How we use information'],
  ['visibility', 'Public and shared content'],
  ['providers', 'Service providers'],
  ['ai', 'Nail Lab and AI'],
  ['pinterest', 'Pinterest'],
  ['storage', 'Cookies and device storage'],
  ['retention', 'Retention and deletion'],
  ['rights', 'Your choices and rights'],
  ['transfers', 'International processing'],
  ['security', 'Security'],
  ['children', 'Children'],
  ['changes', 'Changes and contact'],
]

function Section({ id, title, children }) {
  return <section id={id} className={styles.section}><h2>{title}</h2>{children}</section>
}

export default function PrivacyPage() {
  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <header className={styles.header}>
          <Link href="/" className={styles.brand} aria-label="LaQue home">LaQue</Link>
          <a href="mailto:contact@laque.app">Contact us ↗</a>
        </header>
        <article>
          <div className={styles.intro}>
            <p className={styles.eyebrow}>YOUR INFORMATION & YOUR CHOICES</p>
            <h1>Privacy Policy</h1>
            <p className={styles.lead}>This policy explains what information LaQue handles, why we use it, and how you can exercise your privacy rights.</p>
            <p className={styles.updated}>Last updated: <time dateTime="2026-09-28">28 September 2026</time></p>
          </div>
          <aside className={styles.contact} aria-label="Privacy contact">
            <p><strong>WeActivate Project Management Services LLC</strong><br />Dubai, United Arab Emirates</p>
            <a href="mailto:contact@laque.app">contact@laque.app</a>
          </aside>
          <nav className={styles.contents} aria-label="Privacy policy contents">
            <h2>In this policy</h2>
            <ol>{contents.map(([id, title]) => <li key={id}><a href={`#${id}`}>{title}</a></li>)}</ol>
          </nav>

          <Section id="who-we-are" title="1. Who we are">
            <p>LaQue is operated by WeActivate Project Management Services LLC, based in Dubai, United Arab Emirates. We are responsible for the personal information we use to operate LaQue. This policy covers our website, mobile applications and related account, discovery, messaging and booking services.</p>
            <p>Some features are available only in particular versions or beta environments. Describing a feature here does not mean it is available to every user. Other websites, payment providers and independent nail artists or salons have their own privacy responsibilities.</p>
          </Section>

          <Section id="information" title="2. Information we handle">
            <ul>
              <li><strong>Account and profile information:</strong> email address, authentication records, account ID, username, display name, avatar, account type, and the phone number, biography, city or service location you choose to provide. If you use an available Apple or Google sign-in option, we receive the account details that provider shares with your permission.</li>
              <li><strong>Designs and activity:</strong> uploaded images, portfolio entries, stories, design descriptions and tags, preferences, saved designs, collections, follows, reviews and interactions needed to provide those features.</li>
              <li><strong>Communications and safety:</strong> messages and attachments you send, support requests, reports, block lists and the information needed to investigate misuse.</li>
              <li><strong>Bookings:</strong> customer and creator identifiers, selected services, prices, dates, time zones, availability, appointment status, notes, and payment or refund status.</li>
              <li><strong>Purchases:</strong> provider customer and transaction identifiers, credit balances, credit use, subscriptions, entitlements and purchase verification records. Payment providers collect payment details directly; LaQue does not receive your full card number or security code through hosted checkout.</li>
              <li><strong>Technical information:</strong> connection and request information, IP addresses in service or security logs, browser and device details, operational errors, and website usage information. If you enable mobile notifications, we use a device push token associated with your account.</li>
            </ul>
            <p>You can choose whether to supply optional profile fields, upload images or allow notifications. Some information is necessary for a feature: for example, we need an account to maintain your saves and the appointment details to arrange a booking.</p>
          </Section>

          <Section id="purposes" title="3. How we use information">
            <p>We use information to create and protect accounts; display and organise designs; personalise discovery using your preferences and activity; deliver messages; manage appointments; process purchases and refunds; generate designs you request; send account and appointment communications; respond to support requests; and detect errors, fraud and abuse.</p>
            <p>Where data-protection law requires a legal basis, we rely on the basis appropriate to the activity: performing our agreement with you for requested services; meeting legal obligations; your consent where required, including optional permissions; and legitimate interests in maintaining a reliable and secure service where that basis is recognised by applicable law.</p>
            <p>Design recommendations and filters help you find inspiration. They are not intended to make decisions about you with legal or similarly significant effects. We do not sell personal information or use it for cross-context behavioural advertising.</p>
          </Section>

          <Section id="visibility" title="4. Public and shared content">
            <p>Information you publish, such as public profile details, portfolio designs, stories and reviews, can be visible to other people. Account and content settings affect visibility within LaQue. Information that you send to another person, including messages, images and booking details, is shared with that recipient.</p>
            <p>Creators and salons receive the information needed to handle their bookings and communications. They are independently responsible for how they use information outside LaQue. Messages are not end-to-end encrypted; authorised support or safety access may be necessary to investigate a report or operate the service.</p>
            <p>Recipients can keep copies of material you share, and public material may be copied or indexed outside LaQue. Deleting content or changing a setting cannot remove copies already held by other people or independent services. Avoid including information in public posts that you do not want others to see.</p>
          </Section>

          <Section id="providers" title="5. Service providers">
            <p>We use providers to operate the features you choose. The information involved depends on the feature and the environment in which it is available.</p>
            <dl className={styles.providers}>
              <div><dt>Supabase</dt><dd>Account authentication, application database and file storage, including profile, content, messaging and booking records.</dd></div>
              <div><dt>Vercel</dt><dd>Website and API hosting, operational logs and website analytics.</dd></div>
              <div><dt>Resend</dt><dd>Delivery of account and service emails, using recipient addresses and the email content.</dd></div>
              <div><dt>OpenAI</dt><dd>Processing the text instructions and design preferences submitted to Nail Lab when generation is available.</dd></div>
              <div><dt>Stripe</dt><dd>Hosted web checkout, appointment deposits, payment verification and refunds. Stripe handles payment details and returns transaction information to LaQue.</dd></div>
              <div><dt>Expo, Apple and Google</dt><dd>Mobile app delivery and, where enabled, sign-in and push notifications, including device tokens and notification delivery information.</dd></div>
              <div><dt>Apple / Google billing and RevenueCat</dt><dd>When native purchases are enabled, store transaction information and a LaQue account identifier are used to verify purchases and maintain entitlements. These integrations may be unavailable during beta testing.</dd></div>
            </dl>
            <p>We may also disclose information when necessary to comply with law, respond to a valid legal request, protect people or the service, or support a business transfer subject to applicable protections. We limit provider and administrative access to the purposes for which it is needed.</p>
          </Section>

          <Section id="ai" title="6. Nail Lab and AI">
            <p>When you request a Nail Lab generation, your design instructions and selected preferences are sent to OpenAI to produce the result. LaQue stores generation settings, results and credit records to provide your history and recover interrupted requests. Avoid putting confidential information or someone else’s personal details in a prompt.</p>
            <p>Generated results are not automatically public merely because you generated them; publishing or sharing a result changes who can see it. AI providers also process requests under their own service terms and data policies. We do not promise that AI requests have zero provider retention.</p>
          </Section>

          <Section id="pinterest" title="7. Pinterest — planned integration">
            <p>A Pinterest inspiration integration is planned and is subject to Pinterest’s approval. It is not currently enabled. The intended feature would request public Pins using predefined nail-design keywords and let you filter the returned selection in LaQue. Pins would be labelled as coming from Pinterest and link to their original Pinterest pages.</p>
            <p>We would retrieve permitted Pinterest content on demand rather than copy it into a permanent LaQue catalogue. Pinterest Pins would not be used for Nail Lab generation or AI model training. We would not send your LaQue messages, bookings or payment details to Pinterest for this inspiration feature.</p>
            <p>If Pinterest-hosted content is loaded or you follow a Pinterest link, Pinterest may receive connection information from your device and process it under its <a href="https://policy.pinterest.com/en/privacy-policy">privacy policy</a>. Any future account connection would require a separate authorisation flow explaining the requested access. We will update this policy if the implemented data flow changes.</p>
          </Section>

          <Section id="storage" title="8. Cookies, analytics and device storage">
            <p>LaQue uses browser or device storage to keep you signed in and maintain application state and preferences. Mobile sessions use secure device storage where supported. Clearing storage or signing out can remove local state and require you to sign in again.</p>
            <p>The website includes Vercel Web Analytics for page usage, referral, browser, device and approximate-location statistics. This analytics service does not use third-party cookies. Hosting and security logs are separate from aggregated analytics and can include connection information.</p>
            <p>Some website fonts and media are delivered from external services, including Google Fonts. Loading them sends the connection information needed to deliver those resources. External websites you open from LaQue manage their own cookies and storage.</p>
          </Section>

          <Section id="retention" title="9. Retention and account deletion">
            <p>We keep account information and content for as long as needed to provide the service, support your account and complete the purposes described here. The appropriate period depends on the record, whether your account is active, outstanding bookings or payments, security needs, disputes and applicable record-keeping requirements. We do not apply one fixed retention period to every kind of information.</p>
            <p>You can request account deletion from the Profile screen or email <a href="mailto:contact@laque.app?subject=LaQue%20account%20deletion">contact@laque.app</a>. We may need to verify that you own the account. Subscription, purchase, booking, generation or refund activity can prevent immediate automatic deletion; contact us if the app cannot complete your request.</p>
            <p>Deletion removes applicable account records and uploaded files from active LaQue systems through our deletion process. Limited records may need to remain where required by law or to resolve outstanding matters. Backups and provider records follow their own retention cycles; payment providers may have independent legal duties to retain transaction records.</p>
            <p>Deleting an app from your phone does not delete your account or cancel a store subscription. Manage a subscription with the provider that billed you, and contact us for help with remaining account data.</p>
          </Section>

          <Section id="rights" title="10. Your choices and rights">
            <p>You can edit available profile fields, change the privacy and messaging settings offered in your account, delete content where supported, block users, and turn off push notifications through your device settings.</p>
            <p>Depending on the law that applies to you, you may have rights to access or obtain a copy of your information, correct it, request deletion, restrict processing, receive portable information, or withdraw consent. Withdrawing consent does not affect processing that was lawful before withdrawal.</p>
            <p><strong>You may also have the right to object to certain processing, including direct marketing.</strong> Send requests to <a href="mailto:contact@laque.app?subject=LaQue%20privacy%20request">contact@laque.app</a>. We may ask for information needed to verify your identity and will handle requests within applicable legal time limits. If we cannot fulfil a request, we will explain the reason where permitted.</p>
            <p>You may complain to the data-protection authority responsible for your jurisdiction. You can contact us first, but doing so does not remove any right to contact that authority directly.</p>
          </Section>

          <Section id="transfers" title="11. International processing">
            <p>LaQue is operated from the United Arab Emirates and uses international service providers. Information may be processed in countries other than where you live, including countries in which those providers operate. Privacy laws can differ between countries.</p>
            <p>International processing is subject to the protections required by applicable law and the relevant provider arrangements. Contact us for information about the locations and safeguards relevant to your data or to request details of applicable transfer arrangements.</p>
          </Section>

          <Section id="security" title="12. Security">
            <p>We use measures such as authenticated access, access controls, encrypted network connections and protected session storage to help secure information. No online service can guarantee absolute security. Keep your login details private and report suspected account misuse to us.</p>
          </Section>

          <Section id="children" title="13. Children">
            <p>LaQue is not directed at children under 13. We do not knowingly seek personal information from children under that age. If you believe a child has provided personal information, contact us so we can investigate and take appropriate action. Additional age or parental-consent requirements may apply where you live.</p>
          </Section>

          <Section id="changes" title="14. Changes and contact">
            <p>We may update this policy as LaQue changes. The date at the top identifies the latest version. Where required, we will provide additional notice or seek consent before a material change to how we use information.</p>
            <p>For privacy questions, requests or concerns, contact:<br /><strong>WeActivate Project Management Services LLC</strong><br />Dubai, United Arab Emirates<br /><a href="mailto:contact@laque.app">contact@laque.app</a></p>
          </Section>
        </article>
        <footer className={styles.footer}><Link href="/">← Back to LaQue</Link><a href="#">Back to top ↑</a></footer>
      </div>
    </div>
  )
}
