gsap.registerPlugin(ScrollTrigger);

// Device Detection and Configuration
const DeviceConfig = {
    isMobile: /iPhone|iPad|iPod|Android/i.test(navigator.userAgent),
    isTablet: /iPad|Android/i.test(navigator.userAgent) && window.innerWidth >= 768,
    isTouch: 'ontouchstart' in window || navigator.maxTouchPoints > 0,
    reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    
    get scrollDuration() {
        if (this.isMobile && !this.isTablet) return 250;
        if (this.isTablet) return 300;
        return 400;
    },
    
    get scrubValue() {
        if (this.isMobile && !this.isTablet) return 0.8;
        if (this.isTablet) return 1.0;
        return 1.2;
    },
    
    get parallaxDepth() {
        if (this.isMobile && !this.isTablet) return 15;
        if (this.isTablet) return 20;
        return 30;
    },
    
    get scaleStart() {
        if (this.isMobile) return 1.1;
        return 1.15;
    }
};

// Configuration
const CONFIG = {
    frameCount: 8,
    get scrollDuration() { return DeviceConfig.scrollDuration; },
    transitionOverlap: 0.15,
    get scaleStart() { return DeviceConfig.scaleStart; },
    scaleEnd: 1.0,
    get parallaxDepth() { return DeviceConfig.parallaxDepth; },
    textStagger: 0.08,
    get scrub() { return DeviceConfig.scrubValue; }
};

// Preloader
class Preloader {
    constructor() {
        this.preloader = document.querySelector('.preloader');
        this.progress = document.querySelector('.loading-progress');
        this.images = document.querySelectorAll('.frame-image');
        this.loadedCount = 0;
        this.totalImages = this.images.length;
    }

    init() {
        return new Promise((resolve) => {
            this.resolve = resolve;
            this.loadImages();
        });
    }

    loadImages() {
        if (this.totalImages === 0) {
            this.complete();
            return;
        }

        // Prioritize first image
        const firstImage = this.images[0];
        if (firstImage) {
            if (firstImage.complete) {
                this.imageLoaded();
            } else {
                firstImage.addEventListener('load', () => this.imageLoaded());
                firstImage.addEventListener('error', () => this.imageLoaded());
            }
        }

        // Load remaining images
        Array.from(this.images).slice(1).forEach((img) => {
            if (img.complete) {
                this.imageLoaded();
            } else {
                img.addEventListener('load', () => this.imageLoaded());
                img.addEventListener('error', () => this.imageLoaded());
            }
        });
    }

    imageLoaded() {
        this.loadedCount++;
        const progressPercent = (this.loadedCount / this.totalImages) * 100;
        this.progress.style.width = `${progressPercent}%`;

        if (this.loadedCount === this.totalImages) {
            setTimeout(() => this.complete(), 500);
        }
    }

    complete() {
        gsap.to(this.preloader, {
            opacity: 0,
            duration: 0.8,
            ease: 'power2.inOut',
            onComplete: () => {
                this.preloader.classList.add('hidden');
                document.body.style.overflow = 'auto';
                this.resolve();
            }
        });
    }
}

// Hero Intro Animation
class HeroIntro {
    constructor() {
        this.heroSection = document.querySelector('.hero-intro');
        this.scrollHint = document.querySelector('.scroll-hint');
        this.experienceWrapper = document.querySelector('.experience-wrapper');
        this.init();
    }

    init() {
        if (this.scrollHint) {
            this.scrollHint.addEventListener('click', () => this.scrollToExperience());
        }

        // Fade out hero on scroll with proper trigger
        if (this.heroSection && this.experienceWrapper) {
            gsap.to(this.heroSection, {
                scrollTrigger: {
                    trigger: this.experienceWrapper,
                    start: 'top top',
                    end: '100vh top',
                    scrub: 0.5,
                    onEnter: () => {
                        // Ensure viewport-pin is visible
                        document.querySelector('.viewport-pin').style.opacity = '1';
                    }
                },
                opacity: 0,
                scale: 0.98,
                ease: 'power2.inOut'
            });
        }
    }

    scrollToExperience() {
        const heroHeight = this.heroSection.offsetHeight;
        window.scrollTo({
            top: heroHeight + 10,
            behavior: 'smooth'
        });
    }
}

// Scroll Progress
class ScrollProgress {
    constructor() {
        this.progressBar = document.querySelector('.scroll-progress');
        this.init();
    }

    init() {
        window.addEventListener('scroll', () => this.update(), { passive: true });
    }

    update() {
        const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
        const scrolled = window.scrollY;
        const progress = (scrolled / scrollHeight) * 100;
        this.progressBar.style.width = `${Math.min(progress, 100)}%`;
    }
}

// Master Timeline Controller with Enhanced Animations
class CinematicScroll {
    constructor() {
        this.frames = gsap.utils.toArray('.frame');
        this.textFrames = gsap.utils.toArray('.text-frame');
        this.scrollSpacer = document.querySelector('.scroll-spacer');
        this.viewportPin = document.querySelector('.viewport-pin');
        this.masterTimeline = gsap.timeline();
        
        this.setupScrollSpacer();
        this.buildMasterTimeline();
        this.setupScrollTrigger();
    }

    setupScrollSpacer() {
        const totalHeight = CONFIG.scrollDuration;
        this.scrollSpacer.style.height = `${totalHeight}vh`;
    }

    buildMasterTimeline() {
        const frameDuration = 100 / CONFIG.frameCount;
        const transitionDuration = frameDuration * (1 + CONFIG.transitionOverlap);

        this.frames.forEach((frame, index) => {
            const image = frame.querySelector('.frame-image');
            const textFrame = this.textFrames[index];
            const titleLines = textFrame.querySelectorAll('.title-line');
            const subtitle = textFrame.querySelector('.subtitle');
            const frameNumber = textFrame.querySelector('.frame-number');
            
            const startTime = index * frameDuration;
            const isFirst = index === 0;
            const isLast = index === this.frames.length - 1;

            // Frame fade in/out with improved easing
            if (!isFirst) {
                this.masterTimeline.fromTo(
                    frame,
                    { opacity: 0 },
                    { 
                        opacity: 1, 
                        duration: transitionDuration * 0.5,
                        ease: 'power2.out'
                    },
                    startTime
                );
            }

            if (!isLast) {
                this.masterTimeline.to(
                    frame,
                    { 
                        opacity: 0, 
                        duration: transitionDuration * 0.5,
                        ease: 'power2.in'
                    },
                    startTime + frameDuration * 0.5
                );
            }

            // Enhanced image scale animation with realistic easing
            this.masterTimeline.fromTo(
                image,
                { 
                    scale: CONFIG.scaleStart,
                },
                { 
                    scale: CONFIG.scaleEnd,
                    duration: transitionDuration * 1.2,
                    ease: 'power1.out'
                },
                startTime
            );

            // Smooth parallax depth
            this.masterTimeline.fromTo(
                image,
                { 
                    y: 0
                },
                { 
                    y: -CONFIG.parallaxDepth,
                    duration: frameDuration,
                    ease: 'linear'
                },
                startTime
            );

            // Enhanced text animations
            if (!isFirst) {
                this.masterTimeline.fromTo(
                    textFrame,
                    { opacity: 0 },
                    { 
                        opacity: 1, 
                        duration: transitionDuration * 0.4,
                        ease: 'power2.out'
                    },
                    startTime + transitionDuration * 0.1
                );

                // Stagger title lines with bounce
                this.masterTimeline.fromTo(
                    titleLines,
                    { 
                        y: 30,
                        opacity: 0
                    },
                    { 
                        y: 0,
                        opacity: 1,
                        duration: 1,
                        stagger: CONFIG.textStagger,
                        ease: 'back.out(1.2)'
                    },
                    startTime + transitionDuration * 0.15
                );

                // Subtitle with smooth ease
                this.masterTimeline.fromTo(
                    subtitle,
                    { 
                        y: 20,
                        opacity: 0
                    },
                    { 
                        y: 0,
                        opacity: 1,
                        duration: 0.9,
                        ease: 'power3.out'
                    },
                    startTime + transitionDuration * 0.25
                );

                // Frame number animation
                if (frameNumber) {
                    this.masterTimeline.fromTo(
                        frameNumber,
                        { 
                            y: 15,
                            opacity: 0
                        },
                        { 
                            y: 0,
                            opacity: 1,
                            duration: 0.8,
                            ease: 'power2.out'
                        },
                        startTime + transitionDuration * 0.35
                    );
                }
            } else {
                // Initial frame text animation with enhanced timing
                this.masterTimeline.fromTo(
                    titleLines,
                    { 
                        y: 30,
                        opacity: 0
                    },
                    { 
                        y: 0,
                        opacity: 1,
                        duration: 1.4,
                        stagger: CONFIG.textStagger,
                        ease: 'back.out(1.2)',
                        delay: 0.3
                    },
                    0
                );

                this.masterTimeline.fromTo(
                    subtitle,
                    { 
                        y: 20,
                        opacity: 0
                    },
                    { 
                        y: 0,
                        opacity: 1,
                        duration: 1.2,
                        ease: 'power3.out',
                        delay: 0.6
                    },
                    0
                );

                if (frameNumber) {
                    this.masterTimeline.fromTo(
                        frameNumber,
                        { 
                            y: 15,
                            opacity: 0
                        },
                        { 
                            y: 0,
                            opacity: 1,
                            duration: 1,
                            ease: 'power2.out',
                            delay: 0.8
                        },
                        0
                    );
                }
            }

            if (!isLast) {
                // Enhanced text fade out
                this.masterTimeline.to(
                    [textFrame, frameNumber],
                    { 
                        opacity: 0, 
                        y: -10,
                        duration: transitionDuration * 0.3,
                        ease: 'power2.in'
                    },
                    startTime + frameDuration * 0.6
                );
            }
        });
    }

    setupScrollTrigger() {
        ScrollTrigger.create({
            trigger: this.scrollSpacer,
            start: 'top top',
            end: 'bottom bottom',
            pin: this.viewportPin,
            pinSpacing: false,
            scrub: CONFIG.scrub,
            anticipatePin: 1,
            invalidateOnRefresh: true,
            animation: this.masterTimeline,
            onUpdate: (self) => {
                this.masterTimeline.progress(self.progress);
            },
            onEnter: () => {
                // Ensure viewport is visible
                if (this.viewportPin) {
                    this.viewportPin.style.opacity = '1';
                }
            }
        });
    }

    destroy() {
        this.masterTimeline.kill();
        ScrollTrigger.getAll().forEach(st => st.kill());
    }
}

// Enhanced Lazy Loading
function setupLazyLoading() {
    const images = document.querySelectorAll('img[loading="lazy"]');

    if ('IntersectionObserver' in window) {
        const imageObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const img = entry.target;
                    
                    // Add fade-in effect
                    img.style.opacity = '0';
                    img.style.transition = 'opacity 0.5s ease-in-out';
                    
                    if (img.src) {
                        img.onload = () => {
                            img.style.opacity = '1';
                        };
                    }
                    
                    imageObserver.unobserve(img);
                }
            });
        }, {
            rootMargin: DeviceConfig.isMobile ? '50px' : '100px'
        });

        images.forEach(img => imageObserver.observe(img));
    }
}

// Performance Optimization
function optimizePerformance() {
    let resizeTimer;
    let lastWidth = window.innerWidth;

    window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        
        const currentWidth = window.innerWidth;
        
        // Only refresh if width changed (avoid mobile scroll bar issues)
        if (Math.abs(currentWidth - lastWidth) > 10) {
            resizeTimer = setTimeout(() => {
                ScrollTrigger.refresh();
                lastWidth = currentWidth;
            }, 250);
        }
    }, { passive: true });

    // Handle orientation change
    window.addEventListener('orientationchange', () => {
        setTimeout(() => {
            ScrollTrigger.refresh();
            lastWidth = window.innerWidth;
        }, 300);
    });

    // Reduced motion support
    if (DeviceConfig.reducedMotion) {
        ScrollTrigger.getAll().forEach(st => st.kill());
        gsap.globalTimeline.timeScale(100);
    }

    // Passive scroll listeners
    document.addEventListener('scroll', () => {}, { passive: true });
    document.addEventListener('touchstart', () => {}, { passive: true });
}

// Touch Gesture Support
function setupTouchGestures() {
    if (!DeviceConfig.isTouch) return;

    const viewportPin = document.querySelector('.viewport-pin');
    if (!viewportPin) return;

    let touchStartY = 0;
    let touchEndY = 0;

    viewportPin.addEventListener('touchstart', (e) => {
        touchStartY = e.changedTouches[0].screenY;
    }, { passive: true });

    viewportPin.addEventListener('touchend', (e) => {
        touchEndY = e.changedTouches[0].screenY;
        handleSwipe();
    }, { passive: true });

    function handleSwipe() {
        const swipeThreshold = 50;
        const diff = touchStartY - touchEndY;

        if (Math.abs(diff) > swipeThreshold) {
            // Swipe detected - natural scroll will handle it
            return;
        }
    }
}

// Viewport Height Fix for Mobile
function fixMobileViewport() {
    if (!DeviceConfig.isMobile) return;

    // Set CSS custom property for true viewport height
    const setVh = () => {
        const vh = window.innerHeight * 0.01;
        document.documentElement.style.setProperty('--vh', `${vh}px`);
    };

    setVh();
    
    window.addEventListener('resize', () => {
        setTimeout(setVh, 100);
    }, { passive: true });
}

// Initialize Case Study Animations
function initCaseStudyAnimations() {
    const caseStudyBlocks = gsap.utils.toArray('.case-study-block');
    
    caseStudyBlocks.forEach((block, index) => {
        gsap.fromTo(block,
            {
                opacity: 0,
                y: 30
            },
            {
                opacity: 1,
                y: 0,
                duration: 0.8,
                ease: 'power3.out',
                scrollTrigger: {
                    trigger: block,
                    start: 'top 85%',
                    end: 'top 60%',
                    toggleActions: 'play none none reverse'
                }
            }
        );
    });

    // Transition section animation
    const transitionText = document.querySelector('.transition-text');
    if (transitionText) {
        gsap.fromTo(transitionText,
            {
                opacity: 0,
                scale: 0.9
            },
            {
                opacity: 1,
                scale: 1,
                duration: 1,
                ease: 'back.out(1.5)',
                scrollTrigger: {
                    trigger: transitionText,
                    start: 'top 80%',
                    toggleActions: 'play none none reverse'
                }
            }
        );
    }
}

// Initialize
let cinematicScroll;
let heroIntro;

document.addEventListener('DOMContentLoaded', async () => {
    console.log('🎬 Initializing Rolls-Royce Experience...');
    console.log('Device Config:', {
        isMobile: DeviceConfig.isMobile,
        isTablet: DeviceConfig.isTablet,
        isTouch: DeviceConfig.isTouch,
        scrollDuration: CONFIG.scrollDuration,
        scrub: CONFIG.scrub
    });

    document.body.style.overflow = 'hidden';

    // Fix mobile viewport
    fixMobileViewport();

    // Ensure viewport-pin is visible
    const viewportPin = document.querySelector('.viewport-pin');
    if (viewportPin) {
        viewportPin.style.opacity = '1';
        console.log('✅ Viewport-pin set to visible');
    }

    // Initialize preloader
    const preloader = new Preloader();
    await preloader.init();
    console.log('✅ Preloader complete');

    // Initialize components
    heroIntro = new HeroIntro();
    new ScrollProgress();
    setupLazyLoading();
    setupTouchGestures();
    optimizePerformance();
    console.log('✅ Components initialized');

    // Initialize cinematic scroll
    cinematicScroll = new CinematicScroll();
    console.log('✅ Cinematic scroll initialized');

    // Initialize case study animations
    setTimeout(() => {
        initCaseStudyAnimations();
        console.log('✅ Case study animations ready');
    }, 100);

    console.log('🚀 Experience ready!');
});

// Cleanup
window.addEventListener('beforeunload', () => {
    if (cinematicScroll) {
        cinematicScroll.destroy();
    }
    gsap.killTweensOf('*');
});

// Export API
window.RollsRoyceCinematic = {
    refresh: () => {
        ScrollTrigger.refresh();
        console.log('ScrollTrigger refreshed');
    },
    destroy: () => {
        if (cinematicScroll) {
            cinematicScroll.destroy();
        }
    },
    rebuild: () => {
        if (cinematicScroll) {
            cinematicScroll.destroy();
        }
        cinematicScroll = new CinematicScroll();
    },
    deviceInfo: () => DeviceConfig
};

// Auto-refresh on visibility change (mobile optimization)
document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
        setTimeout(() => {
            ScrollTrigger.refresh();
        }, 100);
    }
});
