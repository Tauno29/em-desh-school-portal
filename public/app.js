(() => {
  const header = document.querySelector('.site-header');
  const toggle = document.querySelector('.nav-toggle');
  const nav = document.getElementById('site-nav');
  const navLinks = nav ? Array.from(nav.querySelectorAll('a[href^="#"]')) : [];
  const navAllLinks = nav ? Array.from(nav.querySelectorAll('a')) : [];

  const setScrolled = () => {
    if (header) header.classList.toggle('is-scrolled', window.scrollY > 8);
  };
  setScrolled();
  window.addEventListener('scroll', setScrolled, { passive: true });

  const homepageNotice = document.getElementById('homepage-notice');
  const homepageNoticeText = document.getElementById('homepage-notice-text');
  const homepageNoticeLink = document.getElementById('homepage-notice-link');
  const homepageWelcomeVideo = document.getElementById('homepage-welcome-video');
  const homepageNews = document.getElementById('homepage-news');
  const homepageNewsCarousel = document.getElementById('homepage-news-carousel');
  const homepageNewsControls = document.getElementById('homepage-news-controls');
  const homepageNewsPosition = document.getElementById('homepage-news-position');
  const homepageNewsPrev = document.getElementById('homepage-news-prev');
  const homepageNewsNext = document.getElementById('homepage-news-next');

  let newsItems = [];
  let newsIndex = 0;

  function renderNews() {
    const item = newsItems[newsIndex];
    if (!item) return;
    const figure = document.createElement('figure');
    figure.className = 'news-card';
    const image = document.createElement('img');
    image.src = item.url;
    image.alt = item.caption || 'Recent school event at Em-Desh';
    image.loading = 'lazy';
    const caption = document.createElement('figcaption');
    caption.textContent = item.caption || 'Recent school event';
    figure.append(image, caption);
    homepageNewsCarousel.replaceChildren(figure);
    homepageNewsPosition.textContent = `${newsIndex + 1} / ${newsItems.length}`;
  }

  function showNews(index) {
    newsIndex = (index + newsItems.length) % newsItems.length;
    renderNews();
  }

  homepageNewsPrev?.addEventListener('click', () => showNews(newsIndex - 1));
  homepageNewsNext?.addEventListener('click', () => showNews(newsIndex + 1));

  async function loadHomepage() {
    try {
      const response = await fetch('/.netlify/functions/app/api/homepage', { headers: { accept: 'application/json' } });
      if (!response.ok) return;
      const data = await response.json();
      const settings = data.settings ?? {};
      if (settings.notificationEnabled && settings.notificationText) {
        homepageNoticeText.textContent = settings.notificationText;
        if (settings.notificationLinkText && settings.notificationLinkUrl) {
          homepageNoticeLink.textContent = settings.notificationLinkText;
          homepageNoticeLink.href = settings.notificationLinkUrl;
          homepageNoticeLink.hidden = false;
        }
        homepageNotice.hidden = false;
      }
      if (data.welcomeVideo?.url) {
        homepageWelcomeVideo.src = data.welcomeVideo.url;
        homepageWelcomeVideo.load();
      }
      newsItems = Array.isArray(data.news) ? data.news : [];
      if (newsItems.length) {
        homepageNews.hidden = false;
        homepageNewsControls.hidden = false;
        renderNews();
      }
    } catch {
      // The static hero and rest of the landing page remain usable offline.
    }
  }

  loadHomepage();

  const closeNav = () => {
    if (!toggle || !nav) return;
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-label', 'Open menu');
    nav.classList.remove('is-open');
  };

  if (toggle && nav) {
    toggle.addEventListener('click', () => {
      const open = toggle.getAttribute('aria-expanded') === 'true';
      toggle.setAttribute('aria-expanded', String(!open));
      toggle.setAttribute('aria-label', open ? 'Open menu' : 'Close menu');
      nav.classList.toggle('is-open', !open);
    });

    navAllLinks.forEach((link) => link.addEventListener('click', closeNav));

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && nav.classList.contains('is-open')) {
        closeNav();
        toggle.focus();
      }
    });

    window.addEventListener('resize', () => {
      if (window.innerWidth > 980) closeNav();
    });

    document.addEventListener('pointerdown', (event) => {
      if (!nav.classList.contains('is-open')) return;
      if (nav.contains(event.target) || toggle.contains(event.target)) return;
      closeNav();
    });
  }

  const reveals = Array.from(document.querySelectorAll('.reveal'));

  const revealCheck = () => {
    const limit = window.innerHeight * 0.94;
    reveals.forEach((el) => {
      if (el.classList.contains('is-visible')) return;
      if (el.getBoundingClientRect().top < limit) el.classList.add('is-visible');
    });
  };

  revealCheck();
  window.addEventListener('scroll', revealCheck, { passive: true });
  window.addEventListener('resize', revealCheck);

  const sections = Array.from(document.querySelectorAll('main section[id]'));
  if ('IntersectionObserver' in window && sections.length) {
    const navObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          navLinks.forEach((link) => {
            const current = link.getAttribute('href') === `#${entry.target.id}`;
            if (current) link.setAttribute('aria-current', 'true');
            else link.removeAttribute('aria-current');
          });
        });
      },
      { rootMargin: '-45% 0px -50% 0px' }
    );
    sections.forEach((section) => navObserver.observe(section));
  }

  const year = document.getElementById('year');
  if (year) year.textContent = String(new Date().getFullYear());
})();
