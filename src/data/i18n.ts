/**
 * Texty webu. Čeština je výchozí, angličtina pro turisty.
 *
 * Struktura sekcí i položky navigace vychází ze zadání majitelky:
 *   Domů, Menu, Galerie, Rezervace, Dárkový poukaz, Kontakt
 *
 * Texty označené "ze zadání" jsou převzaté doslova, jen bez pomlčky, kterou
 * česká sazba na tomto místě stejně řeší dvojtečkou nebo čárkou.
 */

export type Lang = "cs" | "en";

export const langs: Lang[] = ["cs", "en"];

export const t = {
  cs: {
    htmlLang: "cs",
    meta: {
      title: "Meshi | Japonská kuchyně v srdci Plzně",
      description:
        "Čerstvé sushi, ramen a tempura podle tradičních japonských postupů. Nám. Republiky, Plzeň. Rezervujte si stůl online.",
    },

    nav: {
      home: "Domů",
      menu: "Menu",
      gallery: "Galerie",
      reserve: "Rezervace",
      voucher: "Dárkový poukaz",
      contact: "Kontakt",
      skip: "Přeskočit na obsah",
      langLabel: "English",
      themeLabel: "Přepnout tmavý režim",
      openMenu: "Otevřít nabídku",
      closeMenu: "Zavřít nabídku",
    },

    /* Domů. Pozdrav z prostírání, logo, podtitul a velký slogan. */
    home: {
      tagline: "Traditional Asian Cuisine & Premium Sushi",
      slogan: "A taste of home",
      primary: "Rezervovat stůl",
      secondary: "Prohlédnout menu",
    },


    /* Naše signatures. Vlevo úvod, vpravo seznam, pod ním odkaz na PDF. */
    signatures: {
      heading: "Naše signatures",
      lead: "Sushi připravujeme tradičními japonskými metodami. Vedle něj vaříme teplou kuchyni, na kterou se hosté vracejí.",
      cta: "Zobrazit celé menu",
      items: [
        { name: "Sushi", jp: "寿司", desc: "Klasická nigiri a maki i vlastní speciality." },
        { name: "Ramen", jp: "ラーメン", desc: "Dlouho tažený vývar, chashu, nori a vejce." },
        { name: "Tempura", jp: "天ぷら", desc: "Křehké těstíčko, smažené na objednávku." },
        { name: "Takoyaki", jp: "たこ焼き", desc: "Osacká klasika s chobotnicí a bonitem." },
      ],
    },

    gallery: {
      heading: "Galerie",
      // Ze zadání majitelky, doslova.
      body: "V útulném prostoru Meshi, plném dřeva a zeleně, chceme našim hostům přiblížit autentickou asijskou kuchyni: prostou, poctivou a plnou výrazných chutí. Srdcem v každém pokrmu.",
    },

    reserve: {
      kana: "予約",
      heading: "Rezervace",
      lead: "Napište nám kdy a kolik vás bude. Potvrzení posíláme obvykle do 15 minut.",
      callInstead: "Nebo zavolejte",
    },

    voucher: {
      heading: "Dárkový poukaz",
      body: "Chcete udělat radost svým blízkým a dopřát jim vlastní kousek ráje na svém talíři? Pořiďte jim dárkový voucher do naší restaurace HATSU Restaurant. Stačí kliknout níže na tlačítko MÁM ZÁJEM a vyplnit hodnotu a kontaktní email.",
      cta: "Mám zájem",
    },

    contact: {
      kana: "ありがとうございます",
      kanaCz: "Děkuji",
      heading: "Kontakt",
      addressTitle: "Adresa",
      hoursTitle: "Otevírací doba",
      contactTitle: "Telefon a e-mail",
      mapsCta: "Otevřít v Mapách Google",
      openNow: "Právě otevřeno",
      closedNow: "Právě zavřeno",
      days: ["Neděle", "Pondělí", "Úterý", "Středa", "Čtvrtek", "Pátek", "Sobota"],
      daysShort: ["Ne", "Po", "Út", "St", "Čt", "Pá", "So"],
      closed: "Zavřeno",
    },

    form: {
      name: "Jméno a příjmení",
      phone: "Telefon",
      phoneHint: "České číslo ve tvaru +420 777 123 456",
      email: "E-mail",
      date: "Datum",
      time: "Čas",
      party: "Počet osob",
      partyUnit: (n: number) => (n === 1 ? "osoba" : n < 5 ? "osoby" : "osob"),
      note: "Poznámka",
      noteHint: "Alergie, dětská židlička, oslava. Nepovinné.",
      optional: "nepovinné",
      consent:
        "Souhlasím se zpracováním údajů pro vyřízení rezervace a s tím, že mi potvrzení pošlete.",
      consentLink: "Zásady ochrany osobních údajů",
      submit: "Odeslat rezervaci",
      bigParty: "Pro skupinu nad 8 osob nám prosím raději zavolejte, domluvíme stůl.",
      soonTitle: "Formulář ještě neodesílá",
      soonBody: "Rezervační systém dokončujeme. Zatím nám prosím zavolejte.",
      errors: {
        required: "Vyplňte prosím toto pole.",
        phone: "Zadejte české číslo, například +420 777 123 456.",
        email: "Zkontrolujte prosím tvar e-mailu.",
        date: "Vyberte datum v otevřeném období.",
        time: "Vyberte čas v otevírací době.",
        consent: "Bez souhlasu nemůžeme rezervaci zpracovat.",
      },
      closedDay: "V tento den máme zavřeno.",
      noSlots: "Na dnešek už bohužel nejde rezervovat online. Zavolejte nám prosím.",
    },

    footer: {
      rights: "Všechna práva vyhrazena.",
      privacy: "Zásady ochrany osobních údajů",
      instagram: "Instagram",
      facebook: "Facebook",
    },
  },

  en: {
    htmlLang: "en",
    meta: {
      title: "Meshi | Japanese kitchen in the heart of Plzeň",
      description:
        "Fresh sushi, ramen and tempura made the traditional Japanese way. Náměstí Republiky, Plzeň. Book a table online.",
    },

    nav: {
      home: "Home",
      menu: "Menu",
      gallery: "Gallery",
      reserve: "Booking",
      voucher: "Gift voucher",
      contact: "Contact",
      skip: "Skip to content",
      langLabel: "Čeština",
      themeLabel: "Toggle dark mode",
      openMenu: "Open menu",
      closeMenu: "Close menu",
    },

    home: {
      tagline: "Traditional Asian Cuisine & Premium Sushi",
      slogan: "A taste of home",
      primary: "Book a table",
      secondary: "See the menu",
    },


    signatures: {
      heading: "Our signatures",
      lead: "Sushi made by traditional Japanese methods, alongside a hot kitchen our guests come back for.",
      cta: "See the full menu",
      items: [
        { name: "Sushi", jp: "寿司", desc: "Classic nigiri and maki plus our own creations." },
        { name: "Ramen", jp: "ラーメン", desc: "Long simmered broth, chashu, nori and egg." },
        { name: "Tempura", jp: "天ぷら", desc: "Light batter, fried to order." },
        { name: "Takoyaki", jp: "たこ焼き", desc: "The Osaka classic with octopus and bonito." },
      ],
    },

    gallery: {
      heading: "Gallery",
      body: "In the warm rooms of Meshi, full of wood and greenery, we want to bring our guests authentic Asian cooking: plain, honest and full of clear flavour. With heart in every dish.",
    },

    reserve: {
      kana: "予約",
      heading: "Booking",
      lead: "Tell us when and how many. We usually confirm within 15 minutes.",
      callInstead: "Or give us a call",
    },

    voucher: {
      heading: "Gift voucher",
      body: "Would you like to treat your loved ones to their own little piece of paradise on a plate? Get them a gift voucher for our HATSU Restaurant. Just click the button below and fill in the value and your contact email.",
      cta: "I am interested",
    },

    contact: {
      kana: "ありがとうございます",
      kanaCz: "Thank you",
      heading: "Contact",
      addressTitle: "Address",
      hoursTitle: "Opening hours",
      contactTitle: "Phone and email",
      mapsCta: "Open in Google Maps",
      openNow: "Open now",
      closedNow: "Closed now",
      days: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
      daysShort: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
      closed: "Closed",
    },

    form: {
      name: "Full name",
      phone: "Phone",
      phoneHint: "Czech number, for example +420 777 123 456",
      email: "Email",
      date: "Date",
      time: "Time",
      party: "People",
      partyUnit: (n: number) => (n === 1 ? "person" : "people"),
      note: "Note",
      noteHint: "Allergies, a high chair, a celebration. Optional.",
      optional: "optional",
      consent:
        "I agree to my details being used to handle this booking and to receiving the confirmation.",
      consentLink: "Privacy policy",
      submit: "Send booking",
      bigParty: "For a group over 8 please call us and we will arrange the table.",
      soonTitle: "The form does not send yet",
      soonBody: "The booking system is being finished. Please call us in the meantime.",
      errors: {
        required: "Please fill this in.",
        phone: "Enter a Czech number, for example +420 777 123 456.",
        email: "Please check the email format.",
        date: "Pick a date inside the open window.",
        time: "Pick a time inside opening hours.",
        consent: "We cannot process the booking without your agreement.",
      },
      closedDay: "We are closed on this day.",
      noSlots: "Online booking for today has closed. Please give us a call.",
    },

    footer: {
      rights: "All rights reserved.",
      privacy: "Privacy policy",
      instagram: "Instagram",
      facebook: "Facebook",
    },
  },
} as const;

export type Copy = (typeof t)["cs"];

/** Cesta k téže stránce v druhém jazyce. */
export const otherLangHref = (lang: Lang) => (lang === "cs" ? "/en/" : "/");

/** Kotvy sekcí. Drží se pořadí ze zadání majitelky. */
export const sections = {
  home: "domu",
  menu: "menu",
  gallery: "galerie",
  reserve: "rezervace",
  contact: "kontakt",
} as const;
