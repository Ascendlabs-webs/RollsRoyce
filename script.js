gsap.registerPlugin(ScrollTrigger);

// Configuration
const CONFIG = {
    frameCount: 8,
    scrollDuration: 400,
    transitionOverlap: 0.15,
    scaleStart: 1.15,
    scaleEnd: 1.0,
    parallaxDepth: 30,
    textStagger: 0.08
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

        this.images.forEach((img) => {
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

// Master Timeline Controller
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
            
            const startTime = index * frameDuration;
            const isFirst = index === 0;
            const isLast = index === this.frames.length - 1;

            // Frame fade in/out
            if (!isFirst) {
                this.masterTimeline.fromTo(
                    frame,
                    { opacity: 0 },
                    { 
                        opacity: 1, 
                        duration: transitionDuration * 0.4,
                        ease: 'power2.inOut'
                    },
                    startTime
                );
            }

            if (!isLast) {
                this.masterTimeline.to(
                    frame,
                    { 
                        opacity: 0, 
                        duration: transitionDuration * 0.4,
                        ease: 'power2.inOut'
                    },
                    startTime + frameDuration * 0.6
                );
            }

            // Image scale animation
            this.masterTimeline.fromTo(
                image,
                { 
                    scale: CONFIG.scaleStart,
                },
                { 
                    scale: CONFIG.scaleEnd,
                    duration: transitionDuration,
                    ease: 'power1.inOut'
                },
                startTime
            );

            // Parallax depth
            this.masterTimeline.fromTo(
                image,
                { 
                    y: 0
                },
                { 
                    y: -CONFIG.parallaxDepth,
                    duration: frameDuration,
                    ease: 'none'
                },
                startTime
            );

            // Text animations
            if (!isFirst) {
                this.masterTimeline.fromTo(
                    textFrame,
                    { opacity: 0 },
                    { 
                        opacity: 1, 
                        duration: transitionDuration * 0.3,
                        ease: 'power2.out'
                    },
                    startTime + transitionDuration * 0.1
                );

                // Stagger title lines
                this.masterTimeline.fromTo(
                    titleLines,
                    { 
                        y: 20,
                        opacity: 0
                    },
                    { 
                        y: 0,
                        opacity: 1,
                        duration: 0.8,
                        stagger: CONFIG.textStagger,
                        ease: 'power3.out'
                    },
                    startTime + transitionDuration * 0.15
                );

                // Subtitle
                this.masterTimeline.fromTo(
                    subtitle,
                    { 
                        y: 15,
                        opacity: 0
                    },
                    { 
                        y: 0,
                        opacity: 1,
                        duration: 0.8,
                        ease: 'power3.out'
                    },
                    startTime + transitionDuration * 0.25
                );
            } else {
                // Initial frame text animation
                this.masterTimeline.fromTo(
                    titleLines,
                    { 
                        y: 20,
                        opacity: 0
                    },
                    { 
                        y: 0,
                        opacity: 1,
                        duration: 1.2,
                        stagger: CONFIG.textStagger,
                        ease: 'power3.out',
                        delay: 0.3
                    },
                    0
                );

                this.masterTimeline.fromTo(
                    subtitle,
                    { 
                        y: 15,
                        opacity: 0
                    },
                    { 
                        y: 0,
                        opacity: 1,
                        duration: 1.2,
                        ease: 'power3.out',
                        delay: 0.5
                    },
                    0
                );
            }

            if (!isLast) {
                // Text fade out
                this.masterTimeline.to(
                    textFrame,
                    { 
                        opacity: 0, 
                        duration: transitionDuration * 0.25,
                        ease: 'power2.in'
                    },
                    startTime + frameDuration * 0.65
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
            scrub: 1.2,
            anticipatePin: 1,
            invalidateOnRefresh: true,
            animation: this.masterTimeline,
            onUpdate: (self) => {
                const progress = self.progress * 100;
                this.masterTimeline.progress(self.progress);
            }
        });
    }

    destroy() {
        this.masterTimeline.kill();
        ScrollTrigger.getAll().forEach(st => st.kill());
    }
}

// Lazy Loading
function setupLazyLoading() {
    const images = document.querySelectorAll('img[loading="lazy"]');

    if ('IntersectionObserver' in window) {
        const imageObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const img = entry.target;
                    img.src = img.src;
                    imageObserver.unobserve(img);
                }
            });
        }, {
            rootMargin: '100px'
        });

        images.forEach(img => imageObserver.observe(img));
    }
}

// Performance Optimization
function optimizePerformance() {
    let resizeTimer;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
            ScrollTrigger.refresh();
        }, 250);
    }, { passive: true });

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        ScrollTrigger.getAll().forEach(st => st.kill());
        gsap.globalTimeline.timeScale(100);
    }

    window.addEventListener('orientationchange', () => {
        setTimeout(() => ScrollTrigger.refresh(), 200);
    });
}

// Initialize
let cinematicScroll;

document.addEventListener('DOMContentLoaded', async () => {
    document.body.style.overflow = 'hidden';

    const preloader = new Preloader();
    await preloader.init();

    new ScrollProgress();
    setupLazyLoading();
    optimizePerformance();

    cinematicScroll = new CinematicScroll();
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
    refresh: () => ScrollTrigger.refresh(),
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
    }
};