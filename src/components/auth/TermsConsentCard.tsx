import { useEffect, useRef, useState, type UIEvent } from "react"
import { Sheet } from "@/components/ui/Sheet"

type TermsConsentCardProps = {
  checked: boolean

  onCheckedChange: (checked: boolean) => void

  t: (tagalog: string, english: string) => string
}

type TermsSection = {
  title: [string, string]
  body: [string, string]
}

const termsSections: TermsSection[] = [
  {
    title: [
      "1. Pagtanggap at pagiging kwalipikado",
      "1. Acceptance and eligibility",
    ],

    body: [
      "Ang Bitinary ay pinamamahalaan ng APEX Tech. Sa paggawa ng account, sumasang-ayon ka sa mga tuntuning ito at sa Privacy Notice sa ibaba. Dapat tama ang impormasyong ibibigay mo at may awtoridad kang tanggapin ang mga tuntunin. Kung gumagawa ka ng account para sa negosyo, kinakatawan mo na awtorisado kang kumilos para rito.",

      "Bitinary is operated by APEX Tech. By creating an account, you agree to these Terms and the Privacy Notice below. You must provide accurate information and have authority to accept these Terms. If you create an account for a business, you represent that you are authorized to act for it.",
    ],
  },

  {
    title: ["2. Serbisyo ng Bitinary", "2. Bitinary services"],

    body: [
      "Nagbibigay ang Bitinary ng travel discovery, itinerary-planning, business profiles, posts, reviews, offers, at mga feature para humiling o mamahala ng reservation. Maaaring magbago o mawala ang mga feature. Hindi kapalit ng opisyal na travel, safety, health, o government advice ang impormasyon sa app.",

      "Bitinary provides travel discovery, itinerary planning, business profiles, posts, reviews, offers, and features to request or manage reservations. Features may change or become unavailable. Information in the app is not a substitute for official travel, safety, health, or government advice.",
    ],
  },

  {
    title: ["3. Mga account at seguridad", "3. Accounts and security"],

    body: [
      "Panatilihing kumpidensyal ang iyong sign-in method at abisuhan kami agad kung pinaghihinalaan mong may gumamit ng account mo nang walang pahintulot. Huwag magpanggap na ibang tao, gumawa ng mapanlinlang na account, o umiwas sa security controls. Maaari naming hingin ang impormasyong kailangan para mapanatili ang seguridad ng account.",

      "Keep your sign-in method secure and promptly notify us if you suspect unauthorized use of your account. Do not impersonate others, create deceptive accounts, or bypass security controls. We may request information reasonably needed to protect account security.",
    ],
  },

  {
    title: [
      "4. Mga biyahero at impormasyon sa biyahe",
      "4. Travelers and travel information",
    ],

    body: [
      "Ikaw ang magpapasya kung ligtas at angkop ang lugar, ruta, presyo, oras, accessibility, at alok. Maaaring magbago ang impormasyong ipinasa ng negosyo o third party. Kumpirmahin ang mahahalagang detalye direkta sa provider at sundin ang mga batas at safety advisory.",

      "You are responsible for deciding whether a place, route, price, schedule, accessibility information, or offer is safe and suitable. Business- or third-party-supplied information may change. Confirm important details directly with the provider and follow applicable laws and safety advisories.",
    ],
  },

  {
    title: [
      "5. Karagdagang tuntunin para sa negosyo",
      "5. Additional terms for businesses",
    ],

    body: [
      "Panatilihing tama at napapanahon ang listing, presyo, availability, permit, at contact details. Bago mag-commit ang customer, malinaw na ilahad ang identity ng negosyo, kabuuang presyo at fees, mahahalagang kondisyon, at naaangkop na refund o cancellation policy. Ikaw ang responsable sa iyong produkto o serbisyo, kaligtasan, advertising, buwis, permits, booking, at pagtupad sa pangakong ibinigay sa customer. Huwag mag-post ng pekeng review, mapanlinlang na claim, o hindi awtorisadong alok. Ang verification badge ay hindi garantiya ng Bitinary sa kalidad o legalidad ng negosyo.",

      "Keep listings, prices, availability, permits, and contact details accurate and current. Before a customer commits, clearly disclose the business identity, total price and fees, material terms, and applicable refund or cancellation policy. You are responsible for your products or services, safety, advertising, taxes, permits, bookings, and commitments to customers. Do not post fake reviews, deceptive claims, or unauthorized offers. A Bitinary verification badge is not a guarantee of business quality or legality.",
    ],
  },

  {
    title: [
      "6. Booking, pagbili, at mga third party",
      "6. Bookings, purchases, and third parties",
    ],

    body: [
      "Hindi tumatanggap o nagpoproseso ng bayad ang Bitinary para sa mga booking. Ang reservation request sa app ay hindi kumpirmadong booking hangga't hindi ito kinukumpirma ng negosyo. Direktang kausapin ang provider tungkol sa presyo, availability, payment, refund, cancellation, at service delivery. Hindi inaalis ng mga tuntuning ito ang anumang karapatan o obligasyong ipinag-uutos ng batas sa Bitinary, negosyo, o consumer.",

      "Bitinary does not accept or process payment for bookings. A reservation request in the app is not a confirmed booking until the business confirms it. Contact the provider directly about price, availability, payment, refunds, cancellations, and service delivery. These Terms do not remove any rights or duties that the law imposes on Bitinary, a business, or a consumer.",
    ],
  },

  {
    title: ["7. Nilalaman at asal", "7. Content and conduct"],

    body: [
      "Ikaw ang may pananagutan sa nilalamang ipinapasa mo. Panatilihin ang karapatan o pahintulot sa mga larawan, pangalan, review, at iba pang materyal. Binibigyan mo ang Bitinary ng hindi eksklusibong pahintulot na i-host, i-store, ipakita, at ipamahagi ang nilalaman mo lamang para patakbuhin, protektahan, at pagandahin ang serbisyo. Huwag mag-upload ng ilegal, mapanlinlang, mapanira, mapang-abuso, pribado ng iba, o lumalabag sa intellectual property na materyal. Maaari naming suriin, itago, alisin, o paghigpitan ang nilalaman kung kinakailangan para sa seguridad, patakaran, o batas.",

      "You are responsible for content you submit. Own or obtain permission for photos, names, reviews, and other material. You grant Bitinary a non-exclusive permission to host, store, display, and distribute your content only to operate, protect, and improve the service. Do not upload unlawful, deceptive, defamatory, abusive, private information about others, or intellectual-property-infringing material. We may review, preserve, remove, or restrict content when needed for safety, policy, or legal reasons.",
    ],
  },

  {
    title: [
      "8. Privacy at personal information",
      "8. Privacy and personal information",
    ],

    body: [
      "Alinsunod sa Republic Act No. 10173 (Data Privacy Act of 2012), pinoproseso namin ang impormasyong kailangan para gumawa at mag-secure ng account, magbigay ng app features, mag-personalize ng travel discovery, magpakita ng business content, tumugon sa request, at sumunod sa batas. Maaaring kabilang dito ang account at contact details, account role, preferences, content na ipinasa mo, at technical/security logs. Gagamitin lamang ang location kung pinili o pinahintulutan mo ang feature na nangangailangan nito; maaari mong bawiin ang device permission, bagaman may feature na hindi gagana.",

      "Under Republic Act No. 10173 (Data Privacy Act of 2012), we process information needed to create and secure accounts, provide app features, personalize travel discovery, display business content, respond to requests, and comply with law. This may include account and contact details, account role, preferences, submitted content, and technical/security logs. Location is used only when you choose or authorize a feature that needs it; you may revoke device permission, though some features may not work.",
    ],
  },

  {
    title: [
      "9. Pagbabahagi, pag-iingat, at mga karapatan sa data",
      "9. Data sharing, safeguards, and rights",
    ],

    body: [
      "Maaaring iproseso ng mga service provider na tumutulong sa authentication, hosting, database, maps, communications, at seguridad ang data para sa Bitinary, alinsunod sa naaangkop na safeguards. Itatago lamang ang personal information habang kailangan para sa mga layuning ipinaalam, lehitimong operasyon, at legal na obligasyon, at pagkatapos ay buburahin o ise-secure ayon sa batas. May karapatan kang malaman, humiling ng access o correction, tumutol o humiling ng blocking/erasure kung naaangkop, at maghain ng reklamo sa National Privacy Commission, alinsunod sa batas at mga limitasyon nito. Maaaring may hiwalay na pahintulot na hingin para sa processing na nangangailangan ng consent.",

      "Service providers supporting authentication, hosting, databases, maps, communications, and security may process data for Bitinary subject to applicable safeguards. Personal information is retained only as needed for stated purposes, legitimate operations, and legal duties, then deleted or secured as required by law. Subject to legal limits, you may ask to be informed, request access or correction, object or request blocking/erasure where applicable, and complain to the National Privacy Commission. Separate consent may be requested for processing that requires consent.",
    ],
  },

  {
    title: [
      "10. Intellectual property ng Bitinary",
      "10. Bitinary intellectual property",
    ],

    body: [
      "Pag-aari ng Bitinary o ng licensors nito ang app, branding, software, at mga materyal nito. Binibigyan ka ng limitadong, personal, hindi maililipat na pahintulot na gamitin ang app ayon sa mga tuntuning ito. Walang inililipat na pagmamay-ari sa iyo. Huwag kopyahin, baguhin, i-reverse engineer, o komersiyal na gamitin ang mga materyal maliban kung pinahihintulutan ng batas o may nakasulat na pahintulot.",

      "Bitinary or its licensors own the app, branding, software, and materials. We grant you a limited, personal, non-transferable permission to use the app under these Terms. No ownership transfers to you. Do not copy, modify, reverse engineer, or commercially use materials unless permitted by law or with written permission.",
    ],
  },

  {
    title: ["11. Pagsuspinde at pagtatapos", "11. Suspension and termination"],

    body: [
      "Maaari naming limitahan o suspindihin ang access kapag may makatwirang batayan ng panganib, paglabag, fraud, legal requirement, o pangangailangan para protektahan ang users o serbisyo. Kung maaari at ligtas gawin, magbibigay kami ng abiso at paraan para magtanong o umapela. Maaari mong ihinto ang paggamit at humiling na isara ang account; maaaring manatili ang ilang record kung hinihingi ng batas o kailangan para sa lehitimong claim at seguridad.",

      "We may limit or suspend access on reasonable grounds involving risk, breach, fraud, legal requirements, or protection of users or the service. Where practicable and safe, we will provide notice and a way to ask questions or appeal. You may stop using the service and request account closure; some records may remain where required by law or needed for legitimate claims and security.",
    ],
  },

  {
    title: [
      "12. Availability at pananagutan",
      "12. Availability and liability",
    ],

    body: [
      "Sisikapin naming panatilihing maaasahan at ligtas ang serbisyo ngunit maaaring magkaroon ng outage, error, o pagbabago. Walang nakasaad dito na nag-aalis ng pananagutang hindi maaaring limitahan o isuko sa ilalim ng batas, kabilang ang mandatory consumer rights, data privacy rights, o pananagutan para sa fraud o willful misconduct. Ang anumang limitasyon ay ilalapat lamang sa lawak na pinahihintulutan ng batas.",

      "We will use reasonable efforts to keep the service reliable and secure, but outages, errors, or changes may occur. Nothing here excludes liability that cannot lawfully be limited or waived, including mandatory consumer rights, data privacy rights, or liability for fraud or willful misconduct. Any limitation applies only to the extent permitted by law.",
    ],
  },

  {
    title: [
      "13. Pagbabago at batas na umiiral",
      "13. Changes and governing law",
    ],

    body: [
      "Maaari naming baguhin ang mga tuntunin para sa legal, safety, o service changes. Magbibigay kami ng makatuwirang abiso sa mahahalagang pagbabago; kung kailangan ng batas ng panibagong pahintulot, hihingin namin ito. Ang mga tuntuning ito ay pinamamahalaan ng mga batas ng Pilipinas. Maaaring idulog ang naaangkop na reklamo sa DTI, NPC, o ibang awtoridad, at ang hindi maresolbang dispute sa hukuman na may wastong hurisdiksyon. Hindi nililimitahan nito ang mandatoryong karapatan ng consumer.",

      "We may update these Terms for legal, safety, or service changes. We will give reasonable notice of material changes and seek renewed agreement where required by law. Philippine law governs these Terms. Appropriate complaints may be brought to the DTI, NPC, or another authority, and unresolved disputes to a court with proper jurisdiction. This does not limit mandatory consumer rights.",
    ],
  },
]

const legalReferences = [
  {
    label: "RA 10173: Data Privacy Act of 2012",

    href: "https://lawphil.net/statutes/repacts/ra2012/ra_10173_2012.html",
  },

  {
    label: "RA 11967: Internet Transactions Act of 2023",

    href: "https://lawphil.net/statutes/repacts/ra2023/ra_11967_2023.html",
  },

  {
    label: "RA 7394: Consumer Act of the Philippines",

    href: "https://lawphil.net/statutes/repacts/ra1992/ra_7394_1992.html",
  },

  {
    label: "RA 8792: Electronic Commerce Act of 2000",

    href: "https://lawphil.net/statutes/repacts/ra2000/ra_8792_2000.html",
  },

  {
    label: "RA 8293: Intellectual Property Code",

    href: "https://lawphil.net/statutes/repacts/ra1997/ra_8293_1997.html",
  },
]

export function TermsConsentCard({
  checked,

  onCheckedChange,

  t,
}: TermsConsentCardProps) {
  const [open, setOpen] = useState(false)
  const [reachedEnd, setReachedEnd] = useState(false)

  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const element = scrollRef.current

    if (element && element.scrollHeight <= element.clientHeight + 4) {
      setReachedEnd(true)
    }
  }, [open, t])

  const handleScroll = (event: UIEvent<HTMLDivElement>) => {
    const element = event.currentTarget

    if (element.scrollHeight - element.scrollTop - element.clientHeight <= 8) {
      setReachedEnd(true)
    }
  }

  return (
    <section className="mt-6">
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={checked}
          disabled={!reachedEnd}
          onChange={(event) => onCheckedChange(event.target.checked)}
          className="mt-1 h-5 w-5 shrink-0 accent-primary disabled:cursor-not-allowed"
          required
        />
        <p className="text-[14px] leading-snug text-fg">
          {t("Sumasang-ayon ako sa ", "I agree to Bitinary’s ")}
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="font-semibold text-link underline underline-offset-2"
          >
            {t("Mga Tuntunin at Kondisyon", "Terms and Conditions")}
          </button>
          {t(" at Privacy Notice ng Bitinary.", " and Privacy Notice.")}
        </p>
      </div>
      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title={t(
          "Mga Tuntunin at Kondisyon at Privacy Notice",
          "Terms and Conditions and Privacy Notice",
        )}
        className="md:max-w-2xl"
        footer={
          <div className="flex items-center justify-between gap-3">
            <p className="text-[12px] text-fg-2" aria-live="polite">
              {reachedEnd
                ? t("Nabasa mo na ang dulo.", "You reached the end.")
                : t(
                    "I-scroll pababa para magpatuloy.",
                    "Scroll to the end to continue.",
                  )}
            </p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="min-h-11 shrink-0 rounded-full bg-primary px-5 font-display text-[14px] font-semibold text-on-primary"
            >
              {t("Isara", "Close")}
            </button>
          </div>
        }
      >
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          tabIndex={0}
          role="region"
          aria-label={t("Mga tuntunin ng Bitinary", "Bitinary terms")}
          className="max-h-[56dvh] space-y-4 overflow-y-auto overscroll-contain pr-2 text-[14px] leading-relaxed text-fg-2"
        >
          {termsSections.map((section) => (
            <section key={section.title[1]}>
              <h3 className="font-display font-semibold text-fg">
                {t(section.title[0], section.title[1])}
              </h3>
              <p className="mt-1">{t(section.body[0], section.body[1])}</p>
            </section>
          ))}
          <section>
            <h3 className="font-display font-semibold text-fg">
              {t("Operator at privacy contact", "Operator and privacy contact")}
            </h3>
            <p className="mt-1">
              {t(
                "Ang Bitinary ay pinamamahalaan ng APEX Tech. Para sa privacy request at mga tanong tungkol sa data:",
                "Bitinary is operated by APEX Tech. For privacy requests and data questions:",
              )}
            </p>
            <a
              href="mailto:zaldymalig@gmail.com"
              className="font-medium text-link underline underline-offset-2"
            >
              zaldymalig@gmail.com
            </a>
          </section>
          <section>
            <h3 className="font-display font-semibold text-fg">
              {t("Mga sanggunian sa batas", "Legal references")}
            </h3>
            <p className="mt-1">
              {t(
                "Mga pangunahing sanggunian ito, hindi kumpletong kopya ng lahat ng batas o legal na payo:",
                "These are key references, not a complete reproduction of every law or legal advice:",
              )}
            </p>
            <ul className="mt-2 list-inside list-disc space-y-1">
              {legalReferences.map((reference) => (
                <li key={reference.href}>
                  <a
                    href={reference.href}
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium text-link underline underline-offset-2"
                  >
                    {reference.label}
                  </a>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </Sheet>
    </section>
  )
}
