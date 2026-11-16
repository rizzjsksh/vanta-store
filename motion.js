/* ==========================================================================
   XANTA — MOTION
   --------------------------------------------------------------------------
   GSAP drives every entrance and scroll-linked moment on the storefront.

   Rules this file follows:
     * Nothing is hidden until GSAP is confirmed present, so a failed script
       load degrades to a fully visible, fully usable page.
     * Every animation respects prefers-reduced-motion via gsap.matchMedia().
     * ScrollTriggers are created in document order so refresh() is stable.
     * Re-rendered content (the live product grids) calls XANTAMotion.refresh()
       so newly injected cards get their reveal without a full reload.
   ========================================================================== */

(function () {
  "use strict";

  if (!window.gsap) return; // No GSAP -> no motion, but no broken page either.

  const hasScrollTrigger = !!window.ScrollTrigger;
  const hasSplitText = !!window.SplitText;

  if (hasScrollTrigger) gsap.registerPlugin(ScrollTrigger);
  if (hasSplitText) gsap.registerPlugin(SplitText);

  document.documentElement.classList.add("js-motion");

  const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ----------------------------------------------------------------------
     Reduced motion: reveal everything, create nothing.
     ---------------------------------------------------------------------- */
  if (prefersReduced) {
    gsap.set("[data-reveal]", { clearProps: "all" });
    gsap.set(".hero-title-mask > span", { clearProps: "transform" });
    return;
  }

  const splitInstances = [];

  /* ----------------------------------------------------------------------
     Hero — one orchestrated entrance.
     ---------------------------------------------------------------------- */
  function initHero() {
    const lines = gsap.utils.toArray("[data-hero-line]");
    if (!lines.length) return;

    const tl = gsap.timeline({ defaults: { ease: "power3.out" } });

    tl.from(".hero-brand-tag", { y: 14, autoAlpha: 0, duration: 0.6 }, 0)
      .from(".hero-showcase-card", { scale: 0.95, autoAlpha: 0, duration: 1.15, ease: "power2.out" }, 0.05)
      .from(".hero-title-mask > span", { yPercent: 112, duration: 1.05, stagger: 0.1 }, 0.12)
      .from(".hero-subtext", { y: 18, autoAlpha: 0, duration: 0.7 }, 0.5)
      .from(".hero-actions-row > *", { y: 16, autoAlpha: 0, duration: 0.55, stagger: 0.08 }, 0.62)
      .from(".hero-lot-row .lot-swatch", { y: 12, autoAlpha: 0, duration: 0.5, stagger: 0.05 }, 0.78)
      .from(".hero-spec-rail > div", { y: 16, autoAlpha: 0, duration: 0.6, stagger: 0.07 }, 0.82);

    // Character-level detail on the accent line, once the line has landed.
    if (hasSplitText) {
      const accent = document.querySelector(".hero-title-accent");
      if (accent) {
        const split = SplitText.create(accent, { type: "chars", aria: "auto" });
        splitInstances.push(split);
        tl.from(split.chars, {
          yPercent: 60,
          autoAlpha: 0,
          duration: 0.7,
          stagger: 0.035,
          ease: "power2.out"
        }, 0.85);
      }
    }

    return tl;
  }

  /* ----------------------------------------------------------------------
     Scroll reveals — batched so a row of cards animates as one gesture.
     ---------------------------------------------------------------------- */
  function initReveals() {
    if (!hasScrollTrigger) {
      gsap.set("[data-reveal]", { clearProps: "all" });
      return;
    }

    const targets = gsap.utils.toArray("[data-reveal]");
    if (!targets.length) return;

    ScrollTrigger.batch(targets, {
      start: "top 90%",
      once: true,
      interval: 0.08,
      onEnter: batch => {
        gsap.to(batch, {
          y: 0,
          autoAlpha: 1,
          duration: 0.78,
          stagger: 0.07,
          ease: "power3.out",
          overwrite: true,
          clearProps: "transform"
        });
      }
    });
  }

  /* ----------------------------------------------------------------------
     Scroll-linked drift — the specimen stage settles as the page scrolls.
     ---------------------------------------------------------------------- */
  function initScrollDrift() {
    if (!hasScrollTrigger) return;

    const stage = document.querySelector(".hero-showcase-card");
    if (stage) {
      gsap.to(stage, {
        yPercent: -7,
        ease: "none",
        scrollTrigger: {
          trigger: ".hero-section",
          start: "top top",
          end: "bottom top",
          scrub: true
        }
      });
    }

    const rail = document.querySelector(".hero-spec-rail");
    if (rail) {
      gsap.from(rail, {
        opacity: 0.25,
        ease: "none",
        scrollTrigger: {
          trigger: ".hero-section",
          start: "top top",
          end: "bottom 40%",
          scrub: true
        }
      });
    }
  }

  /* ----------------------------------------------------------------------
     Micro-interactions — small feedback that confirms an action landed.
     ---------------------------------------------------------------------- */
  function initMicroInteractions() {
    // Lot swatches acknowledge the press.
    gsap.utils.toArray(".lot-swatch").forEach(swatch => {
      swatch.addEventListener("pointerdown", () => {
        gsap.fromTo(swatch, { scale: 0.86 }, { scale: 1, duration: 0.45, ease: "back.out(3)", overwrite: true });
      });
    });

    // The cart badge acknowledges an add-to-bag.
    gsap.utils.toArray("#cart-count, .cart-count-badge, .bottom-cart-badge").forEach(badge => {
      badge.addEventListener("xanta:bump", () => {
        gsap.fromTo(badge, { scale: 1 }, {
          scale: 1.35, duration: 0.16, yoyo: true, repeat: 1,
          ease: "power2.out", overwrite: true
        });
      });
    });
  }

  /* ----------------------------------------------------------------------
     Refresh — called after live content is injected.
     ---------------------------------------------------------------------- */
  function refresh() {
    if (prefersReduced) {
      gsap.set("[data-reveal]", { clearProps: "all" });
      return;
    }
    initReveals();
    initMicroInteractions();
    if (hasScrollTrigger) ScrollTrigger.refresh();
  }

  /* ----------------------------------------------------------------------
     Boot
     ---------------------------------------------------------------------- */
  function boot() {
    initHero();
    initReveals();
    initScrollDrift();
    initMicroInteractions();

    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => {
        if (hasScrollTrigger) ScrollTrigger.refresh();
      });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }

  window.XANTAMotion = { refresh: refresh };
})();
