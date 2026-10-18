/*
  Jídelní lístek pro sekci Signatures.

  JEDINÉ místo, kde se mění názvy a ceny. Layout ani CSS se kvůli menu
  nesahá — až dorazí finální lístek od klienta, přepíše se jen tenhle soubor.

  price: null  →  cena se na dlaždici vůbec nevykreslí (žádné „0 Kč“).
  Jakmile cena přijde, stačí null nahradit číslem v Kč.

  Fotky generuje scripts/build-menu-images.py ze složky
  restaurant_images/dishes/ — slug tady musí sedět na název souboru.
*/

export interface Dish {
  slug: string;
  name: string;
  /** Cena v Kč. null = zatím neznámá, na webu se skryje. */
  price: number | null;
  img: string;
}

export interface Category {
  slug: string;
  /** Název na kartě i v hlavičce překryvu. */
  label: string;
  cover: string;
  /** Alt text obálky — popisuje konkrétní fotku, ne kategorii. */
  coverAlt: string;
  items: Dish[];
}

export const categories: Category[] = [
  {
    slug: "predkrmy",
    label: "Předkrmy",
    cover: "/assets/menu/covers/predkrmy.webp",
    coverAlt: "Tuna tataki s pečetí ze sezamu a chilli na keramickém talíři",
    items: [
      { slug: "ebi-tempura",     name: "Ebi Tempura",     price: null, img: "/assets/menu/predkrmy/ebi-tempura.webp" },
      { slug: "gyoza",           name: "Gyoza",           price: null, img: "/assets/menu/predkrmy/gyoza.webp" },
      { slug: "hotate-tataki",   name: "Hotate Tataki",   price: null, img: "/assets/menu/predkrmy/hotate-tataki.webp" },
      { slug: "sake-tartar",     name: "Sake Tartar",     price: null, img: "/assets/menu/predkrmy/sake-tartar.webp" },
      { slug: "sake-tataki",     name: "Sake Tataki",     price: null, img: "/assets/menu/predkrmy/sake-tataki.webp" },
      { slug: "soft-shell-crab", name: "Soft Shell Crab", price: null, img: "/assets/menu/predkrmy/soft-shell-crab.webp" },
      { slug: "takojaki",        name: "Takojaki",        price: null, img: "/assets/menu/predkrmy/takojaki.webp" },
      { slug: "tori-karagge",    name: "Tori Karagge",    price: null, img: "/assets/menu/predkrmy/tori-karagge.webp" },
    ],
  },
  {
    slug: "hlavni",
    label: "Hlavní jídla",
    cover: "/assets/menu/covers/hlavni.webp",
    coverAlt: "Tonkotsu ramen s vepřovým chashu a vejcem na dřevěném tácu MESHi",
    items: [
      { slug: "bossam",                name: "Bossam",                price: null, img: "/assets/menu/hlavni/bossam.webp" },
      { slug: "bun-cha",               name: "Bun Cha",               price: null, img: "/assets/menu/hlavni/bun-cha.webp" },
      { slug: "chahan",                name: "Chahan",                price: null, img: "/assets/menu/hlavni/chahan.webp" },
      { slug: "chicken-katsu-kare",    name: "Chicken Katsu Kare",    price: null, img: "/assets/menu/hlavni/chicken-katsu-kare.webp" },
      { slug: "chicken-teriyaki",      name: "Chicken Teriyaki",      price: null, img: "/assets/menu/hlavni/chicken-teriyaki.webp" },
      { slug: "chili-chicken",         name: "Chili Chicken",         price: null, img: "/assets/menu/hlavni/chili-chicken.webp" },
      { slug: "duck-teriyaki",         name: "Duck Teriyaki",         price: null, img: "/assets/menu/hlavni/duck-teriyaki.webp" },
      { slug: "japchae",               name: "Japchae",               price: null, img: "/assets/menu/hlavni/japchae.webp" },
      { slug: "kamo-udon",             name: "Kamo Udon",             price: null, img: "/assets/menu/hlavni/kamo-udon.webp" },
      { slug: "mama-bowl",             name: "Mama Bowl",             price: null, img: "/assets/menu/hlavni/mama-bowl.webp" },
      { slug: "mongolian-beef",        name: "Mongolian Beef",        price: null, img: "/assets/menu/hlavni/mongolian-beef.webp" },
      { slug: "ori-bokkeum",           name: "Ori Bokkeum",           price: null, img: "/assets/menu/hlavni/ori-bokkeum.webp" },
      { slug: "pad-thai",              name: "Pad Thai",              price: null, img: "/assets/menu/hlavni/pad-thai.webp" },
      { slug: "salmon-curry",          name: "Salmon Curry",          price: null, img: "/assets/menu/hlavni/salmon-curry.webp" },
      { slug: "salmon-teriyaki-salad", name: "Salmon Teriyaki Salad", price: null, img: "/assets/menu/hlavni/salmon-teriyaki-salad.webp" },
      { slug: "satay-shrimps",         name: "Satay Shrimps",         price: null, img: "/assets/menu/hlavni/satay-shrimps.webp" },
      { slug: "yaki-udon",             name: "Yaki Udon",             price: null, img: "/assets/menu/hlavni/yaki-udon.webp" },
    ],
  },
  {
    slug: "sushi",
    label: "Sushi",
    cover: "/assets/menu/covers/sushi.webp",
    coverAlt: "Dřevěná loď plná sushi rolek a nigiri vedle lahve saké",
    items: [
      { slug: "chirashi-roll",         name: "Chirashi Roll",         price: null, img: "/assets/menu/sushi/chirashi-roll.webp" },
      { slug: "geisha-tempura-roll",   name: "Geisha Tempura Roll",   price: null, img: "/assets/menu/sushi/geisha-tempura-roll.webp" },
      { slug: "nigiri",                name: "Nigiri",                price: null, img: "/assets/menu/sushi/nigiri.webp" },
      { slug: "philadelphia-roll",     name: "Philadelphia Roll",     price: null, img: "/assets/menu/sushi/philadelphia-roll.webp" },
      { slug: "sake-ebiten-roll",      name: "Sake Ebiten Roll",      price: null, img: "/assets/menu/sushi/sake-ebiten-roll.webp" },
      { slug: "samuraj-roll",          name: "Samuraj Roll",          price: null, img: "/assets/menu/sushi/samuraj-roll.webp" },
      { slug: "set-sushi",             name: "Set Sushi",             price: null, img: "/assets/menu/sushi/set-sushi.webp" },
      { slug: "signature-m-s-salmon",  name: "Signature M_S Salmon",  price: null, img: "/assets/menu/sushi/signature-m-s-salmon.webp" },
      { slug: "sushi-rolls",           name: "Sushi Rolls",           price: null, img: "/assets/menu/sushi/sushi-rolls.webp" },
    ],
  },
];

/** Cena k vykreslení, nebo null když ji ještě neznáme. */
export function formatPrice(price: number | null): string | null {
  return price === null ? null : `${price} Kč`;
}
