const hasGSAP = typeof window.gsap !== 'undefined';
const hasScrollTrigger = typeof window.ScrollTrigger !== 'undefined';
const hasTHREE = typeof window.THREE !== 'undefined';
const isMobile = window.matchMedia('(max-width: 768px)').matches;
const networkInfo = navigator.connection || navigator.mozConnection || navigator.webkitConnection || null;
const prefersReducedData = Boolean(networkInfo && networkInfo.saveData);
const effectiveNetworkType = networkInfo && typeof networkInfo.effectiveType === 'string'
    ? networkInfo.effectiveType.toLowerCase()
    : '';
const isSlowNetwork = effectiveNetworkType.includes('2g') || effectiveNetworkType.includes('3g');

if (hasGSAP && hasScrollTrigger) {
    gsap.registerPlugin(ScrollTrigger);
}

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

// Replaces frame-to-frame scroll transitions with a single premium typography reveal.
class TypographyReveal {
    constructor({ autoObserve = true } = {}) {
        this.revealRoot = document.querySelector('.typography-reveal');
        this.headline = this.revealRoot?.querySelector('[data-typography-headline]');
        this.letterDelay = 0.05;
        this.letterDuration = 0.85;
        this.hasAnimated = false;
        this.hasQueuedReveal = false;
        this.observer = null;
        this.autoObserve = autoObserve;

        if (!this.revealRoot || !this.headline) {
            return;
        }

        this.splitHeadlineIntoSpans();
        if (this.autoObserve) this.setupRevealObserver();
    }

    splitHeadlineIntoSpans() {
        const headlineText = (this.headline.textContent || '').trim();
        if (!headlineText) return;

        const fragment = document.createDocumentFragment();
        let letterIndex = 0;

        [...headlineText].forEach((char) => {
            if (char === ' ') {
                const space = document.createElement('span');
                space.className = 'typography-space';
                space.setAttribute('aria-hidden', 'true');
                space.textContent = '\u00A0';
                fragment.appendChild(space);
                return;
            }

            const letter = document.createElement('span');
            letter.className = 'typography-letter';
            letter.setAttribute('aria-hidden', 'true');
            letter.style.setProperty('--char-delay', `${(letterIndex * this.letterDelay).toFixed(2)}s`);
            letter.textContent = char;
            fragment.appendChild(letter);
            letterIndex++;
        });

        this.headline.textContent = '';
        this.headline.appendChild(fragment);
        this.headline.setAttribute('aria-label', headlineText);

        const headlineDuration = ((Math.max(letterIndex - 1, 0) * this.letterDelay) + this.letterDuration).toFixed(2);
        this.revealRoot.style.setProperty('--headline-duration', `${headlineDuration}s`);

        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            this.revealRoot.classList.add('is-visible');
            this.hasAnimated = true;
        }
    }

    reveal() {
        if (this.hasAnimated || this.hasQueuedReveal) return;
        this.hasQueuedReveal = true;

        // Double RAF guarantees initial styles are painted before toggling reveal.
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                this.revealRoot.classList.add('is-visible');
                this.hasAnimated = true;
                this.hasQueuedReveal = false;
                this.destroy();
            });
        });
    }

    setupRevealObserver() {
        if (this.hasAnimated) return;

        if (!('IntersectionObserver' in window)) {
            this.reveal();
            return;
        }

        this.observer = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (!entry.isIntersecting || this.hasAnimated) return;

                this.reveal();
            });
        }, {
            threshold: 0.45
        });

        this.observer.observe(this.revealRoot);
    }

    destroy() {
        if (!this.observer) return;
        this.observer.disconnect();
        this.observer = null;
    }
}

// Drives the hero image through all extracted JPG frames based on scroll progress.
class HeroFrameSequence {
    constructor({ typographyReveal } = {}) {
        this.typographyReveal = typographyReveal || null;
        this.imageElement = document.querySelector('.frame-image');
        this.scrollSpacer = document.querySelector('.scroll-spacer');

        this.sequenceFolder = 'ezgif-3e8f305767bab817-jpg';
        this.frameCount = 300;
        this.performanceMode = isMobile || prefersReducedData || isSlowNetwork;
        this.frameStride = this.performanceMode
            ? (prefersReducedData || isSlowNetwork ? 3 : 2)
            : 1;
        this.scrollFrameCount = Math.ceil(this.frameCount / this.frameStride);
        this.currentTargetFrame = 0;
        this.lastRenderedFrame = -1;
        this.renderRaf = 0;
        this.backgroundWarmupStarted = false;

        this.loadedFrames = new Set([0]);
        this.failedFrames = new Set();
        this.loadingFrames = new Set();
        this.queuedFrames = new Set();
        this.loadQueue = [];
        this.activeLoads = 0;
        this.maxConcurrentLoads = this.performanceMode ? 2 : 5;
        this.prefetchRadius = this.performanceMode ? 3 : 7;
        this.revealThreshold = 0.12;

        this.handleScroll = this.handleScroll.bind(this);
        this.handleResize = this.handleResize.bind(this);

        if (!this.imageElement || !this.scrollSpacer) return;

        this.setupScrollDistance();
        this.renderFrame(0);
        this.bindEvents();
        this.enqueueFrame(0, true);
        this.updateFromScroll();
    }

    setupScrollDistance() {
        // Long spacer gives enough precision for 300-frame interpolation.
        const sequenceDistanceVh = this.performanceMode ? 340 : 560;
        this.scrollSpacer.style.height = `${sequenceDistanceVh}vh`;
    }

    getFramePath(index) {
        const padded = String(index + 1).padStart(3, '0');
        return `${this.sequenceFolder}/ezgif-frame-${padded}.jpg`;
    }

    getScrollProgress() {
        const maxScrollable = Math.max(this.scrollSpacer.offsetHeight - window.innerHeight, 1);
        return Math.min(Math.max(window.scrollY / maxScrollable, 0), 1);
    }

    bindEvents() {
        window.addEventListener('scroll', this.handleScroll, { passive: true });
        window.addEventListener('resize', this.handleResize, { passive: true });
    }

    handleScroll() {
        if (this.renderRaf) return;
        this.renderRaf = requestAnimationFrame(() => {
            this.renderRaf = 0;
            this.updateFromScroll();
        });
    }

    handleResize() {
        this.setupScrollDistance();
        this.updateFromScroll();
    }

    updateFromScroll() {
        const progress = this.getScrollProgress();
        const targetSequenceFrame = Math.round(progress * (this.scrollFrameCount - 1));
        const targetFrame = progress >= 1
            ? this.frameCount - 1
            : Math.min(targetSequenceFrame * this.frameStride, this.frameCount - 1);
        this.currentTargetFrame = targetFrame;

        this.queuePriorityFrames(targetFrame);
        this.renderBestAvailable(targetFrame);

        if (progress >= this.revealThreshold && this.typographyReveal) {
            this.typographyReveal.reveal();
        }

        if (!this.backgroundWarmupStarted && progress > 0.02) {
            this.backgroundWarmupStarted = true;
            this.startBackgroundWarmup();
        }
    }

    queuePriorityFrames(targetFrame) {
        this.enqueueFrame(targetFrame, true);
        for (let step = 1; step <= this.prefetchRadius; step++) {
            const offset = step * this.frameStride;
            this.enqueueFrame(targetFrame + offset, true);
            this.enqueueFrame(targetFrame - offset, true);
        }
    }

    startBackgroundWarmup() {
        let index = 0;
        const queueChunkSize = this.performanceMode ? 12 : 24;
        const queueDelay = this.performanceMode ? 180 : 120;
        const queueNextChunk = () => {
            let queued = 0;
            while (index < this.frameCount && queued < queueChunkSize) {
                this.enqueueFrame(index, false);
                index += this.frameStride;
                queued++;
            }
            if (index < this.frameCount) {
                setTimeout(queueNextChunk, queueDelay);
            }
        };
        queueNextChunk();
    }

    enqueueFrame(index, highPriority) {
        const normalizedIndex = Math.round(index / this.frameStride) * this.frameStride;
        const clampedIndex = Math.max(0, Math.min(normalizedIndex, this.frameCount - 1));

        if (this.loadedFrames.has(clampedIndex) || this.failedFrames.has(clampedIndex)) return;
        if (this.loadingFrames.has(clampedIndex) || this.queuedFrames.has(clampedIndex)) return;

        this.queuedFrames.add(clampedIndex);
        if (highPriority) {
            this.loadQueue.unshift(clampedIndex);
        } else {
            this.loadQueue.push(clampedIndex);
        }
        this.processQueue();
    }

    processQueue() {
        while (this.activeLoads < this.maxConcurrentLoads && this.loadQueue.length > 0) {
            const index = this.loadQueue.shift();
            if (typeof index !== 'number') continue;

            this.queuedFrames.delete(index);
            if (this.loadedFrames.has(index) || this.loadingFrames.has(index)) continue;

            this.loadingFrames.add(index);
            this.activeLoads++;

            const image = new Image();
            image.decoding = 'async';
            image.loading = 'eager';
            image.src = this.getFramePath(index);

            const finishLoad = () => {
                this.loadingFrames.delete(index);
                this.loadedFrames.add(index);
                this.activeLoads = Math.max(0, this.activeLoads - 1);

                if (index === this.currentTargetFrame) {
                    this.renderFrame(index);
                }
                this.processQueue();
            };

            image.onload = () => {
                if (typeof image.decode === 'function') {
                    image.decode().catch(() => undefined).finally(finishLoad);
                    return;
                }
                finishLoad();
            };
            image.onerror = () => {
                this.loadingFrames.delete(index);
                this.failedFrames.add(index);
                this.activeLoads = Math.max(0, this.activeLoads - 1);
                this.processQueue();
            };
        }
    }

    renderBestAvailable(targetFrame) {
        if (this.loadedFrames.has(targetFrame)) {
            this.renderFrame(targetFrame);
            return;
        }

        let nearestBack = targetFrame;
        while (nearestBack >= 0 && !this.loadedFrames.has(nearestBack)) {
            nearestBack -= this.frameStride;
        }
        if (nearestBack >= 0) {
            this.renderFrame(nearestBack);
            return;
        }

        let nearestForward = targetFrame + this.frameStride;
        while (nearestForward < this.frameCount && !this.loadedFrames.has(nearestForward)) {
            nearestForward += this.frameStride;
        }
        if (nearestForward < this.frameCount) {
            this.renderFrame(nearestForward);
        }
    }

    renderFrame(index) {
        if (index === this.lastRenderedFrame) return;
        this.imageElement.src = this.getFramePath(index);
        this.lastRenderedFrame = index;
    }

    destroy() {
        window.removeEventListener('scroll', this.handleScroll);
        window.removeEventListener('resize', this.handleResize);
        if (this.renderRaf) {
            cancelAnimationFrame(this.renderRaf);
            this.renderRaf = 0;
        }
        this.loadQueue.length = 0;
        this.queuedFrames.clear();
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
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobile ? 1.25 : 2));
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
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobile ? 1.25 : 2));
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

let typographyReveal;
let heroFrameSequence;
let model3DViewer;

document.addEventListener('DOMContentLoaded', async () => {
    // Keep preload flow, then start one-time hero typography reveal.
    document.body.style.overflow = 'hidden';

    const preloader = new Preloader();
    await preloader.init();

    new ScrollProgress();
    setupLazyLoading();
    optimizePerformance();

    typographyReveal = new TypographyReveal({ autoObserve: false });
    heroFrameSequence = new HeroFrameSequence({ typographyReveal });
    if (hasGSAP && hasScrollTrigger) initCaseStudyAnimations();
    model3DViewer = new Model3DViewer();
});

window.addEventListener('beforeunload', () => {
    if (typographyReveal) typographyReveal.destroy();
    if (heroFrameSequence) heroFrameSequence.destroy();
    if (hasGSAP) gsap.killTweensOf('*');
});

window.RollsRoyceCinematic = {
    refresh: () => {
        if (hasScrollTrigger) ScrollTrigger.refresh();
    },
    destroy: () => {
        if (typographyReveal) typographyReveal.destroy();
        if (heroFrameSequence) heroFrameSequence.destroy();
    },
    rebuild: () => {
        if (typographyReveal) typographyReveal.destroy();
        if (heroFrameSequence) heroFrameSequence.destroy();
        typographyReveal = new TypographyReveal({ autoObserve: false });
        heroFrameSequence = new HeroFrameSequence({ typographyReveal });
        if (hasScrollTrigger) ScrollTrigger.refresh();
    }
};

