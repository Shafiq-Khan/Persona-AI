(() => {
  const revealItems = document.querySelectorAll('.landing-strip article, .workflow-band');
  const header = document.querySelector('.site-header');
  const transition = document.querySelector('.page-transition');
  const preview = document.querySelector('.ai-product-preview');
  const stackButton = document.querySelector('.stack-button');
  const stackPanel = document.querySelector('#tech-stack-panel');
  const stackClose = document.querySelector('.stack-close');
  const supportButtons = document.querySelectorAll('.support-button');

  if (revealItems.length) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
        }
      });
    }, { threshold: 0.18 });

    revealItems.forEach((item) => observer.observe(item));
  }

  window.addEventListener('scroll', () => {
    if (header) {
      header.classList.toggle('is-scrolled', window.scrollY > 12);
    }
  }, { passive: true });

  document.querySelectorAll('.chat-link').forEach((link) => {
    link.addEventListener('click', (event) => {
      const href = link.getAttribute('href');
      if (!href) return;
      event.preventDefault();
      if (transition) {
        transition.classList.add('is-active');
      }
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

  function createSupportModal() {
    const modal = document.createElement('div');
    modal.className = 'support-modal';
    modal.setAttribute('aria-hidden', 'true');
    modal.innerHTML = `
      <div class="support-card" role="dialog" aria-modal="true" aria-label="Support the creator">
        <button class="support-close" type="button" aria-label="Close support modal">Close</button>
        <div class="support-glow"></div>
        <p class="hero-kicker">Support the creator</p>
        <h2>Keep Persona AI free</h2>
        <p class="support-copy">If this project helps you, you can support the creator with UPI. Scan the QR code below.</p>
        <div class="qr-frame">
          <img src="assets/upi-qr.png" alt="UPI QR code for supporting the creator" onerror="this.style.display='none'" />
          <div class="qr-placeholder">
            <strong>UPI QR</strong>
            <span>Add your image at assets/upi-qr.png</span>
          </div>
        </div>
        <p class="support-note">Thank you for helping this free AI project grow.</p>
      </div>
    `;
    document.body.appendChild(modal);
    return modal;
  }

  const supportModal = supportButtons.length ? createSupportModal() : null;
  const supportClose = supportModal?.querySelector('.support-close');

  function openSupport() {
    supportModal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('support-open');
  }

  function closeSupport() {
    supportModal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('support-open');
  }

  supportButtons.forEach((button) => {
    button.addEventListener('click', openSupport);
  });

  supportClose?.addEventListener('click', closeSupport);

  supportModal?.addEventListener('click', (event) => {
    if (event.target === supportModal) {
      closeSupport();
    }
  });

  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && supportModal?.getAttribute('aria-hidden') === 'false') {
      closeSupport();
    }
  });
})();
