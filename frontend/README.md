This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Kit builder UI (`/kits/[id]/edit`)

Two deliberate implementation choices worth knowing about:

- **Text-field saving**: prompt/answer_outline/summary/what_they_do fields (`InlineEditableText`) are click-to-edit. Saves are debounced 500ms after typing stops, *and* flushed immediately on blur — whichever fires first wins, and the other is a no-op (both funnel through the same "only send if it differs from what was last sent" guard), so a save is never lost if the user tabs away before the debounce timer runs, and there's never a duplicate request for the same value.
- **Reordering**: questions and flashcards reorder via up/down-arrow buttons, not drag-and-drop. This was the explicit "your call" option in the brief, and arrow buttons win here specifically for keyboard accessibility — they're reachable and operable by Tab + Enter with zero extra wiring, where a drag library needs a deliberate keyboard-sensor fallback to match.

Every mutation (edit, reorder, move, add, delete, regenerate) returns the fresh full kit from the server, and the UI patches its local `kit` state from that response directly rather than refetching — no full-page reload, no round-trip-per-keystroke for anything except the debounced text saves above.
