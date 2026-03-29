// Offer Drawer
class OffersDrawer extends HTMLElement {
  constructor() {
    super();
    this.drawerInner = this.querySelector('.drawer__inner');
    this.closeButton = this.querySelector('.drawer__close');
    this.overlay = this.querySelector('.offer-drawer__overlay');
  }

  connectedCallback() {
    this.closeButton?.addEventListener('click', this.close.bind(this));
    this.overlay?.addEventListener('click', this.close.bind(this));

    document.addEventListener('keyup', (event) => {
      if (event.key === 'Escape' && this.hasAttribute('open')) {
        this.close();
      }
    });
  }

  open() {
    if (this.hasAttribute('open')) return;

    this.setAttribute('open', '');
    document.body.classList.add('overflow-hidden');

    this.trapFocus();
  }

  close() {
    if (!this.hasAttribute('open')) return;

    this.removeAttribute('open');
    document.body.classList.remove('overflow-hidden');

    this.releaseFocus();
  }

  trapFocus() {
    this.previouslyFocusedElement = document.activeElement;
    this.closeButton?.focus();
  }

  releaseFocus() {
    this.previouslyFocusedElement?.focus();
  }
}

if (!customElements.get('offers-drawer')) {
  customElements.define('offers-drawer', OffersDrawer);
}


// Marquee
(function () {
  function initMarquee(scope) {
    var $marquee = scope
      ? $(scope).find('.marquee')
      : $('.marquee');

    if (!$marquee.length) return;

    // Prevent double initialization
    $marquee.each(function () {
      var $el = $(this);
      if ($el.data('marquee-initialized')) return;

      $el.data('marquee-initialized', true);

      $el.marquee({
        allowCss3Support: true,
        css3easing: 'linear',
        easing: 'linear',
        delayBeforeStart: 0,
        direction: 'left',
        duplicated: true,
        duration: 30000,
        gap: 0,
        pauseOnCycle: false,
        pauseOnHover: false,
        startVisible: true
      });
    });
  }

  // Initial page load (DOM ready)
  document.addEventListener('DOMContentLoaded', function () {
    initMarquee();
  });

  // Page fully loaded (images, fonts, etc.)
  window.addEventListener('load', function () {
    document.querySelectorAll('.marquee').forEach(function (el) {
      el.classList.add('is-loaded');
    });
  });

  // Shopify Theme Editor – section load
  document.addEventListener('shopify:section:load', function (event) {
    initMarquee(event.target);
  });

})();


// Colletion Tab
$('.collection__tabs .tab-link').click(function () {
  var tabID = $(this).attr('data-tab');
  $(this).addClass('active').siblings().removeClass('active');
  $('#tab-' + tabID).addClass('active').siblings().removeClass('active');
});


// Best Seller Products Tab
$('.best-seller__tabs .tab-link').click(function () {
  var tabID = $(this).attr('data-tab');
  $(this).addClass('active').siblings().removeClass('active');
  $('#bsp_tab-' + tabID).addClass('active').siblings().removeClass('active');
});


// Testimonial Slider
document.addEventListener("DOMContentLoaded", function () {

  var testimonialSwiper;

  function initSwiper() {
    if (testimonialSwiper && testimonialSwiper.destroy) {
      testimonialSwiper.destroy(true, true);
      testimonialSwiper = null;
    }

    testimonialSwiper = new Swiper('.testimonial__slider', {
      slidesPerView: 'auto',
      spaceBetween: 20,
      loop: false,
      watchOverflow: true,
      nextButton: '.swiper--next',
      prevButton: '.swiper--prev',
      breakpoints: {
        1120: {
          slidesPerView: 'auto',
          spaceBetween: 10,
        }
      }
    });
  }

  /* ===============================
     FILTER + ACTIVE STATE
  ================================ */
  var filterItems = document.querySelectorAll('.testimonial_filter_item');
  var buttons = document.querySelectorAll('.testimonial_filter_item .filter_button');
  var cards = document.querySelectorAll('.testimonial__item');

  for (var i = 0; i < buttons.length; i++) {
    buttons[i].addEventListener("click", function () {

      var selectedTag = this.getAttribute('data-tag');

      // ✅ REMOVE ACTIVE FROM ALL
      for (var k = 0; k < filterItems.length; k++) {
        filterItems[k].classList.remove('active');
      }

      // ✅ ADD ACTIVE TO CLICKED ITEM PARENT
      var parentItem = this.closest('.testimonial_filter_item');
      if (parentItem) {
        parentItem.classList.add('active');
      }

      // FILTER SLIDES
      for (var j = 0; j < cards.length; j++) {
        var cardTag = cards[j].getAttribute('data-tag');

        if (selectedTag === 'All' || cardTag === selectedTag) {
          cards[j].classList.remove('hidden');
        } else {
          cards[j].classList.add('hidden');
        }
      }

      // REBUILD SWIPER (display:none SAFE)
      requestAnimationFrame(function () {
        initSwiper();
      });
    });
  }

  /* ===============================
     INITIAL LOAD
  ================================ */
  initSwiper();

});


// Press slider
document.addEventListener("DOMContentLoaded", function () {

  var quoteEl = document.querySelector('.press-quote');
  if (!quoteEl) return;

  /* -----------------------------
     INIT SWIPER (v3.4.1)
  ----------------------------- */

  var pressSwiper = new Swiper('.press-logos__slider', {
    slidesPerView: 'auto',
    loop: true,
    centeredSlides: true,
    speed: 300,

    pagination: '.swiper-pagination',
    paginationClickable: true,

    // 🔥 CRITICAL: let Swiper finish movement first
    onTransitionEnd: function (swiper) {
      swiper.fixLoop();           // ← THIS fixes the disappearing slide
      updateQuote(swiper.activeIndex);
    },

    // Correct clone + real slide clicking
    onTap: function (swiper) {
      if (typeof swiper.clickedIndex !== 'undefined') {
        swiper.slideTo(swiper.clickedIndex, 300);
      }
    }
  });

  /* -----------------------------
     UPDATE QUOTE
  ----------------------------- */

  function updateQuote(activeIndex) {
    var slides = document.querySelectorAll(
      '.press-logos__slider .swiper-slide'
    );

    var activeSlide = slides[activeIndex];
    if (!activeSlide) return;

    var img = activeSlide.querySelector('img');
    var quote = img ? img.getAttribute('data-quote') : '';

    quoteEl.classList.add('is-fading');

    setTimeout(function () {
      quoteEl.textContent = quote ? '“' + quote + '”' : '';
      quoteEl.classList.remove('is-fading');
    }, 200);
  }

  /* -----------------------------
     ARROWS
  ----------------------------- */

  var nextBtns = document.querySelectorAll('.press--next');
  var prevBtns = document.querySelectorAll('.press--prev');

  for (var i = 0; i < nextBtns.length; i++) {
    nextBtns[i].addEventListener('click', function () {
      pressSwiper.slideNext();
    });
  }

  for (var j = 0; j < prevBtns.length; j++) {
    prevBtns[j].addEventListener('click', function () {
      pressSwiper.slidePrev();
    });
  }

  /* -----------------------------
     INITIAL STATE
  ----------------------------- */

  pressSwiper.fixLoop();
  updateQuote(pressSwiper.activeIndex);

});




// Video Reels Slider
const reel_swiper = new Swiper('.video_reels__slider', {
  centeredSlides: true,
  loop: true,
  slidesPerView: 4,
  spaceBetween: 15,
  nextButton: '.reel--next',
  prevButton: '.reel--prev',
  breakpoints: {
    749: {
      slidesPerView: 1.5
    },
    989: {
      slidesPerView: 2.5
    },
    1120: {
      slidesPerView: 3.5
    }
  }
});


// Video Reels Play/Pause
document.addEventListener('DOMContentLoaded', () => {
  const videoWraps = document.querySelectorAll('.video_reel_wrapper');

  const resetVideoState = (wrap) => {
    const video = wrap.querySelector('video');
    const iconMute = wrap.querySelector('.icon_mute');
    const iconUnmute = wrap.querySelector('.icon_unmute');
    const iconPlay = wrap.querySelector('.icon_play');
    const iconPause = wrap.querySelector('.icon_pause');

    video.pause();
    video.currentTime = 0;
    video.load(); // restore poster

    video.muted = true;
    iconMute.style.display = 'block';
    iconUnmute.style.display = 'none';
    iconPlay.style.display = 'block';
    iconPause.style.display = 'none';
  };

  const toggleIcons = (video, muteIcon, unmuteIcon, playIcon, pauseIcon) => {
    muteIcon.style.display = video.muted ? 'block' : 'none';
    unmuteIcon.style.display = video.muted ? 'none' : 'block';
    playIcon.style.display = video.paused ? 'block' : 'none';
    pauseIcon.style.display = video.paused ? 'none' : 'block';
  };

  videoWraps.forEach(wrap => {
    const video = wrap.querySelector('.reel_video'); // 👈 important
    const muteBtn = wrap.querySelector('.mute__btn');
    const playBtn = wrap.querySelector('.play__btn');
    const iconMute = wrap.querySelector('.icon_mute');
    const iconUnmute = wrap.querySelector('.icon_unmute');
    const iconPlay = wrap.querySelector('.icon_play');
    const iconPause = wrap.querySelector('.icon_pause');

    // ✅ Initial state
    resetVideoState(wrap);

    // ✅ Shared Play / Pause logic
    const togglePlayPause = (e) => {
      e.stopPropagation(); // ⛔ prevent double trigger

      if (video.paused) {
        videoWraps.forEach(other => {
          if (other !== wrap) resetVideoState(other);
        });
        video.play();
      } else {
        video.pause();
      }

      toggleIcons(video, iconMute, iconUnmute, iconPlay, iconPause);
    };

    // ▶️ Play / Pause via button
    playBtn.addEventListener('click', togglePlayPause);

    // 🎬 Play / Pause via video click
    video.addEventListener('click', togglePlayPause);

    // 🔇 Mute / Unmute
    muteBtn.addEventListener('click', (e) => {
      e.stopPropagation(); // ⛔ don’t trigger video click
      video.muted = !video.muted;
      toggleIcons(video, iconMute, iconUnmute, iconPlay, iconPause);
    });

    // 🔁 Reset after video ends
    video.addEventListener('ended', () => resetVideoState(wrap));
  });
});


// Footer Sibling on mobile
document.addEventListener('DOMContentLoaded', function () {
  const footerBlocks = document.querySelectorAll('.footer-block');
  const breakpoint = 750;

  function initFooterAccordion() {
    if (window.innerWidth > breakpoint) {
      // Reset on desktop
      footerBlocks.forEach(block => {
        block.classList.remove('is-open');
        const content = block.querySelector('.footer-block__details-content');
        if (content) {
          content.style.maxHeight = '';
          content.style.overflow = '';
          content.style.transition = '';
        }
      });
      return;
    }

    footerBlocks.forEach(block => {
      const heading = block.querySelector('.footer-block__heading');
      const content = block.querySelector('.footer-block__details-content');

      if (!heading || !content) return;

      // Initial closed state
      content.style.maxHeight = '0px';
      content.style.overflow = 'hidden';
      content.style.transition = 'max-height 0.35s ease';
      heading.style.cursor = 'pointer';

      heading.onclick = function () {
        const isOpen = block.classList.contains('is-open');

        // Close siblings
        footerBlocks.forEach(otherBlock => {
          otherBlock.classList.remove('is-open');
          const otherContent = otherBlock.querySelector('.footer-block__details-content');
          if (otherContent) {
            otherContent.style.maxHeight = '0px';
          }
        });

        // Open current
        if (!isOpen) {
          block.classList.add('is-open');
          content.style.maxHeight = content.scrollHeight + 'px';
        }
      };
    });
  }

  initFooterAccordion();
  window.addEventListener('resize', initFooterAccordion);
});


// Product Navigation scroll
$(document).ready(function () {
  // Smooth scroll on nav click
  $('.product-nav-item a[href*="#"]').on('click', function (e) {
    //console.log("stick scroll")
    e.preventDefault();

    var target = $(this).attr("href");

    $('html, body').stop().animate({
      scrollTop: $(target).offset().top - 150 // adjust offset if you have a sticky header
    }, 600);
  });
  // Highlight nav item on scroll
  $(window).on('scroll', function () {
    //console.log("scrolled")
    var scrollPos = $(window).scrollTop();
    var windowHeight = $(window).height();

    $('.shopify-section').each(function () {
      var sectionTop = $(this).offset().top;
      var sectionHeight = $(this).outerHeight();
      var sectionId = $(this).attr('id');

      // Check if section is in viewport (visible area)
      if (scrollPos + windowHeight / 2 >= sectionTop && scrollPos < sectionTop + sectionHeight) {
        $('.product-nav-item a').removeClass('active');
        $('.product-nav-item a[href="#' + sectionId + '"]').addClass('active');
      }
    });
  }).scroll(); // trigger on load
});


// Collapsible content
$(function () {
  $('.acc__title').click(function (j) {

    var dropDown = $(this).closest('.acc__card').find('.acc__panel');
    $(this).closest('.accordion').find('.acc__panel').not(dropDown).slideUp();

    if ($(this).hasClass('active')) {
      $(this).removeClass('active');
    } else {
      $(this).closest('.accordion').find('.acc__title.active').removeClass('active');
      $(this).addClass('active');
    }

    dropDown.stop(false, true).slideToggle();
    j.preventDefault();
  });
});


// Fancybox
Fancybox.bind("[data-fancybox]", {
  dragToClose: false,
});


// Video reels play/pause 
document.addEventListener("DOMContentLoaded", () => {

  // 🎥 Play video on .reel_play click
  document.addEventListener("click", (e) => {
    const playBtn = e.target.closest(".reel_play");
    if (!playBtn) return;

    const popup = playBtn.closest(".video_reel__popup");
    const video = popup?.querySelector("video");

    if (video) {
      video.play();
      popup.classList.add("is-playing");
      playBtn.style.display = "none"; // hide play icon when playing
    }
  });

  // 🔇 Mute/unmute video
  document.addEventListener("click", (e) => {
    const muteBtn = e.target.closest(".reel_mute");
    if (!muteBtn) return;

    const popup = muteBtn.closest(".video_reel__popup");
    const video = popup?.querySelector("video");
    const iconMute = muteBtn.querySelector(".icon_mute");
    const iconUnmute = muteBtn.querySelector(".icon_unmute");

    if (video) {
      if (video.muted) {
        video.muted = false;
        iconMute.style.display = "none";
        iconUnmute.style.display = "block";
      } else {
        video.muted = true;
        iconMute.style.display = "block";
        iconUnmute.style.display = "none";
      }
    }
  });

  // ⏸ Pause, reset, and restore poster image
  function resetAllVideos() {
    document.querySelectorAll(".video_reel__popup video").forEach(video => {
      video.pause();
      video.currentTime = 0;
      video.load(); // 👈 ensures poster image shows again

      const popup = video.closest(".video_reel__popup");
      const playBtn = popup?.querySelector(".reel_play");
      if (playBtn) playBtn.style.display = "block"; // show play icon again
      popup?.classList.remove("is-playing");
    });
  }

  // 🧭 Fancybox event listeners
  Fancybox.bind("[data-fancybox]", {
    Hash: false, // 👈 disables #hash fragments like #reels-1
    on: {
      close: () => {
        resetAllVideos();
      },
      "Carousel.change": () => {
        resetAllVideos();
      },
    },
  });

  // ⏹ Manual close button
  document.addEventListener("click", (e) => {
    const closeBtn = e.target.closest(".is-close-button");
    if (!closeBtn) return;
    resetAllVideos();
  });

});


// Discount offer slider
new Swiper('.discount-offer__slider', {
  loop: true,
  nextButton: '.offer_swiper--next',
  prevButton: '.offer_swiper--prev',
  slidesPerView: 1
});


// Customer Reviews slider
new Swiper('.customer-reviews__slider', {
  loop: true,
  nextButton: '.review-swiper--next',
  prevButton: '.review-swiper--prev',
  slidesPerView: 1
});


// Badge tooltip
$(document)

  // Desktop hover tooltip – position:absolute relative to badge_item.
  // An ancestor has transform:perspective(0) which breaks position:fixed,
  // so we use position:absolute + getBoundingClientRect() to get correct coords.
  .on("mousemove", ".image-with-text__badges-wrapper .badge_item", function (e) {
    var $tooltip = $(this).addClass("active").find(".badge__tooltip");
    var rect = this.getBoundingClientRect();
    var offset = 15;
    var tw = 280;  // matches CSS width: 280px
    var th = $tooltip.outerHeight() || 140;
    var vw = window.innerWidth;
    var vh = window.innerHeight;

    // Convert viewport cursor → coordinates relative to badge_item
    var relX = e.clientX - rect.left + offset;
    var relY = e.clientY - rect.top + offset;

    // Flip left if tooltip would overflow right edge of viewport
    if (e.clientX + offset + tw > vw) {
      relX = e.clientX - rect.left - tw - offset;
    }

    // Flip above cursor if tooltip would overflow bottom edge of viewport
    if (e.clientY + offset + th > vh) {
      relY = e.clientY - rect.top - th - offset;
    }

    $tooltip.css({ left: relX + "px", top: relY + "px" });
  })

  .on("mouseleave", ".image-with-text__badges-wrapper .badge_item", function () {
    $(this).removeClass("active");
  });


// Mobile popup
if (window.innerWidth < 750) {

  var nutrient_pop_up = $("#mobile-badge__tooltip");
  var nutrient_pop_up_card = nutrient_pop_up.find("#badge__tooltip-content");
  var nutrient_pop_up_close = nutrient_pop_up.find(".popup_close");

  // Move popup to <body> so it escapes any ancestor with transform:perspective(0)
  // which would break position:fixed and cause misalignment (appearing at bottom)
  $("body").append(nutrient_pop_up.detach());

  function closeMobilePopup() {
    $("html").removeClass("badge__tooltip_active");
    nutrient_pop_up_card.find(".badge_tooltip__title, .badge_tooltip__desc").remove();
  }

  $(".image-with-text__badges-wrapper .badge_item").on("click", function () {
    var _this = $(this);
    var $source = _this.find(".badge__tooltip");
    if ($source.length) {
      nutrient_pop_up_card.find(".badge_tooltip__title, .badge_tooltip__desc").remove();
      nutrient_pop_up_card.append($source.find(".badge_tooltip__title, .badge_tooltip__desc").clone());
      $("html").addClass("badge__tooltip_active");
    }
  });

  nutrient_pop_up_close.on("click", closeMobilePopup);

  // Tap the backdrop (outside the card) to close
  nutrient_pop_up.on("click", function (e) {
    if (!$(e.target).closest("#badge__tooltip-content").length) {
      closeMobilePopup();
    }
  });

}


