# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
- **Visitors of an art exhibition** who leave a short spoken comment. Two situations: a fixed iPad kiosk at the exhibition (shared device, standing, often near the exit or next to a work) and their own phone after scanning a QR code placed next to a specific artwork.
- **Curators / organizers (the client)** who review, listen to, transcribe and export the comments, and need numbers about participation.
- **Sean (operator/vendor)** who sets up each exhibition for a client and sells the service.

## Product Purpose
Collect spontaneous voice comments from exhibition visitors with one tap, store them safely, and give the organizer an orderly archive. Success for the client: many comments collected, an archive that is easy to listen to, transcribe and export, comments attributable to a specific artwork, and participation statistics.

## Positioning
Voice instead of a guestbook: visitors speak for up to 60 seconds with a single button, no app install, no account. Works both as a shared kiosk and per-artwork via QR. Recordings are kept locally on the kiosk as a backup even when the network fails.

## Operating Context
- Kiosk: iPad in fullscreen (home-screen web app, Guided Access), noisy gallery spaces, variable lighting, many strangers touching it, no staff assistance.
- Mobile: visitor's own phone, one-off use, arriving from a QR code next to an artwork.
- Admin: organizer at a desk or on a tablet, reviewing batches of recordings after the event or during it.

## Capabilities and Constraints
- Stack: React (Create React App), Firebase Firestore + Storage, Vercel (serverless function `/api/transcribe` proxies OpenAI Whisper).
- Recording via MediaRecorder (webm/opus, mp4 on iOS), max 60 s, local IndexedDB backup before upload.
- Admin: list, play, download, delete, on-demand transcription, local backup tab.
- Requested additions (confirmed goals): comments linked to a specific artwork (QR per artwork), participation statistics, white-label branding per exhibition.
- Must work offline-tolerant on the kiosk; must handle microphone permission denial clearly.

## Brand Commitments
- White-label: each exhibition's own image, name and colors lead; the vendor credit "© Martins Osemwengie" stays small at the bottom.
- Interface language: Italian.

## Evidence on Hand
- Poster image `public/image.jpeg` (current exhibition placeholder).
- No real client names, testimonials or statistics exist; never fabricate them.

## Product Principles
1. One gesture to speak: the visitor understands what to do in under two seconds, without reading.
2. The exhibition is the protagonist; the tool recedes.
3. Never lose a recording, and never tell the visitor it was saved when it was not.
4. The organizer's archive is a working tool: fast to scan, honest about status, exportable.

## Accessibility & Inclusion
Public shared device used by any visitor: large touch targets, high contrast, readable at arm's length, status conveyed by text and shape not color alone.

## Visual Standard (confirmed)
Category standard played straight ("standard pulito"), at the craft level of Apple's Voice Memos, museum apps (MoMA, Tate) and Linear/Vercel. Dark kiosk with the exhibition image leading and one large record control; light, dense, precise admin.
