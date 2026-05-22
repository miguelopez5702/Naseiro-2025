/**
 * Naseiro 2025 — Cinematic Photo Carousel & Gallery
 * Core Application Logic (Vanilla JS)
 */

document.addEventListener('DOMContentLoaded', () => {
  
  // ==========================================================================
  // 1. STATE MANAGEMENT
  // ==========================================================================
  
  const state = {
    media: [],             // All parsed media objects
    filteredMedia: [],     // Media after search & category filters
    favorites: new Set(),  // Set of favorited filenames (persisted)
    
    // 3D Carousel
    highlights: [],        // Sub-selection of files for 3D Carousel
    activeHighlightIndex: 0,
    
    // Lightbox / Slideshow
    activeLightboxIndex: -1,
    isSlideshowPlaying: false,
    slideshowInterval: 3000, // default 3s
    slideshowTimer: null,
    slideshowProgress: 0,
    slideshowLastTick: 0,
    
    // Filters
    currentFilter: 'all',  // 'all', 'photos', 'videos', 'favorites'
    searchQuery: '',
  };

  // Parse files from media-list.js
  function initMediaData() {
    if (typeof NASEIRO_MEDIA === 'undefined') {
      console.error("No se pudo cargar la lista de medios (NASEIRO_MEDIA).");
      return;
    }
    
    state.media = NASEIRO_MEDIA.map((filename, index) => {
      const isVideo = filename.toLowerCase().endsWith('.mp4');
      const cleanName = filename.split('.')[0];
      
      // Extract numeric part of filename to make nice titles
      const matchNum = cleanName.match(/\d+/);
      const numberLabel = matchNum ? `#${matchNum[0]}` : `#${index + 1}`;
      const title = isVideo ? `Vídeo de Naseiro ${numberLabel}` : `Recuerdo de Naseiro ${numberLabel}`;
      
      return {
        id: index,
        filename: filename,
        path: `Naseiro 2025/${filename}`,
        isVideo: isVideo,
        title: title,
        date: isVideo ? 'Agosto 2025 (Clip)' : 'Agosto 2025'
      };
    });
    
    state.filteredMedia = [...state.media];
    
    // Load favorites from LocalStorage
    const storedFavs = localStorage.getItem('naseiro_favorites');
    if (storedFavs) {
      try {
        const parsed = JSON.parse(storedFavs);
        parsed.forEach(f => state.favorites.add(f));
      } catch (e) {
        console.error("Error al cargar favoritos", e);
      }
    }
    
    updateFavoritesBadge();
    
    // Generate highlights for the 3D Carousel
    // We want a good variety (some videos, some images, distributed evenly)
    const highlightStep = Math.max(1, Math.floor(state.media.length / 8));
    state.highlights = [];
    for (let i = 0; i < state.media.length && state.highlights.length < 8; i += highlightStep) {
      state.highlights.push(state.media[i]);
    }
    // Make sure we have at least some items in highlights if division was off
    if (state.highlights.length === 0 && state.media.length > 0) {
      state.highlights = state.media.slice(0, 5);
    }
  }

  // ==========================================================================
  // 2. DOM ELEMENTS
  // ==========================================================================
  
  const DOM = {
    // Nav & Header
    header: document.querySelector('.main-header'),
    navBtns: document.querySelectorAll('.nav-btn'),
    favCount: document.getElementById('fav-count'),
    navFavsBtn: document.getElementById('nav-favs-btn'),
    
    // Hero & Navigation Targets
    homeSection: document.getElementById('home-section'),
    gallerySection: document.getElementById('gallery-section'),
    heroQuickSlideshow: document.getElementById('hero-quick-slideshow'),
    
    // 3D Carousel
    carouselTrack: document.getElementById('carousel-3d-track'),
    carouselPrev: document.getElementById('carousel-prev'),
    carouselNext: document.getElementById('carousel-next'),
    carouselDots: document.getElementById('carousel-dots-container'),
    
    // Grid Gallery
    galleryGrid: document.getElementById('gallery-grid'),
    filterBtns: document.querySelectorAll('.filter-btn'),
    gallerySearch: document.getElementById('gallery-search'),
    searchClearBtn: document.getElementById('search-clear-btn'),
    itemsCountDisplay: document.getElementById('items-count-display'),
    galleryEmptyState: document.getElementById('gallery-empty-state'),
    btnResetFilters: document.getElementById('btn-reset-filters'),
    
    // Lightbox
    lightbox: document.getElementById('lightbox-modal'),
    lightboxMedia: document.getElementById('lightbox-media-container'),
    lightboxCounter: document.getElementById('lightbox-counter'),
    lightboxFilename: document.getElementById('lightbox-filename'),
    lightboxClose: document.getElementById('lightbox-close-btn'),
    lightboxPrev: document.getElementById('lightbox-prev'),
    lightboxNext: document.getElementById('lightbox-next'),
    lightboxFav: document.getElementById('lightbox-fav-btn'),
    lightboxSlideshow: document.getElementById('lightbox-slideshow-toggle'),
    lightboxSlideshowIcon: document.getElementById('slideshow-icon'),
    slideshowSpeedContainer: document.getElementById('slideshow-speed-container'),
    lightboxProgress: document.getElementById('lightbox-progress-fill'),
    lightboxFullscreen: document.getElementById('lightbox-fullscreen-btn'),
    lightboxDownload: document.getElementById('lightbox-download-btn'),
    
    // Favorites Drawer
    favDrawer: document.getElementById('favorites-drawer'),
    closeDrawer: document.getElementById('close-drawer-btn'),
    drawerList: document.getElementById('drawer-favorites-list'),
    drawerOverlay: document.getElementById('drawer-overlay'),
    clearAllFavs: document.getElementById('clear-all-favorites'),
  };

  // ==========================================================================
  // 3. INITIALIZATION
  // ==========================================================================
  
  function init() {
    initMediaData();
    
    // Render Components
    render3DCarousel();
    renderGallery();
    
    // Bind Event Listeners
    bindEvents();
    
    // Init Lucide Icons
    lucide.createIcons();
    
    // Initial UI Updates
    update3DCarouselPosition();
    updateGalleryStats();
  }

  // ==========================================================================
  // 4. EVENT BINDING
  // ==========================================================================
  
  function bindEvents() {
    // Header background change on scroll
    window.addEventListener('scroll', () => {
      if (window.scrollY > 50) {
        DOM.header.classList.add('scrolled');
      } else {
        DOM.header.classList.remove('scrolled');
      }
    });

    // Navigation buttons scroll integration
    DOM.navBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const targetId = btn.getAttribute('data-target');
        if (targetId) {
          const targetSection = document.getElementById(targetId);
          if (targetSection) {
            targetSection.scrollIntoView({ behavior: 'smooth' });
            DOM.navBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
          }
        }
      });
    });

    // Quick full slideshow from hero
    if (DOM.heroQuickSlideshow) {
      DOM.heroQuickSlideshow.addEventListener('click', () => {
        openLightbox(0);
        startSlideshow();
      });
    }

    // 3D Carousel Nav
    DOM.carouselPrev.addEventListener('click', prevHighlight);
    DOM.carouselNext.addEventListener('click', nextHighlight);
    
    // Grid Gallery Filters
    DOM.filterBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        DOM.filterBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.currentFilter = btn.getAttribute('data-filter');
        applyFilters();
      });
    });

    // Grid Gallery Search
    DOM.gallerySearch.addEventListener('input', (e) => {
      state.searchQuery = e.target.value.trim().toLowerCase();
      if (state.searchQuery.length > 0) {
        DOM.searchClearBtn.style.display = 'block';
      } else {
        DOM.searchClearBtn.style.display = 'none';
      }
      applyFilters();
    });

    DOM.searchClearBtn.addEventListener('click', () => {
      DOM.gallerySearch.value = '';
      state.searchQuery = '';
      DOM.searchClearBtn.style.display = 'none';
      applyFilters();
    });

    DOM.btnResetFilters.addEventListener('click', () => {
      DOM.gallerySearch.value = '';
      state.searchQuery = '';
      DOM.searchClearBtn.style.display = 'none';
      state.currentFilter = 'all';
      DOM.filterBtns.forEach(b => {
        if (b.getAttribute('data-filter') === 'all') b.classList.add('active');
        else b.classList.remove('active');
      });
      applyFilters();
    });

    // Lightbox actions
    DOM.lightboxClose.addEventListener('click', closeLightbox);
    DOM.lightboxPrev.addEventListener('click', navigateLightboxPrev);
    DOM.lightboxNext.addEventListener('click', navigateLightboxNext);
    DOM.lightboxFav.addEventListener('click', toggleLightboxFavorite);
    DOM.lightboxSlideshow.addEventListener('click', toggleSlideshow);
    
    DOM.slideshowSpeedContainer.addEventListener('click', (e) => {
      const speedBtn = e.target.closest('.speed-btn');
      if (speedBtn) {
        DOM.slideshowSpeedContainer.querySelectorAll('.speed-btn').forEach(b => b.classList.remove('active'));
        speedBtn.classList.add('active');
        state.slideshowInterval = parseInt(speedBtn.getAttribute('data-speed'), 10);
        if (state.isSlideshowPlaying) {
          // Restart countdown with new interval
          state.slideshowProgress = 0;
          state.slideshowLastTick = performance.now();
        }
      }
    });

    DOM.lightboxFullscreen.addEventListener('click', toggleFullscreen);

    // Keyboard support in Lightbox
    document.addEventListener('keydown', (e) => {
      if (DOM.lightbox.classList.contains('active')) {
        if (e.key === 'Escape') closeLightbox();
        if (e.key === 'ArrowRight') navigateLightboxNext();
        if (e.key === 'ArrowLeft') navigateLightboxPrev();
        if (e.key === ' ') {
          e.preventDefault();
          toggleSlideshow();
        }
      }
    });

    // Touch gesture support in Lightbox (swiping)
    let touchStartX = 0;
    let touchEndX = 0;
    
    DOM.lightbox.addEventListener('touchstart', (e) => {
      touchStartX = e.changedTouches[0].screenX;
    }, { passive: true });
    
    DOM.lightbox.addEventListener('touchend', (e) => {
      touchEndX = e.changedTouches[0].screenX;
      handleLightboxSwipe();
    }, { passive: true });

    function handleLightboxSwipe() {
      const threshold = 50;
      if (touchEndX < touchStartX - threshold) {
        navigateLightboxNext(); // swiped left
      }
      if (touchEndX > touchStartX + threshold) {
        navigateLightboxPrev(); // swiped right
      }
    }

    // Touch / drag support on 3D Carousel
    let carouselDragStart = 0;
    let carouselDragEnd = 0;
    let isDraggingCarousel = false;

    DOM.carouselTrack.addEventListener('mousedown', (e) => {
      isDraggingCarousel = true;
      carouselDragStart = e.clientX;
    });

    document.addEventListener('mouseup', (e) => {
      if (isDraggingCarousel) {
        carouselDragEnd = e.clientX;
        isDraggingCarousel = false;
        handleCarouselSwipe();
      }
    });

    DOM.carouselTrack.addEventListener('touchstart', (e) => {
      carouselDragStart = e.changedTouches[0].clientX;
    }, { passive: true });

    DOM.carouselTrack.addEventListener('touchend', (e) => {
      carouselDragEnd = e.changedTouches[0].clientX;
      handleCarouselSwipe();
    }, { passive: true });

    function handleCarouselSwipe() {
      const threshold = 40;
      if (carouselDragEnd < carouselDragStart - threshold) {
        nextHighlight();
      } else if (carouselDragEnd > carouselDragStart + threshold) {
        prevHighlight();
      }
    }

    // Favorites Drawer Toggle
    DOM.navFavsBtn.addEventListener('click', openFavoritesDrawer);
    DOM.closeDrawer.addEventListener('click', closeFavoritesDrawer);
    DOM.drawerOverlay.addEventListener('click', closeFavoritesDrawer);
    DOM.clearAllFavs.addEventListener('click', clearAllFavorites);
  }

  // ==========================================================================
  // 5. 3D HIGHLIGHTS CAROUSEL (Coverflow Implementation)
  // ==========================================================================
  
  function render3DCarousel() {
    DOM.carouselTrack.innerHTML = '';
    DOM.carouselDots.innerHTML = '';
    
    state.highlights.forEach((item, index) => {
      // Create card
      const card = document.createElement('div');
      card.className = `carousel-card-3d ${index === state.activeHighlightIndex ? 'active' : ''}`;
      card.setAttribute('data-index', index);
      
      // Card inner content
      const badgeIcon = item.isVideo ? 'video' : 'image';
      card.innerHTML = `
        <div class="card-badge"><i data-lucide="${badgeIcon}"></i></div>
        ${item.isVideo 
          ? `<video src="${item.path}" loop muted playsinline></video>` 
          : `<img src="${item.path}" alt="${item.title}" loading="lazy">`
        }
        <div class="card-info">
          <h4>${item.title}</h4>
          <p>${item.isVideo ? 'Haz clic para reproducir' : 'Ver momento'}</p>
        </div>
      `;
      
      // Click event
      card.addEventListener('click', () => {
        if (index === state.activeHighlightIndex) {
          // Open in Lightbox
          const mediaIndexInFull = state.media.findIndex(m => m.filename === item.filename);
          if (mediaIndexInFull !== -1) {
            openLightbox(mediaIndexInFull);
          }
        } else {
          // Jump to this card in 3D carousel
          state.activeHighlightIndex = index;
          update3DCarouselPosition();
        }
      });
      
      DOM.carouselTrack.appendChild(card);
      
      // Dot
      const dot = document.createElement('span');
      dot.className = `dot ${index === state.activeHighlightIndex ? 'active' : ''}`;
      dot.addEventListener('click', () => {
        state.activeHighlightIndex = index;
        update3DCarouselPosition();
      });
      DOM.carouselDots.appendChild(dot);
    });
  }

  function update3DCarouselPosition() {
    const cards = DOM.carouselTrack.querySelectorAll('.carousel-card-3d');
    const dots = DOM.carouselDots.querySelectorAll('.dot');
    
    cards.forEach((card, index) => {
      card.classList.remove('active');
      const video = card.querySelector('video');
      if (video) {
        video.pause();
      }
      
      const offset = index - state.activeHighlightIndex;
      const absOffset = Math.abs(offset);
      
      // Visual variables based on how far the card is from the center active card
      let tx = offset * 130;  // translation X
      let tz = -absOffset * 150; // translation Z (deeper into screen)
      let ry = -offset * 32;   // rotation Y (angled outwards)
      let scale = 1 - absOffset * 0.12; // smaller size
      
      // Depth sorting
      let zIndex = 10 - absOffset;
      let opacity = 1 - absOffset * 0.28;
      
      // Cap extremes
      if (absOffset > 2) {
        opacity = 0;
        card.style.pointerEvents = 'none';
      } else {
        card.style.pointerEvents = 'all';
      }
      
      // Apply transforms
      card.style.transform = `translateX(${tx}px) translateZ(${tz}px) rotateY(${ry}deg) scale(${scale})`;
      card.style.zIndex = zIndex;
      card.style.opacity = opacity;
      
      if (offset === 0) {
        card.classList.add('active');
        card.style.filter = 'none';
        // Auto-play video loop in 3D carousel if center item is video
        if (video) {
          video.play().catch(e => console.log("Video autoplay blocked in carousel", e));
        }
      } else {
        card.style.filter = 'brightness(0.55) contrast(0.9)';
      }
    });
    
    // Update dots
    dots.forEach((dot, index) => {
      if (index === state.activeHighlightIndex) {
        dot.classList.add('active');
      } else {
        dot.classList.remove('active');
      }
    });
  }

  function nextHighlight() {
    state.activeHighlightIndex = (state.activeHighlightIndex + 1) % state.highlights.length;
    update3DCarouselPosition();
  }

  function prevHighlight() {
    state.activeHighlightIndex = (state.activeHighlightIndex - 1 + state.highlights.length) % state.highlights.length;
    update3DCarouselPosition();
  }

  // ==========================================================================
  // 6. GALLERY GRID (Lazy Loading & Filters)
  // ==========================================================================
  
  function renderGallery() {
    DOM.galleryGrid.innerHTML = '';
    
    if (state.filteredMedia.length === 0) {
      DOM.galleryEmptyState.style.display = 'block';
      DOM.galleryGrid.style.display = 'none';
      return;
    }
    
    DOM.galleryEmptyState.style.display = 'none';
    DOM.galleryGrid.style.display = 'grid';
    
    state.filteredMedia.forEach((item) => {
      const card = document.createElement('div');
      card.className = 'media-card';
      card.setAttribute('data-id', item.id);
      
      const badgeIcon = item.isVideo ? 'video' : 'image';
      const isFav = state.favorites.has(item.filename);
      
      card.innerHTML = `
        <button class="media-card-favorite-btn ${isFav ? 'favorited' : ''}" title="Me gusta">
          <i data-lucide="heart"></i>
        </button>
        <div class="media-badge"><i data-lucide="${badgeIcon}"></i></div>
        
        ${item.isVideo 
          ? `<video src="${item.path}" preload="metadata" muted playsinline></video>` 
          : `<img src="${item.path}" alt="${item.title}" loading="lazy">`
        }
        
        <div class="media-overlay">
          <h4>${item.title}</h4>
          <p>${item.date}</p>
        </div>
      `;
      
      // Open in Lightbox on click
      card.addEventListener('click', (e) => {
        // Prevent click if clicking heart
        if (e.target.closest('.media-card-favorite-btn')) {
          e.stopPropagation();
          toggleFavorite(item.filename, card.querySelector('.media-card-favorite-btn'));
          return;
        }
        
        // Find exact index of the media item in the unfiltered array
        const mainIndex = state.media.findIndex(m => m.id === item.id);
        if (mainIndex !== -1) {
          openLightbox(mainIndex);
        }
      });
      
      DOM.galleryGrid.appendChild(card);
    });
    
    lucide.createIcons();
  }

  function applyFilters() {
    state.filteredMedia = state.media.filter(item => {
      // 1. Search filter
      const matchesSearch = item.title.toLowerCase().includes(state.searchQuery) || 
                            item.filename.toLowerCase().includes(state.searchQuery);
      
      if (!matchesSearch) return false;
      
      // 2. Category filter
      if (state.currentFilter === 'photos') return !item.isVideo;
      if (state.currentFilter === 'videos') return item.isVideo;
      if (state.currentFilter === 'favorites') return state.favorites.has(item.filename);
      
      return true;
    });
    
    renderGallery();
    updateGalleryStats();
  }

  function updateGalleryStats() {
    DOM.itemsCountDisplay.textContent = `${state.filteredMedia.length} de ${state.media.length}`;
  }

  // ==========================================================================
  // 7. IMMERSIVE LIGHTBOX & SMOOTH SLIDESHOW
  // ==========================================================================
  
  function openLightbox(index) {
    state.activeLightboxIndex = index;
    DOM.lightbox.classList.add('active');
    document.body.style.overflow = 'hidden'; // freeze background scroll
    
    renderLightboxContent();
  }

  function closeLightbox() {
    stopSlideshow();
    DOM.lightbox.classList.remove('active');
    document.body.style.overflow = ''; // restore background scroll
    
    // Pause any playing videos inside lightbox
    const video = DOM.lightboxMedia.querySelector('video');
    if (video) video.pause();
    
    // Refresh favorites buttons on gallery grid in case they were changed in lightbox
    applyFilters();
  }

  function renderLightboxContent() {
    const item = state.media[state.activeLightboxIndex];
    if (!item) return;
    
    DOM.lightboxMedia.innerHTML = '';
    
    // Set text meta
    DOM.lightboxCounter.textContent = `${state.activeLightboxIndex + 1} / ${state.media.length}`;
    DOM.lightboxFilename.textContent = item.filename;
    DOM.lightboxDownload.href = item.path;
    DOM.lightboxDownload.setAttribute('download', item.filename);
    
    // Setup favorite heart
    const isFav = state.favorites.has(item.filename);
    if (isFav) {
      DOM.lightboxFav.classList.add('favorited');
    } else {
      DOM.lightboxFav.classList.remove('favorited');
    }
    
    // Create media element
    let mediaEl;
    if (item.isVideo) {
      mediaEl = document.createElement('video');
      mediaEl.src = item.path;
      mediaEl.controls = true;
      mediaEl.autoplay = true;
      mediaEl.playsInline = true;
      
      // Pause slideshow autoplay while video is playing, resume when ended
      mediaEl.addEventListener('play', () => {
        if (state.isSlideshowPlaying) {
          // Pause visual timer but keep the state
          DOM.lightboxProgress.style.backgroundColor = 'var(--accent-green)';
        }
      });
      
      mediaEl.addEventListener('ended', () => {
        if (state.isSlideshowPlaying) {
          DOM.lightboxProgress.style.backgroundColor = 'var(--accent-gold)';
          navigateLightboxNext(); // jump immediately after video finishes
        }
      });
    } else {
      mediaEl = document.createElement('img');
      mediaEl.src = item.path;
      mediaEl.alt = item.title;
    }
    
    // Fade in effect once media is fully loaded
    mediaEl.className = 'lightbox-media-el';
    mediaEl.addEventListener(item.isVideo ? 'loadeddata' : 'load', () => {
      mediaEl.classList.add('loaded');
    });
    
    DOM.lightboxMedia.appendChild(mediaEl);
    lucide.createIcons();
    
    // Reset slideshow progress for this item
    state.slideshowProgress = 0;
    state.slideshowLastTick = performance.now();
  }

  function navigateLightboxNext() {
    if (state.media.length === 0) return;
    state.activeLightboxIndex = (state.activeLightboxIndex + 1) % state.media.length;
    renderLightboxContent();
  }

  function navigateLightboxPrev() {
    if (state.media.length === 0) return;
    state.activeLightboxIndex = (state.activeLightboxIndex - 1 + state.media.length) % state.media.length;
    renderLightboxContent();
  }

  // Favorites in Lightbox
  function toggleLightboxFavorite() {
    const item = state.media[state.activeLightboxIndex];
    if (!item) return;
    
    toggleFavorite(item.filename);
    
    const isFav = state.favorites.has(item.filename);
    if (isFav) {
      DOM.lightboxFav.classList.add('favorited');
    } else {
      DOM.lightboxFav.classList.remove('favorited');
    }
    
    // Sync with sidebar
    renderFavoritesDrawer();
  }

  // --- Fluid RequestAnimationFrame Slideshow ---
  function slideshowLoop(timestamp) {
    if (!state.isSlideshowPlaying) return;
    
    const elapsed = timestamp - state.slideshowLastTick;
    state.slideshowLastTick = timestamp;
    
    // Check if video is playing in lightbox. If yes, pause countdown.
    const video = DOM.lightboxMedia.querySelector('video');
    const isVideoPlaying = video && !video.paused && !video.ended;
    
    if (!isVideoPlaying) {
      state.slideshowProgress += elapsed;
      const percent = Math.min(100, (state.slideshowProgress / state.slideshowInterval) * 100);
      DOM.lightboxProgress.style.width = `${percent}%`;
      
      if (state.slideshowProgress >= state.slideshowInterval) {
        state.slideshowProgress = 0;
        navigateLightboxNext();
      }
    }
    
    state.slideshowTimer = requestAnimationFrame(slideshowLoop);
  }

  function startSlideshow() {
    state.isSlideshowPlaying = true;
    DOM.lightboxSlideshowIcon.setAttribute('data-lucide', 'pause');
    DOM.lightboxSlideshow.setAttribute('title', 'Pausar presentación');
    
    state.slideshowProgress = 0;
    state.slideshowLastTick = performance.now();
    state.slideshowTimer = requestAnimationFrame(slideshowLoop);
    
    lucide.createIcons();
  }

  function stopSlideshow() {
    state.isSlideshowPlaying = false;
    DOM.lightboxSlideshowIcon.setAttribute('data-lucide', 'play');
    DOM.lightboxSlideshow.setAttribute('title', 'Iniciar presentación');
    
    if (state.slideshowTimer) {
      cancelAnimationFrame(state.slideshowTimer);
      state.slideshowTimer = null;
    }
    DOM.lightboxProgress.style.width = '0%';
    lucide.createIcons();
  }

  function toggleSlideshow() {
    if (state.isSlideshowPlaying) {
      stopSlideshow();
    } else {
      startSlideshow();
    }
  }

  // Fullscreen toggle helper
  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      DOM.lightbox.requestFullscreen().catch(err => {
        console.error(`Error al habilitar pantalla completa: ${err.message}`);
      });
    } else {
      document.exitFullscreen();
    }
  }

  // ==========================================================================
  // 8. FAVORITES LOGIC & SIDEBAR DRAWER
  // ==========================================================================
  
  function toggleFavorite(filename, buttonEl = null) {
    if (state.favorites.has(filename)) {
      state.favorites.delete(filename);
      if (buttonEl) buttonEl.classList.remove('favorited');
    } else {
      state.favorites.add(filename);
      if (buttonEl) buttonEl.classList.add('favorited');
    }
    
    // Save to LocalStorage
    localStorage.setItem('naseiro_favorites', JSON.stringify(Array.from(state.favorites)));
    
    // Update visuals
    updateFavoritesBadge();
    renderFavoritesDrawer();
  }

  function updateFavoritesBadge() {
    const count = state.favorites.size;
    DOM.favCount.textContent = count;
    
    if (count > 0) {
      DOM.favCount.style.transform = 'scale(1.2)';
      setTimeout(() => DOM.favCount.style.transform = 'scale(1)', 200);
    }
  }

  function openFavoritesDrawer() {
    renderFavoritesDrawer();
    DOM.favDrawer.classList.add('active');
  }

  function closeFavoritesDrawer() {
    DOM.favDrawer.classList.remove('active');
  }

  function renderFavoritesDrawer() {
    DOM.drawerList.innerHTML = '';
    
    if (state.favorites.size === 0) {
      DOM.drawerList.innerHTML = `
        <div class="drawer-empty-state">
          <i data-lucide="heart-off"></i>
          <p>No has guardado favoritos todavía.</p>
        </div>
      `;
      lucide.createIcons();
      return;
    }
    
    // Render list of favorited cards
    state.media.forEach(item => {
      if (state.favorites.has(item.filename)) {
        const itemEl = document.createElement('div');
        itemEl.className = 'drawer-fav-item';
        
        itemEl.innerHTML = `
          <div class="drawer-fav-thumb">
            ${item.isVideo 
              ? `<video src="${item.path}" preload="metadata"></video><div class="drawer-fav-icon"><i data-lucide="video"></i></div>` 
              : `<img src="${item.path}" alt="${item.title}">`
            }
          </div>
          <div class="drawer-fav-info">
            <h4 class="drawer-fav-title">${item.title}</h4>
            <p class="drawer-fav-type">${item.isVideo ? 'Vídeo mp4' : 'Fotografía JPG'}</p>
          </div>
          <button class="drawer-fav-remove-btn" title="Eliminar de favoritos">
            <i data-lucide="trash-2"></i>
          </button>
        `;
        
        // Thumb click opens in lightbox
        itemEl.querySelector('.drawer-fav-thumb').addEventListener('click', () => {
          const mainIndex = state.media.findIndex(m => m.id === item.id);
          if (mainIndex !== -1) {
            closeFavoritesDrawer();
            openLightbox(mainIndex);
          }
        });
        
        // Remove button click
        itemEl.querySelector('.drawer-fav-remove-btn').addEventListener('click', () => {
          toggleFavorite(item.filename);
          // Sync lightbox UI in case lightbox is open under the drawer
          if (state.activeLightboxIndex !== -1 && state.media[state.activeLightboxIndex].filename === item.filename) {
            DOM.lightboxFav.classList.remove('favorited');
          }
        });
        
        DOM.drawerList.appendChild(itemEl);
      }
    });
    
    lucide.createIcons();
  }

  function clearAllFavorites() {
    if (state.favorites.size === 0) return;
    
    if (confirm('¿Seguro que deseas eliminar todos tus favoritos?')) {
      state.favorites.clear();
      localStorage.removeItem('naseiro_favorites');
      updateFavoritesBadge();
      renderFavoritesDrawer();
      
      // Update grid UI and lightbox
      applyFilters();
      DOM.lightboxFav.classList.remove('favorited');
    }
  }

  // Start the engine
  init();
});
