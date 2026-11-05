# XANTA — The Art of Standing Apart.

XANTA is an independent streetwear label built around understated design, considered essentials and the confidence to stand apart without needing to be loud.

This repository contains the code for the XANTA online storefront and its store-management foundation. The first release is focused on **XANTA Essentials**: minimalist everyday clothing, beginning with signature T-shirts in black and white, with hoodies planned for a later release.

**Storefront:** https://xanta.pages.dev  
**Admin dashboard:** https://xanta.pages.dev/admin.html

> XANTA's brand line: **THE ART OF STANDING APART.**

---

## What XANTA is

XANTA is a fashion and streetwear brand, not a general marketplace or a clothing supplier. The goal is to offer a focused collection of clean, versatile pieces with a premium visual identity.

The brand direction is:
- **Minimal:** restrained graphics, clean typography and uncluttered layouts.
- **Modern:** relaxed silhouettes and everyday streetwear styling.
- **Versatile:** pieces designed to work across casual, layered and everyday outfits.
- **Intentional:** a focused collection rather than an overwhelming catalogue.

The initial audience is shoppers in the United States, United Kingdom and Canada.

## What this project contains

### Customer storefront
- Responsive homepage and shop catalogue.
- Product detail pages with descriptions, sizes and pricing.
- Featured product areas and collection presentation.
- Shopping-bag interface foundation.
- Product catalogue loading from the XANTA API.

### Private store administration
- First-time admin password setup and sign-in.
- Product creation, editing and deletion.
- Product image uploads.
- Product names, categories, colours, descriptions, sizes and prices.
- Publish/unpublish controls and homepage featured-product selection.

### Cloudflare services
- **Cloudflare Pages:** hosts the storefront and admin interface.
- **Cloudflare Workers:** provides the XANTA API.
- **Cloudflare D1:** stores product information and admin session records.
- **Cloudflare R2:** stores uploaded product images.

## Products and fulfilment model

The first collection is **XANTA Essentials**. The initial catalogue contains:
- XANTA Signature Tee — White.
- XANTA Oversized Signature Tee — Black.

The current intended fulfilment workflow uses Printify for print production and shipping. At launch, orders are intended to be reviewed and submitted manually in Printify after the customer's payment has been verified. Printify production and shipping costs must be funded separately when placing each order.

Product photos, variant mockups, size availability, production costs and destination-specific shipping rates must be checked against the live Printify listings before accepting orders.

## Current development status

This is an active storefront project, not a finished e-commerce operation.

| Area | Status |
|---|---|
| Brand direction and first collection | In progress |
| Storefront and product pages | Built; continue visual and usability testing |
| Product catalogue database | Created with two initial T-shirt records |
| Admin dashboard | Added; first-time setup and end-to-end testing required |
| Product image storage | R2 bucket configured; upload and public image delivery need testing |
| Actual Printify product photos | Still need to be uploaded and checked |
| Printify fulfilment | Manual workflow planned; not automated |
| Payment checkout | Not enabled |
| Shipping calculation | Not yet implemented or verified |
| Order notifications and order management | Not yet complete |
| Legal pages and customer policies | Must be completed before launch |

**Do not treat the website as ready to accept payments yet.** Before launch, test admin access, image uploads, product updates, mobile layouts, checkout, payment confirmation, shipping charges, order notifications, refunds and the full Printify fulfilment process.

## Repository structure

- `index.html` — homepage.
- `shop.html` — product catalogue.
- `product.html` — product detail page.
- `admin.html` — private store administration interface.
- `styles.css` — visual styling and responsive layouts.
- `app.js` — storefront interactions and catalogue rendering.

The XANTA API is deployed separately as a Cloudflare Worker and connects to the D1 and R2 resources configured in the Cloudflare account.

## Development and deployment

The storefront is deployed through Cloudflare Pages and connected to this GitHub repository. Commits to the connected deployment branch can trigger a new Pages deployment.

For a static Pages deployment:
1. Open **Workers & Pages** in the Cloudflare dashboard.
2. Select the XANTA Pages project.
3. Confirm the GitHub repository and deployment branch.
4. Use the **None** framework preset for this plain HTML/CSS/JavaScript storefront.
5. Set the build output directory to the repository root.
6. Deploy and check the deployment logs.

The API Worker and its D1/R2 bindings are separate from the Pages static-site deployment. Keep credentials and secrets out of the repository. Never commit admin passwords, API tokens or private keys.

## Before public launch

- Upload the final Printify mockup images for every product and colour.
- Verify all product variants and size-specific prices.
- Confirm Printify production costs and shipping to each target country.
- Complete and test the Monime payment flow before enabling checkout.
- Build and test order records, payment confirmation, customer emails and tracking updates.
- Publish clear shipping, returns/refunds, privacy and contact pages.
- Test the complete customer journey on desktop and mobile.
- Confirm that the admin dashboard and API are protected and that image uploads work as expected.

---

**XANTA — THE ART OF STANDING APART.**
