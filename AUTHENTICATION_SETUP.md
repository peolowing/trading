# Autentisering - Setup Guide

## Översikt

Appen använder Supabase Auth för användarhantering med email/lösenord-inloggning.

## Features

- ✅ Email/lösenord registrering
- ✅ Email-verifiering
- ✅ Inloggning
- ✅ Utloggning
- ✅ Lösenordsåterställning
- ✅ Skyddade routes (kräver inloggning)
- ✅ User session management

## Setup-steg

### 1. Aktivera Email Auth i Supabase

1. Gå till din Supabase Dashboard
2. Navigera till **Authentication** → **Providers**
3. Se till att **Email** är aktiverad
4. Under **Email Templates**, verifiera att:
   - Confirm signup-template är konfigurerad
   - Reset password-template är konfigurerad

### 2. Konfigurera Miljövariabler

Kopiera `.env.local.example` till `.env.local`:

```bash
cp .env.local.example .env.local
```

Fyll i dina Supabase-credentials:

```env
# Backend (API)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key

# Frontend (Vite)
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

**Hitta dina credentials:**
- Gå till Supabase Dashboard → Settings → API
- Kopiera **Project URL** → `SUPABASE_URL` och `VITE_SUPABASE_URL`
- Kopiera **anon public** key → `SUPABASE_ANON_KEY` och `VITE_SUPABASE_ANON_KEY`

### 3. Kör RLS-script (Viktigt!)

Du **måste** köra RLS-scriptet för att authentication ska fungera säkert:

1. Öppna Supabase Dashboard → SQL Editor
2. Kör `supabase_enable_rls_safe.sql`

Detta aktiverar Row Level Security och säkerställer att användare endast kan se sin egen data.

### 4. Starta Utvecklingsserver

```bash
npm run dev
```

## Användning

### Första gången

1. Öppna appen i din webbläsare
2. Du ser automatiskt login-skärmen
3. Klicka på "Skapa konto"
4. Fyll i email och lösenord (minst 6 tecken)
5. Bekräfta ditt email via länken som skickas
6. Logga in med dina credentials

### Logout

- Klicka på **🚪 Logga ut**-knappen i header (högst upp till höger)

### Glömt Lösenord

1. Klicka på "Glömt lösenord?" på login-skärmen
2. Ange din email
3. Kontrollera din email för återställningslänk
4. Följ länken och ange nytt lösenord

## Säkerhet

### Nuvarande Implementation (Scenario A)

RLS är aktiverat men alla autentiserade användare kan se all data. Detta är lämpligt för:
- Single-user applikationer
- Utvecklingsmiljö
- Team som delar data

### Upgrade till User-Specific Data (Scenario C)

För att göra data användarspecifik (varje user ser bara sin egen data):

1. **Lägg till user_id-kolumner:**

```sql
ALTER TABLE portfolio ADD COLUMN user_id UUID REFERENCES auth.users(id);
ALTER TABLE trades ADD COLUMN user_id UUID REFERENCES auth.users(id);
ALTER TABLE watchlist ADD COLUMN user_id UUID REFERENCES auth.users(id);
ALTER TABLE screener_stocks ADD COLUMN user_id UUID REFERENCES auth.users(id);
```

2. **Uppdatera RLS policies:**

```sql
-- Portfolio: Users see only their own data
DROP POLICY IF EXISTS "Enable all for portfolio" ON portfolio;

CREATE POLICY "Users can view own portfolio"
ON portfolio FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own portfolio"
ON portfolio FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own portfolio"
ON portfolio FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own portfolio"
ON portfolio FOR DELETE
USING (auth.uid() = user_id);

-- Upprepa för trades, watchlist, screener_stocks...
```

3. **Uppdatera API-anrop:**

I alla API endpoints som skapar data, lägg till user_id:

```javascript
// Exempel: api/portfolio.js
const { user } = await supabase.auth.getUser();

const { data, error } = await supabase
  .from('portfolio')
  .insert([{
    ...insertData,
    user_id: user.id  // Lägg till user_id
  }]);
```

## Felsökning

### "Invalid login credentials"
- Dubbelkolla email och lösenord
- Se till att du bekräftat din email via verifieringslänken

### "Email not confirmed"
- Kontrollera din inbox för bekräftelsemail från Supabase
- Kolla spam/skräppost
- I Supabase Dashboard → Authentication → Users kan du manuellt bekräfta användare

### Data syns inte efter inloggning
- Verifiera att RLS-policies är korrekt konfigurerade
- Kör verification queries i `supabase_enable_rls_safe.sql`
- Kontrollera browser console för fel

### "VITE_SUPABASE_URL is not defined"
- Se till att `.env.local` finns i root-katalogen
- Starta om dev-servern efter att ha ändrat .env-filer
- Variabelnamn måste börja med `VITE_` för att fungera i frontend

## Komponenter

### AuthContext
- `src/contexts/AuthContext.jsx` - Auth provider med hooks

### Components
- `src/components/Auth/LoginForm.jsx` - Inloggningsformulär
- `src/components/Auth/SignupForm.jsx` - Registreringsformulär
- `src/components/Auth/AuthModal.jsx` - Modal wrapper
- `src/components/ProtectedRoute.jsx` - Route protection wrapper

### Integration
- `src/App.jsx` - Visar AuthModal om inte inloggad
- `src/components/Dashboard.jsx` - Logout-knapp i header

## API Referens

### useAuth Hook

```javascript
import { useAuth } from './contexts/AuthContext';

function MyComponent() {
  const {
    user,           // Current user object (null if not logged in)
    loading,        // Auth loading state
    signIn,         // (email, password) => Promise
    signUp,         // (email, password) => Promise
    signOut,        // () => Promise
    resetPassword,  // (email) => Promise
    updatePassword, // (newPassword) => Promise
    supabase        // Supabase client instance
  } = useAuth();
}
```

### User Object

```javascript
{
  id: "uuid",
  email: "user@example.com",
  created_at: "2024-01-01T00:00:00Z",
  // ... other Supabase user fields
}
```

## Nästa Steg (Valfritt)

1. **Lägg till OAuth providers** (Google, GitHub, etc.)
2. **Implementera user-specific data** med RLS (se ovan)
3. **Lägg till användarprofilsida**
4. **Aktivera 2FA** (Two-Factor Authentication)
5. **Implementera team/workspace-funktionalitet**

## Support

För mer information om Supabase Auth:
- [Supabase Auth Docs](https://supabase.com/docs/guides/auth)
- [Row Level Security Guide](https://supabase.com/docs/guides/auth/row-level-security)
