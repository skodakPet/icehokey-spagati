# 🍺 Tipovačka o Plzničku — Návod na spuštění
## Celý proces zabere asi 20–30 minut

---

## KROK 1 — Supabase (databáze, zdarma)

1. Jdi na **https://supabase.com** a klikni **Start your project**
2. Přihlaš se přes GitHub nebo e-mail
3. Klikni **New project**
   - Name: `plznička`
   - Database password: vymysli si heslo (ulož si ho!)
   - Region: vyber `Central EU (Frankfurt)`
4. Počkej 2 minuty než se projekt vytvoří

### Vytvoř tabulky:
5. V levém menu klikni na **SQL Editor**
6. Klikni **New query**
7. Zkopíruj celý obsah souboru **`supabase_schema.sql`** a vlož ho do editoru
8. Klikni **Run** (zelené tlačítko vpravo nahoře)
9. Měl bys vidět: `Success. No rows returned`

### Zjisti si API klíče:
10. V levém menu jdi do **Project Settings** → **API**
11. Zkopíruj si:
    - **Project URL** (vypadá jako `https://xxxxx.supabase.co`)
    - **anon public** klíč (dlouhý řetězec začínající `eyJ...`)

### Vytvoř storage pro fotky (nepovinné):
12. V levém menu klikni **Storage**
13. Klikni **New bucket**
    - Name: `photos`
    - Public bucket: **zapnout** (toggle on)
14. Klikni **Save**

---

## KROK 2 — Připrav kód

1. Otevři soubor **`App.jsx`** v textovém editoru (Notepad, VS Code, apod.)
2. Najdi tyto dva řádky na začátku souboru (řádky 8–9):
   ```
   const SUPABASE_URL = "VLOŽ_SVŮJ_SUPABASE_URL";
   const SUPABASE_ANON_KEY = "VLOŽ_SVŮJ_SUPABASE_ANON_KEY";
   ```
3. Nahraď je svými hodnotami z Kroku 1:
   ```
   const SUPABASE_URL = "https://xxxxx.supabase.co";
   const SUPABASE_ANON_KEY = "eyJhbGci...";
   ```
4. Ulož soubor

---

## KROK 3 — GitHub (uložení kódu)

1. Jdi na **https://github.com** a vytvoř si účet (nebo se přihlaš)
2. Klikni **+** → **New repository**
   - Repository name: `plznička`
   - Visibility: **Private**
   - Klikni **Create repository**
3. Na stránce nového repozitáře klikni **uploading an existing file**
4. Přetáhni VŠECHNY soubory ze složky `plznička` (App.jsx, package.json, vite.config.js, index.html, složku src/)
5. Klikni **Commit changes**

---

## KROK 4 — Netlify (hosting, zdarma)

1. Jdi na **https://netlify.com** a klikni **Sign up**
2. Přihlaš se **přes GitHub** (nejjednodušší)
3. Klikni **Add new site** → **Import an existing project**
4. Vyber **GitHub** → najdi repozitář `plznička`
5. Nastavení buildu:
   - **Build command:** `npm run build`
   - **Publish directory:** `dist`
6. Klikni **Deploy site**
7. Počkej 1–2 minuty

### Výsledek:
Netlify ti vygeneruje URL jako `https://náhodné-jméno.netlify.app`

**Můžeš si nastavit vlastní název:**
- Site settings → Domain management → Add custom domain
- Například: `plznička.netlify.app` (pokud je volné)

---

## KROK 5 — Otestuj appku

1. Otevři URL z Netlify v prohlížeči
2. Klikni na 🔐 a přihlaš se heslem **hokej**
3. Přidej zápas, přidej tipy
4. Otevři stejnou URL na jiném telefonu — tipy se synchronizují automaticky! ✅

---

## Časté problémy

**"Invalid API key"** → Zkontroluj že jsi správně zkopíroval SUPABASE_URL a ANON_KEY

**Prázdná stránka po deployi** → V Netlify jdi do Deploy log a podívej se na chybu

**Fotky nefungují** → Zkontroluj že jsi vytvořil bucket `photos` jako Public

---

## Sdílení s rodinou

Stačí jim poslat link (např. `https://plznička.netlify.app`) přes WhatsApp.
Každý si vybere své jméno v horní liště a tipuje!

---

## Aktualizace appky v budoucnu

Když budeš chtít změnit něco v App.jsx:
1. Uprav soubor
2. Nahraj ho znovu na GitHub (přes upload nebo git)
3. Netlify automaticky znovu nasadí novou verzi do 2 minut

---

*Vytvořeno s ❤️ a 🍺*
