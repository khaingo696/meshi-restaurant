/**
 * Jediné místo pro údaje o restauraci.
 *
 * Vše, co bude majitelka časem doplňovat nebo měnit, žije tady. Komponenty
 * nikdy neobsahují natvrdo napsanou adresu, telefon ani otevírací dobu.
 *
 * TODO(majitelka): položky označené `TODO` je potřeba potvrdit nebo doplnit.
 */

export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/** Otevírací doba v místním čase Evropa/Praha. Klíč = den podle Date.getDay(). */
export const OPENING: Record<Weekday, { open: string; close: string } | null> = {
  1: { open: "11:00", close: "22:00" }, // pondělí
  2: { open: "11:00", close: "22:00" },
  3: { open: "11:00", close: "22:00" },
  4: { open: "11:00", close: "22:00" },
  5: { open: "11:00", close: "23:00" }, // pátek
  6: { open: "11:00", close: "23:00" }, // sobota
  0: { open: "12:00", close: "22:00" }, // neděle
};

export const site = {
  name: "Meshi",
  legalName: "Meshi", // TODO(majitelka): přesný obchodní název pro zásady GDPR
  tagline: { cs: "Asian Cuisine", en: "Asian Cuisine" },

  /** TODO(majitelka): IČO a sídlo. Povinné pro stránku se zásadami ochrany údajů. */
  ico: null as string | null,
  registeredSeat: null as string | null,

  address: {
    street: "Nám. Republiky 107/14",
    city: "Plzeň 3-Vnitřní Město",
    zip: "301 00",
    country: "CZ",
    /** TODO(majitelka): ověřit přesné souřadnice vchodu. */
    lat: 49.7477,
    lng: 13.3776,
  },

  phone: "+420778585688",
  phoneDisplay: "+420 778 585 688",
  // Zadání majitelky uvádí .cz, starý web běží na .eu. Platí .cz.
  email: "info@meshi-restaurant.cz",

  social: {
    instagram: "https://www.instagram.com/meshi_restaurant.cz/",
    facebook: "https://www.facebook.com/", // TODO(majitelka): přesná adresa profilu
  },

  /** TODO(majitelka): odkaz na aktuální PDF menu, až bude nové. */
  menuPdf: "/menu.pdf",

  /** Dárkové poukazy prodává externí platforma, web na ni jen odkazuje. */
  giftVoucherUrl: "https://hatsu.cz/",

  reservation: {
    minLeadMinutes: 15,
    maxDaysAhead: 3,
    maxPartySize: 12,
    /** Nad tuto velikost skupiny web doporučí zavolat místo formuláře. */
    callAbovePartySize: 8,
    slotStepMinutes: 15,
    /** Poslední možná rezervace před zavírací dobou. */
    lastSeatingBeforeCloseMinutes: 60,
  },

  timezone: "Europe/Prague",
} as const;

export const mapsUrl =
  `https://www.google.com/maps/search/?api=1&query=` +
  encodeURIComponent(
    `${site.name}, ${site.address.street}, ${site.address.city}`,
  );

export const mapyCzUrl =
  `https://mapy.cz/zakladni?q=` +
  encodeURIComponent(`${site.address.street}, Plzeň`);

/**
 * Popisky fotografií pro čtečky obrazovky.
 *
 * Samotné soubory se importují v komponentách ze `src/assets`, aby je Astro
 * převedlo do webp a vygenerovalo srcset. Zdroj je zatím starý web.
 *
 * TODO(majitelka): nafotit znovu ve vyšším rozlišení. Interiér je světlý,
 * takže talíře nafocené na světlém dřevě sednou webu lépe než na břidlici.
 */
export const alts = {
  interier: {
    cs: "Interiér restaurace Meshi s klenutým stropem a visícími rostlinami",
    en: "Interior of Meshi with a vaulted ceiling and hanging plants",
  },
  ramen: {
    cs: "Ramen s vepřovým chashu, nori a vejcem",
    en: "Ramen with chashu pork, nori and a soft egg",
  },
  poke: {
    cs: "Miska s tuňákem, avokádem a edamame",
    en: "Bowl with tuna, avocado and edamame",
  },
} as const;
