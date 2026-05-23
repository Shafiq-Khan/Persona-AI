(() => {
  const revealItems = document.querySelectorAll('.landing-strip article, .workflow-band');
  const header = document.querySelector('.site-header');
  const transition = document.querySelector('.page-transition');
  const preview = document.querySelector('.ai-product-preview');
  const stackButton = document.querySelector('.stack-button');
  const stackPanel = document.querySelector('#tech-stack-panel');
  const stackClose = document.querySelector('.stack-close');

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
      }
    });
  }, { threshold: 0.18 });

  revealItems.forEach((item) => observer.observe(item));

  window.addEventListener('scroll', () => {
    header.classList.toggle('is-scrolled', window.scrollY > 12);
  }, { passive: true });

  document.querySelectorAll('.chat-link').forEach((link) => {
    link.addEventListener('click', (event) => {
      const href = link.getAttribute('href');
      if (!href) return;
      event.preventDefault();
      transition.classList.add('is-active');
      setTimeout(() => {
        window.location.href = href;
      }, 360);
    });
  });

  if (preview) {
    preview.addEventListener('pointermove', (event) => {
      const rect = preview.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / rect.width - 0.5) * 8;
      const y = ((event.clientY - rect.top) / rect.height - 0.5) * -8;
      preview.style.setProperty('--tilt-x', `${y}deg`);
      preview.style.setProperty('--tilt-y', `${x}deg`);
    });

    preview.addEventListener('pointerleave', () => {
      preview.style.setProperty('--tilt-x', '0deg');
      preview.style.setProperty('--tilt-y', '0deg');
    });
  }

  function openStack() {
    stackPanel.hidden = false;
    requestAnimationFrame(() => {
      stackPanel.classList.add('is-open');
      stackButton.setAttribute('aria-expanded', 'true');
      stackPanel.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }

  function closeStack() {
    stackPanel.classList.remove('is-open');
    stackButton.setAttribute('aria-expanded', 'false');
    setTimeout(() => {
      stackPanel.hidden = true;
    }, 280);
  }

  if (stackButton && stackPanel && stackClose) {
    stackButton.addEventListener('click', () => {
      if (stackPanel.hidden) {
        openStack();
      } else {
        closeStack();
      }
    });

    stackClose.addEventListener('click', closeStack);
  }
})();
