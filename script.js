const hasGSAP = typeof window.gsap !== 'undefined';
const hasScrollTrigger = typeof window.ScrollTrigger !== 'undefined';
const hasTHREE = typeof window.THREE !== 'undefined';
const isMobile = window.matchMedia('(max-width: 768px)').matches;

if (hasGSAP && hasScrollTrigger) {
    gsap.registerPlugin(ScrollTrigger);
}

const CONFIG = {
    frameCount: 8,
    scrollDuration: isMobile ? 260 : 400,
    transitionOverlap: 0.15,
    scaleStart: isMobile ? 1.1 : 1.15,
    scaleEnd: 1.0,
    parallaxDepth: isMobile ? 16 : 30,
    textStagger: isMobile ? 0.06 : 0.08,
    scrub: isMobile ? 0.9 : 1.2
};

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
                img.addEventListener('load', () => this.imageLoaded(), { once: true });
                img.addEventListener('error', () => this.imageLoaded(), { once: true });
            }
        });
    }

    imageLoaded() {
        this.loadedCount++;
        const progressPercent = (this.loadedCount / this.totalImages) * 100;

        if (this.progress) {
            this.progress.style.width = `${progressPercent}%`;
        }

        if (this.loadedCount === this.totalImages) {
            setTimeout(() => this.complete(), 500);
        }
    }

    complete() {
        if (!this.preloader) {
            this.resolve();
            return;
        }

        if (!hasGSAP) {
            this.preloader.classList.add('hidden');
            document.body.style.overflow = 'auto';
            this.resolve();
            return;
        }

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

class ScrollProgress {
    constructor() {
        this.progressBar = document.querySelector('.scroll-progress');
        this.init();
    }

    init() {
        window.addEventListener('scroll', () => this.update(), { passive: true });
        this.update();
    }

    update() {
        if (!this.progressBar) return;

        const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
        const scrolled = window.scrollY;
        const progress = scrollHeight > 0 ? (scrolled / scrollHeight) * 100 : 0;
        this.progressBar.style.width = `${Math.min(progress, 100)}%`;
    }
}

class CinematicScroll {
    constructor() {
        this.frames = gsap.utils.toArray('.frame');
        this.textFrames = gsap.utils.toArray('.text-frame');
        this.scrollSpacer = document.querySelector('.scroll-spacer');
        this.viewportPin = document.querySelector('.viewport-pin');
        this.masterTimeline = gsap.timeline();

        if (!this.scrollSpacer || !this.viewportPin || this.frames.length === 0 || this.textFrames.length === 0) {
            return;
        }

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
            if (!image || !textFrame) return;

            const titleLines = textFrame.querySelectorAll('.title-line');
            const subtitle = textFrame.querySelector('.subtitle');

            const startTime = index * frameDuration;
            const isFirst = index === 0;
            const isLast = index === this.frames.length - 1;

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

            this.masterTimeline.fromTo(
                image,
                {
                    scale: CONFIG.scaleStart
                },
                {
                    scale: CONFIG.scaleEnd,
                    duration: transitionDuration,
                    ease: 'power1.inOut'
                },
                startTime
            );

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

                if (subtitle) {
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
                }
            }

            if (!isLast) {
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
            scrub: CONFIG.scrub,
            anticipatePin: 1,
            invalidateOnRefresh: true,
            animation: this.masterTimeline,
            onUpdate: (self) => {
                this.masterTimeline.progress(self.progress);
            }
        });
    }

    destroy() {
        this.masterTimeline.kill();
        ScrollTrigger.getAll().forEach((st) => st.kill());
    }
}

class Model3DViewer {
    constructor() {
        this.canvas = document.getElementById('model-canvas');
        this.container = document.getElementById('canvas-container');
        this.loading = document.getElementById('modelLoading');

        if (!this.canvas || !this.container || !hasTHREE) {
            this.hideLoadingImmediate();
            return;
        }

        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;
        this.model = null;
        this.autoRotateEnabled = false;

        this.init();
    }

    init() {
        this.setupScene();
        this.loadModel();
        this.setupControls();
        this.setupEventListeners();
        this.animate();
    }

    setupScene() {
        this.scene = new THREE.Scene();
        this.scene.background = null;

        const aspect = this.container.clientWidth / this.container.clientHeight;
        this.camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 1000);
        this.camera.position.set(5, 2, 5);

        this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: true });
        this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobile ? 1.5 : 2));
        this.renderer.setClearColor(0x000000, 0);

        const ambient = new THREE.AmbientLight(0xffffff, 0.6);
        const key = new THREE.DirectionalLight(0xffffff, 0.8);
        key.position.set(5, 10, 7);
        const rim = new THREE.DirectionalLight(0xd4af37, 0.3);
        rim.position.set(-5, 5, -5);

        this.scene.add(ambient, key, rim);
    }

    loadModel() {
        if (typeof THREE.GLTFLoader === 'undefined') {
            this.showError('3D loader unavailable');
            return;
        }

        const loader = new THREE.GLTFLoader();
        loader.load(
            'Untitled.glb',
            (gltf) => {
                this.model = gltf.scene;
                const box = new THREE.Box3().setFromObject(this.model);
                const center = box.getCenter(new THREE.Vector3());
                const size = box.getSize(new THREE.Vector3());
                const maxDim = Math.max(size.x, size.y, size.z);
                const scale = 3 / maxDim;

                this.model.scale.setScalar(scale);
                this.model.position.x = -center.x * scale;
                this.model.position.y = -center.y * scale;
                this.model.position.z = -center.z * scale;

                this.scene.add(this.model);
                this.hideLoading();
            },
            undefined,
            () => this.showError('Failed to load 3D model')
        );
    }

    setupControls() {
        if (typeof THREE.OrbitControls === 'undefined' || !this.renderer) return;

        this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.minDistance = 2;
        this.controls.maxDistance = 15;
    }

    setupEventListeners() {
        const resetBtn = document.getElementById('resetView');
        const autoBtn = document.getElementById('autoRotate');

        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                if (!this.camera) return;
                this.camera.position.set(5, 2, 5);
                if (this.controls) this.controls.reset();
            });
        }

        if (autoBtn) {
            autoBtn.addEventListener('click', () => {
                if (!this.controls) return;
                this.autoRotateEnabled = !this.autoRotateEnabled;
                this.controls.autoRotate = this.autoRotateEnabled;
                autoBtn.classList.toggle('active', this.autoRotateEnabled);
            });
        }

        window.addEventListener('resize', () => this.onResize(), { passive: true });
    }

    onResize() {
        if (!this.camera || !this.renderer || !this.container) return;
        const width = this.container.clientWidth;
        const height = this.container.clientHeight;
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height);
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        if (this.controls) this.controls.update();
        if (this.renderer && this.scene && this.camera) {
            this.renderer.render(this.scene, this.camera);
        }
    }

    hideLoadingImmediate() {
        if (this.loading) this.loading.classList.add('hidden');
    }

    hideLoading() {
        if (!this.loading) return;
        this.loading.classList.add('hidden');
    }

    showError(message) {
        if (!this.loading) return;
        const text = this.loading.querySelector('p');
        if (text) text.textContent = message;
    }
}

function setupLazyLoading() {
    const images = document.querySelectorAll('img[loading="lazy"]');
    if ('IntersectionObserver' in window) {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    observer.unobserve(entry.target);
                }
            });
        }, { rootMargin: '100px' });
        images.forEach((img) => observer.observe(img));
    }
}

function optimizePerformance() {
    let resizeTimer;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
            if (hasScrollTrigger) ScrollTrigger.refresh();
        }, 250);
    }, { passive: true });

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches && hasScrollTrigger && hasGSAP) {
        ScrollTrigger.getAll().forEach((st) => st.kill());
        gsap.globalTimeline.timeScale(100);
    }
}

function initCaseStudyAnimations() {
    if (!hasGSAP || !hasScrollTrigger) return;
    const blocks = gsap.utils.toArray('.case-study-block');
    blocks.forEach((block) => {
        gsap.fromTo(block,
            { opacity: 0, y: 30 },
            {
                opacity: 1,
                y: 0,
                duration: 0.8,
                ease: 'power3.out',
                scrollTrigger: {
                    trigger: block,
                    start: 'top 85%',
                    toggleActions: 'play none none reverse'
                }
            }
        );
    });
}

let cinematicScroll;
let model3DViewer;

document.addEventListener('DOMContentLoaded', async () => {
    document.body.style.overflow = 'hidden';

    if (!hasGSAP || !hasScrollTrigger) {
        const preloader = document.querySelector('.preloader');
        if (preloader) preloader.classList.add('hidden');
        document.body.style.overflow = 'auto';
        new ScrollProgress();
        model3DViewer = new Model3DViewer();
        return;
    }

    const preloader = new Preloader();
    await preloader.init();

    new ScrollProgress();
    setupLazyLoading();
    optimizePerformance();

    cinematicScroll = new CinematicScroll();
    initCaseStudyAnimations();
    model3DViewer = new Model3DViewer();
});

window.addEventListener('beforeunload', () => {
    if (cinematicScroll) cinematicScroll.destroy();
    if (hasGSAP) gsap.killTweensOf('*');
});

window.RollsRoyceCinematic = {
    refresh: () => {
        if (hasScrollTrigger) ScrollTrigger.refresh();
    },
    destroy: () => {
        if (cinematicScroll) cinematicScroll.destroy();
    },
    rebuild: () => {
        if (cinematicScroll) cinematicScroll.destroy();
        if (hasGSAP && hasScrollTrigger) cinematicScroll = new CinematicScroll();
    }
};

