(() => {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ----- Nav: glass on scroll, active section -----
  const nav = document.getElementById('nav');
  const navLinks = [...nav.querySelectorAll('.nav__links a')];
  const sections = navLinks.map((a) => document.querySelector(a.getAttribute('href'))).filter(Boolean);

  const onScroll = () => nav.classList.toggle('is-scrolled', window.scrollY > 40);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  const activeObs = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        navLinks.forEach((a) => a.classList.toggle('is-active', a.getAttribute('href') === `#${e.target.id}`));
      });
    },
    { rootMargin: '-45% 0px -50% 0px' },
  );
  sections.forEach((s) => activeObs.observe(s));

  // ----- Hero parallax -----
  const heroMedia = document.querySelector('.hero__media');
  if (heroMedia && !reduceMotion) {
    let ticking = false;
    const update = () => {
      const y = window.scrollY;
      if (y < window.innerHeight * 1.2) heroMedia.style.transform = `translateY(${y * 0.28}px)`;
      ticking = false;
    };
    window.addEventListener(
      'scroll',
      () => {
        if (ticking) return;
        requestAnimationFrame(update);
        ticking = true;
      },
      { passive: true },
    );
  }

  // ----- Reveal on scroll, staggered among siblings -----
  const revealEls = document.querySelectorAll('.reveal');
  const counts = new Map();
  revealEls.forEach((el) => {
    const i = counts.get(el.parentElement) ?? 0;
    el.style.setProperty('--d', `${Math.min(i, 6) * 90}ms`);
    counts.set(el.parentElement, i + 1);
  });
  const revealObs = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        e.target.classList.add('in');
        revealObs.unobserve(e.target);
      });
    },
    { threshold: 0.12, rootMargin: '0px 0px -8% 0px' },
  );
  revealEls.forEach((el) => revealObs.observe(el));

  // ----- Gallery lightbox -----
  const gallery = document.getElementById('gallery');
  const lightbox = document.getElementById('lightbox');
  if (gallery && lightbox) {
    const items = [...gallery.querySelectorAll('.gallery__item')];
    const img = lightbox.querySelector('.lightbox__img');
    const cap = lightbox.querySelector('.lightbox__cap');
    let index = 0;

    const wrap = (i) => (i + items.length) % items.length;
    const preload = (i) => {
      new Image().src = items[wrap(i)].href;
    };
    const show = (i) => {
      index = wrap(i);
      const item = items[index];
      img.src = item.href;
      img.alt = item.querySelector('img').alt;
      cap.textContent = item.dataset.caption;
      preload(index + 1);
      preload(index - 1);
    };

    items.forEach((item, i) => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        show(i);
        lightbox.showModal();
      });
    });
    lightbox.querySelector('.lightbox__prev').addEventListener('click', () => show(index - 1));
    lightbox.querySelector('.lightbox__next').addEventListener('click', () => show(index + 1));
    lightbox.querySelector('.lightbox__close').addEventListener('click', () => lightbox.close());
    lightbox.addEventListener('click', (e) => {
      if (e.target === lightbox) lightbox.close();
    });
    lightbox.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight') show(index + 1);
      if (e.key === 'ArrowLeft') show(index - 1);
    });

    let touchX = 0;
    lightbox.addEventListener('touchstart', (e) => { touchX = e.touches[0].clientX; }, { passive: true });
    lightbox.addEventListener('touchend', (e) => {
      const dx = e.changedTouches[0].clientX - touchX;
      if (Math.abs(dx) > 50) show(index + (dx < 0 ? 1 : -1));
    });
  }

  // ----- Email: decoded on click so the address isn't sitting in the markup -----
  const emailBtn = document.getElementById('emailBtn');
  if (emailBtn) {
    const value = emailBtn.querySelector('span');
    const address = atob('amFja2xhbmNoZXN0ZXIyN0BnbWFpbC5jb20=');
    emailBtn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(address);
      } catch {
        window.location.href = `mailto:${address}`;
        return;
      }
      value.textContent = 'Copied';
      emailBtn.classList.add('is-copied');
      setTimeout(() => {
        value.textContent = 'Click to copy';
        emailBtn.classList.remove('is-copied');
      }, 2200);
    });
  }

  // ----- Footer ocean: layered sine waves that swell under the cursor -----
  const canvas = document.getElementById('ocean');
  if (canvas) {
    const ctx = canvas.getContext('2d');
    const waves = [
      { amp: 14, len: 0.011, speed: 0.9, base: 0.56, color: 'rgba(94, 224, 208, 0.07)' },
      { amp: 20, len: 0.0075, speed: 0.55, base: 0.64, color: 'rgba(94, 224, 208, 0.1)' },
      { amp: 26, len: 0.0052, speed: 0.32, base: 0.74, color: 'rgba(16, 52, 76, 0.9)' },
      { amp: 18, len: 0.004, speed: 0.2, base: 0.86, color: 'rgba(7, 19, 31, 1)' },
    ];
    let w = 0;
    let h = 0;
    let t = 0;
    let mx = 0.5;
    let my = 0.5;
    let targetX = 0.5;
    let targetY = 0.5;
    let raf = 0;
    let visible = false;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = canvas.getBoundingClientRect();
      w = rect.width;
      h = rect.height;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      mx += (targetX - mx) * 0.04;
      my += (targetY - my) * 0.04;
      const ampMul = 0.7 + (1 - my) * 0.8;
      waves.forEach((wv, i) => {
        ctx.beginPath();
        ctx.moveTo(0, h);
        for (let x = 0; x <= w + 8; x += 8) {
          const swell = 1 + 0.7 * Math.exp(-((x / w - mx) ** 2) / 0.02);
          const y = h * wv.base + Math.sin(x * wv.len + t * wv.speed + i * 1.7) * wv.amp * ampMul * swell;
          ctx.lineTo(x, y);
        }
        ctx.lineTo(w, h);
        ctx.closePath();
        ctx.fillStyle = wv.color;
        ctx.fill();
      });
      t += 0.016;
    };

    const loop = () => {
      draw();
      if (visible && !reduceMotion) raf = requestAnimationFrame(loop);
    };

    new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      cancelAnimationFrame(raf);
      if (visible) loop();
    }).observe(canvas);

    window.addEventListener('resize', () => {
      resize();
      draw();
    });
    canvas.parentElement.addEventListener('pointermove', (e) => {
      const rect = canvas.getBoundingClientRect();
      targetX = (e.clientX - rect.left) / rect.width;
      targetY = (e.clientY - rect.top) / rect.height;
    });

    resize();
    draw();
  }
})();
