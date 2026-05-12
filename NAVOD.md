# Tipovacka o Plznicku — Navod na spusteni (Neon + Vercel)

## KROK 1 — Neon (databaze)

1. Jdi na **https://neon.tech** a prihlas se.
2. Vytvor projekt (region: `EU Central (Frankfurt)` doporuceno).
3. V projektu otevri **SQL Editor**.
4. Vloz cely obsah souboru `neon_schema.sql` a klikni **Run**.
5. V **Connection Details** zkopiruj **Pooled connection** string (`postgresql://...?sslmode=require`).
   - Pouzijes ho ve Vercel env var `DATABASE_URL` (krok 3).

> Pokud uz mas Neon DB rozjetou s tabulkami, schema je idempotentni (`create table if not exists`).

---

## KROK 2 — GitHub (ulozeni kodu)

1. Vytvor novy private repo na **https://github.com**.
2. Nahraj vsechny soubory z projektu (krome `.env.local` a `node_modules/`).

---

## KROK 3 — Vercel (deploy + Blob storage)

1. Jdi na **https://vercel.com** a prihlas se pres GitHub.
2. **Add New Project** -> vyber svuj repozitar -> **Deploy** (Vercel detekuje Vite automaticky).
3. Po prvnim deployu jdi do **Settings -> Environment Variables** a pridej:
   - `DATABASE_URL` = connection string z Neonu (krok 1).
4. Vytvor Blob store (na fotky clenu rodiny):
   - **Storage** -> **Create Database** -> **Blob** -> pojmenuj napr. `photos`.
   - Vercel automaticky pripoji env var `BLOB_READ_WRITE_TOKEN` k projektu.
5. **Deployments -> Redeploy** posledniho deployu (aby zachytil env vars).

Vercel ti da URL ve tvaru `https://nazev-projektu.vercel.app`.

---

## KROK 4 — Otestuj appku

1. Otevri Vercel URL v prohlizeci.
2. Klikni **(zamek)** a prihlas se heslem **`hokej`** (zmenis v Nastavenich).
3. Pridej zapas, pridej cleny rodiny, tipuj.
4. Otevri stejnou URL na druhem zarizeni — tipy se sesynchronizuji do 5 sekund (polling).

---

## Lokalni vyvoj

```bash
npm install
cp .env.example .env.local
# vyplnit DATABASE_URL a BLOB_READ_WRITE_TOKEN
npx vercel dev   # spusti Vite + serverless funkce dohromady (port 3000)
```

`npm run dev` spusti jen frontend (bez `/api/*` endpointu) — pro plny stack pouzij `vercel dev`.

---

## Casto kladene otazky

**Sync mezi zarizenimi je pomaly.** Po prechodu na Neon je sync polling kazdych 5s (Neon nema websockety jako Supabase mel). Da se zmenit v `App.jsx` (`setInterval(refresh, 5000)`).

**Fotky se neukladaji.** Zkontroluj, ze ma projekt pripojeny Blob store ve Vercel -> Storage. `BLOB_READ_WRITE_TOKEN` musi byt v env vars.

**"DATABASE_URL is not defined".** Env var nebyla nastavena pred deployem nebo nebyl proveden redeploy po jejim pridani.

---

## Aktualizace

1. Pushni zmenu do GitHubu.
2. Vercel automaticky deployne novou verzi za ~1 minutu.
