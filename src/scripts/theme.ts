/**
 * Přepínač světlého a tmavého režimu.
 *
 * Výchozí hodnotu nastavuje inline skript v <head>, aby nic neproblikávalo.
 * Tento modul řeší jen kliknutí a zapamatování volby.
 */

const root = document.documentElement;
const STORAGE_KEY = "meshi-theme";

function apply(theme: "light" | "dark") {
  root.dataset.theme = theme;
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    /* Zablokované úložiště volbu neuloží, ale stránka funguje dál. */
  }
  document
    .querySelectorAll<HTMLButtonElement>("[data-theme-toggle]")
    .forEach((b) => b.setAttribute("aria-pressed", String(theme === "dark")));
}

document.querySelectorAll<HTMLButtonElement>("[data-theme-toggle]").forEach((btn) => {
  btn.setAttribute("aria-pressed", String(root.dataset.theme === "dark"));
  btn.addEventListener("click", () =>
    apply(root.dataset.theme === "dark" ? "light" : "dark"),
  );
});

/* Mobilní navigace */
const navToggle = document.querySelector<HTMLButtonElement>("[data-nav-toggle]");
const navPanel = document.querySelector<HTMLElement>("[data-nav-panel]");

if (navToggle && navPanel) {
  const setOpen = (open: boolean) => {
    navToggle.setAttribute("aria-expanded", String(open));
    navPanel.hidden = !open;
    document.body.style.overflow = open ? "hidden" : "";
  };

  navToggle.addEventListener("click", () =>
    setOpen(navToggle.getAttribute("aria-expanded") !== "true"),
  );
  navPanel.querySelectorAll("a").forEach((a) => a.addEventListener("click", () => setOpen(false)));
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && navToggle.getAttribute("aria-expanded") === "true") setOpen(false);
  });
}
