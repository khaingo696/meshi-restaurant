/**
 * Stav "právě otevřeno" v pásmu Evropa/Praha.
 *
 * Stránka je statická a build proběhl někdy dřív, takže se stav musí spočítat
 * až u návštěvníka. `Intl` s `timeZone` zvládne letní čas i jeho přechody sám,
 * nikdy nepočítáme posun od UTC ručně.
 *
 * Obsluhuje všechny prvky s `data-open-state` na stránce, ne jen první.
 */

import { OPENING } from "../data/site";

const parts = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Prague",
  weekday: "short",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
}).formatToParts(new Date());

const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
const dayIndex = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(get("weekday"));
const now = `${get("hour")}:${get("minute")}`;

const today = OPENING[dayIndex as keyof typeof OPENING];
// Řetězce ve stejném tvaru jdou porovnat přímo, HH:MM je seřaditelné.
const isOpen = !!today && now >= today.open && now < today.close;

// Dnešní hodiny se také plní až tady. Kdyby se zapekly do buildu, ukazovaly
// by den, kdy se web nasazoval, ne dnešek u návštěvníka.
document.querySelectorAll<HTMLElement>("[data-today-hours]").forEach((el) => {
  el.textContent = today ? `${today.open} - ${today.close}` : (el.dataset.closed ?? "");
});

document.querySelectorAll<HTMLElement>("[data-open-state]").forEach((el) => {
  const dot = el.querySelector<HTMLElement>("[data-open-dot]");
  const label = el.querySelector<HTMLElement>("[data-open-label]");

  if (label) {
    label.textContent = isOpen
      ? (el.dataset.labelOpen ?? "")
      : (el.dataset.labelClosed ?? "");
  }
  if (dot) {
    dot.classList.toggle("bg-accent", isOpen);
    dot.classList.toggle("bg-fg-muted", !isOpen);
  }
  el.hidden = false;
});
