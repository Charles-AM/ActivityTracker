# Birthday Team Race

A playful weekend game site for Team P vs Team K. Friends join from invite links,
complete birthday challenges, upload proof, and move their team along a live
race tracker.

## Features

- Two team invite links: `/join/team-p` and `/join/team-k`
- Nickname-only join flow, no guest accounts required
- 4x4 birthday challenge bingo board
- Photo/video proof uploads
- Team race tracker and latest-proof feed
- Supabase realtime updates for shared progress
- Netlify Function admin controls at `/admin`
- Demo mode with browser storage when Supabase env vars are not configured

## Tech stack

- Vite + React + TypeScript
- Supabase free tier for database, storage, and realtime
- Netlify free tier for hosting and admin function

## Local development

```bash
npm install
npm run dev
```

Copy `.env.example` to `.env.local` and fill in the Supabase values if you want
shared live data locally.

## Supabase setup

1. Create a free Supabase project.
2. Open the SQL editor.
3. Run `supabase/schema.sql`.
4. In Project Settings > API, copy:
   - Project URL
   - anon public key
   - service_role key

The schema creates:

- `teams`
- `challenges`
- `submissions`
- public `challenge-proofs` storage bucket
- RLS policies for public reads and guest submissions

## Netlify deployment

1. Create a new Netlify site from this GitHub repo.
2. Use these build settings:
   - Build command: `npm run build`
   - Publish directory: `dist`
   - Functions directory: `netlify/functions`
3. Add these environment variables in Netlify:

```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-public-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
ADMIN_PIN=choose-a-private-host-pin
```

4. Deploy the site.

## Game links

After deployment, send friends:

- `https://your-site.netlify.app/join/team-p`
- `https://your-site.netlify.app/join/team-k`

The host/admin page is:

- `https://your-site.netlify.app/admin`

## Customizing

Edit `src/lib/gameData.ts` to change:

- twin/team names
- favorite colors
- challenge titles and descriptions
- icons and team styling

If you change challenge IDs after people have started playing, old submissions
will no longer match the renamed challenge. Change titles/descriptions freely,
but keep IDs stable during the weekend.
