const body = document.body;
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');

// Finish the branded intro quickly, with a fallback in case an asset is slow.
let loaderFinished = false;
const finishLoader = () => {
  if (loaderFinished) return;
  loaderFinished = true;
  body.classList.add('site-ready');
};
if (document.readyState === 'complete') {
  setTimeout(finishLoader, 850);
} else {
  addEventListener('load', () => setTimeout(finishLoader, 850), { once: true });
}
setTimeout(finishLoader, 1800);

const menu = document.querySelector('.menu');
const nav = document.querySelector('.links');
if (menu && nav) {
  menu.addEventListener('click', () => {
    const expanded = menu.getAttribute('aria-expanded') !== 'true';
    menu.setAttribute('aria-expanded', String(expanded));
    nav.classList.toggle('open', expanded);
  });
  nav.querySelectorAll('a').forEach(link => link.addEventListener('click', () => {
    menu.setAttribute('aria-expanded', 'false');
    nav.classList.remove('open');
  }));
}

const year = document.getElementById('year');
if (year) year.textContent = new Date().getFullYear();

document.querySelectorAll('[data-filter]').forEach(button => button.addEventListener('click', () => {
  const filter = button.dataset.filter;
  document.querySelectorAll('[data-filter]').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
  let visible = 0;
  document.querySelectorAll('.gallery-card').forEach(card => {
    card.hidden = filter !== 'all' && card.dataset.category !== filter;
    if (!card.hidden) visible += 1;
  });
  const status = document.getElementById('gallery-status');
  if (status) status.textContent = `Showing ${visible} concept${visible === 1 ? '' : 's'}`;
}));

const form = document.querySelector('.enquiry-form');
if (form) {
  form.querySelectorAll('input[type=tel]').forEach(input => input.addEventListener('input', () => {
    const value = input.value.trim();
    const digits = value.replace(/\D/g, '');
    const invalid = value && (!/^[+()0-9 .-]+$/.test(value) || digits.length < 7 || digits.length > 15);
    input.setCustomValidity(invalid ? 'Enter a phone number with 7 to 15 digits.' : '');
  }));
  form.addEventListener('submit', event => {
    for (const input of form.querySelectorAll('input[required]')) {
      if (!input.value.trim()) {
        input.value = '';
        event.preventDefault();
        input.reportValidity();
        break;
      }
    }
  });
}

(() => {
  const header = document.querySelector('header');
  const root = document.documentElement;
  const finePointer = matchMedia('(pointer: fine)');

  const markHeader = () => header?.classList.toggle('scrolled', scrollY > 20);
  addEventListener('scroll', markHeader, { passive: true });
  markHeader();

  const filename = location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.links a').forEach(link => {
    if (link.getAttribute('href') === filename) link.setAttribute('aria-current', 'page');
  });

  const revealItems = document.querySelectorAll(
    '.section-top,.service,.step,.planning-grid article,.inspiration-card,.gallery-card,.about-grid,.faq-grid,.visit-grid,.contact-grid,.enquiry-grid,.home-cta'
  );
  revealItems.forEach((element, index) => {
    element.classList.add('reveal-ready');
    element.style.setProperty('--reveal-delay', `${(index % 4) * 70}ms`);
  });

  if (!reduceMotion.matches && 'IntersectionObserver' in window) {
    const revealObserver = new IntersectionObserver(entries => entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        revealObserver.unobserve(entry.target);
      }
    }), { threshold: 0.08, rootMargin: '0px 0px -5% 0px' });
    revealItems.forEach(element => revealObserver.observe(element));
    reduceMotion.addEventListener('change', () => {
      if (reduceMotion.matches) {
        revealObserver.disconnect();
        revealItems.forEach(element => element.classList.add('is-visible'));
      }
    });
  } else {
    revealItems.forEach(element => element.classList.add('is-visible'));
  }

  const floatingEstimate = document.querySelector('.estimate-float');
  const footer = document.querySelector('footer');
  if (floatingEstimate && footer && 'IntersectionObserver' in window) {
    new IntersectionObserver(entries => {
      floatingEstimate.classList.toggle('footer-in-view', entries[0].isIntersecting);
    }, { threshold: 0.05 }).observe(footer);
  }

  const parallaxImages = [...document.querySelectorAll('.visual img,.inspiration-card img,.gallery-art img,.banner-img')];
  let parallaxFrame = 0;
  const updateParallax = () => {
    parallaxFrame = 0;
    if (reduceMotion.matches || innerWidth < 761) return;
    parallaxImages.forEach((image, index) => {
      const rect = image.parentElement.getBoundingClientRect();
      if (rect.bottom < 0 || rect.top > innerHeight) return;
      const centerOffset = (innerHeight / 2 - (rect.top + rect.height / 2)) / innerHeight;
      const depth = index === 0 ? 34 : 22;
      image.style.setProperty('--parallax-y', `${(centerOffset * depth).toFixed(2)}px`);
    });
  };
  const requestParallax = () => {
    if (!parallaxFrame) parallaxFrame = requestAnimationFrame(updateParallax);
  };
  addEventListener('scroll', requestParallax, { passive: true });
  addEventListener('resize', requestParallax, { passive: true });
  requestParallax();

  if (!reduceMotion.matches && finePointer.matches) {
    document.querySelectorAll('.visual,.gallery-art,.visit-info').forEach(surface => {
      surface.classList.add('motion-surface');
      surface.addEventListener('pointermove', event => {
        const rect = surface.getBoundingClientRect();
        const x = (event.clientX - rect.left) / rect.width;
        const y = (event.clientY - rect.top) / rect.height;
        surface.style.setProperty('--tilt-x', `${((0.5 - y) * 4).toFixed(2)}deg`);
        surface.style.setProperty('--tilt-y', `${((x - 0.5) * 5).toFixed(2)}deg`);
        surface.style.setProperty('--glow-x', `${(x * 100).toFixed(1)}%`);
        surface.style.setProperty('--glow-y', `${(y * 100).toFixed(1)}%`);
      });
      surface.addEventListener('pointerleave', () => {
        surface.style.setProperty('--tilt-x', '0deg');
        surface.style.setProperty('--tilt-y', '0deg');
        surface.style.setProperty('--glow-x', '50%');
        surface.style.setProperty('--glow-y', '50%');
      });
    });

    document.querySelectorAll('.button').forEach(button => {
      button.addEventListener('pointermove', event => {
        const rect = button.getBoundingClientRect();
        button.style.setProperty('--button-x', `${((event.clientX - rect.left) / rect.width - 0.5) * 5}px`);
        button.style.setProperty('--button-y', `${((event.clientY - rect.top) / rect.height - 0.5) * 4}px`);
      });
      button.addEventListener('pointerleave', () => {
        button.style.setProperty('--button-x', '0px');
        button.style.setProperty('--button-y', '0px');
      });
    });
  }

  let scrollFrame = 0;
  let target = scrollY;
  let last = 0;
  const stopScroll = () => {
    cancelAnimationFrame(scrollFrame);
    scrollFrame = 0;
    root.classList.remove('flow-scrolling');
    target = scrollY;
  };
  const tick = time => {
    const deltaTime = Math.min(40, time - last || 16);
    last = time;
    const maximum = Math.max(0, root.scrollHeight - innerHeight);
    target = Math.max(0, Math.min(maximum, target));
    const distance = target - scrollY;
    if (Math.abs(distance) < 0.7) {
      scrollTo(0, target);
      stopScroll();
      return;
    }
    scrollTo(0, scrollY + distance * (1 - Math.exp(-deltaTime / 95)));
    scrollFrame = requestAnimationFrame(tick);
  };
  addEventListener('wheel', event => {
    if (reduceMotion.matches || !finePointer.matches || event.ctrlKey || event.metaKey || event.shiftKey || Math.abs(event.deltaX) > Math.abs(event.deltaY) || !event.cancelable) return;
    const element = event.target instanceof Element ? event.target : null;
    if (element?.closest('input,textarea,select,[contenteditable=true],dialog')) return;
    for (let parent = element; parent && parent !== document.body; parent = parent.parentElement) {
      if (/auto|scroll/.test(getComputedStyle(parent).overflowY) && parent.scrollHeight > parent.clientHeight + 1) return;
    }
    if (!event.deltaY) return;
    event.preventDefault();
    if (!scrollFrame) target = scrollY;
    const amount = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? innerHeight : 1);
    target = Math.max(0, Math.min(root.scrollHeight - innerHeight, target + amount));
    if (!scrollFrame) {
      root.classList.add('flow-scrolling');
      last = performance.now();
      scrollFrame = requestAnimationFrame(tick);
    }
  }, { passive: false });
  ['pointerdown', 'touchstart', 'keydown'].forEach(type => addEventListener(type, stopScroll, { passive: true }));
  addEventListener('pagehide', stopScroll);
  reduceMotion.addEventListener('change', stopScroll);
})();
