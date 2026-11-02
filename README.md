# VANTA Store

Independent storefront foundation for VANTA — The Art of Standing Apart.

## Current status
- Responsive editorial-style homepage
- VANTA Essentials product preview catalogue
- Shopping bag drawer interface
- Launch notification form placeholder
- Checkout intentionally disabled until payment and fulfilment are integrated and tested
- Printify API integration not yet connected

## Files
- `index.html` — storefront structure
- `styles.css` — responsive brand styling
- `app.js` — catalogue and shopping bag interface

## Deploy to Cloudflare Pages
1. Open **Workers & Pages** in Cloudflare.
2. Create a Pages project and connect this GitHub repository.
3. Framework preset: **None**.
4. Build command: leave blank if allowed; otherwise use `exit 0`.
5. Build output directory: `/` (repository root).
6. Deploy.

Do not enable checkout until payment confirmation, product variants, Printify fulfilment, shipping rates, refunds and order notifications have been tested.

## Before launch
Replace CSS product mockups with actual Printify product mockup images and verified prices. Add privacy, shipping, returns and contact information. Connect a real email signup provider before collecting customer emails.