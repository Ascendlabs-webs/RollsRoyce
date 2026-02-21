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
        this.frameContainer = this.imageElement?.parentElement || null;
        this.scrollSpacer = document.querySelector('.scroll-spacer');

        this.sequenceFolder = 'ezgif-3e8f305767bab817-jpg';
        this.frameCount = 300;
        this.currentTargetFrameFloat = 0;
        this.currentRenderFrameFloat = 0;
        this.renderRaf = 0;
        this.backgroundWarmupStarted = false;
        this.warmupTimer = 0;
        this.hasFirstCanvasPaint = false;

        this.loadedFrames = new Set();
        this.failedFrames = new Set();
        this.loadingFrames = new Set();
        this.queuedFrames = new Set();
        this.frameCache = new Map();
        this.loadQueue = [];
        this.activeLoads = 0;

        const conservativeNetwork = prefersReducedData || isSlowNetwork;
        this.maxConcurrentLoads = conservativeNetwork ? (isMobile ? 2 : 3) : (isMobile ? 4 : 7);
        this.prefetchRadius = conservativeNetwork ? 8 : 14;
        this.revealThreshold = 0.12;
        this.smoothingFactor = window.matchMedia('(prefers-reduced-motion: reduce)').matches
            ? 1
            : (isMobile ? 0.26 : 0.18);

        this.frameCanvas = null;
        this.ctx = null;
        this.canvasCssWidth = 0;
        this.canvasCssHeight = 0;
        this.canvasRatio = 1;
        this.fitMode = isMobile ? 'contain' : 'cover';
        this.lastFallbackFrame = -1;

        this.handleScroll = this.handleScroll.bind(this);
        this.handleResize = this.handleResize.bind(this);

        if (!this.imageElement || !this.scrollSpacer || !this.frameContainer) return;

        this.setupCanvas();
        this.setupScrollDistance();
        this.bindEvents();
        this.registerLoadedFrame(0, this.imageElement);
        this.drawStaticFrame(0);
        this.queuePriorityFrames(0);
        this.startBackgroundWarmup();
        this.updateFromScroll();
        this.startRenderLoop();
    }

    setupScrollDistance() {
        // Longer spacer gives more precision so frame interpolation feels cinematic.
        const sequenceDistanceVh = isMobile ? 520 : 620;
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

    setupCanvas() {
        if (!this.frameContainer) return;

        this.frameCanvas = document.createElement('canvas');
        this.frameCanvas.className = 'frame-canvas';
        this.frameCanvas.setAttribute('aria-hidden', 'true');
        this.frameContainer.appendChild(this.frameCanvas);

        this.ctx = this.frameCanvas.getContext('2d', {
            alpha: false,
            desynchronized: true
        });
        if (!this.ctx) {
            this.frameCanvas.remove();
            this.frameCanvas = null;
            return;
        }
        this.resizeCanvas();
    }

    resizeCanvas() {
        if (!this.frameCanvas || !this.ctx || !this.frameContainer) return;

        const rect = this.frameContainer.getBoundingClientRect();
        const cssWidth = Math.max(1, Math.round(rect.width));
        const cssHeight = Math.max(1, Math.round(rect.height));
        const maxRatio = isMobile ? 1.25 : 1.75;
        const ratio = Math.min(window.devicePixelRatio || 1, maxRatio);
        this.fitMode = window.innerWidth <= 768 ? 'contain' : 'cover';

        this.canvasCssWidth = cssWidth;
        this.canvasCssHeight = cssHeight;
        this.canvasRatio = ratio;

        this.frameCanvas.width = Math.max(1, Math.round(cssWidth * ratio));
        this.frameCanvas.height = Math.max(1, Math.round(cssHeight * ratio));
        this.frameCanvas.style.width = `${cssWidth}px`;
        this.frameCanvas.style.height = `${cssHeight}px`;

        this.ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
        this.ctx.imageSmoothingEnabled = true;
        if ('imageSmoothingQuality' in this.ctx) {
            this.ctx.imageSmoothingQuality = 'high';
        }
    }

    bindEvents() {
        window.addEventListener('scroll', this.handleScroll, { passive: true });
        window.addEventListener('resize', this.handleResize, { passive: true });
    }

    handleScroll() {
        this.updateFromScroll();
    }

    handleResize() {
        this.setupScrollDistance();
        this.resizeCanvas();
        this.render();
        this.updateFromScroll();
    }

    updateFromScroll() {
        const progress = this.getScrollProgress();
        this.currentTargetFrameFloat = progress * (this.frameCount - 1);
        this.queuePriorityFrames(Math.round(this.currentTargetFrameFloat));

        if (progress >= this.revealThreshold && this.typographyReveal) {
            this.typographyReveal.reveal();
        }
    }

    startRenderLoop() {
        if (this.renderRaf) return;
        const tick = () => {
            this.renderRaf = requestAnimationFrame(tick);
            this.render();
        };
        this.renderRaf = requestAnimationFrame(tick);
    }

    render() {
        const delta = this.currentTargetFrameFloat - this.currentRenderFrameFloat;
        if (this.smoothingFactor >= 1 || Math.abs(delta) < 0.001) {
            this.currentRenderFrameFloat = this.currentTargetFrameFloat;
        } else {
            this.currentRenderFrameFloat += delta * this.smoothingFactor;
        }

        const clampedFrame = Math.min(Math.max(this.currentRenderFrameFloat, 0), this.frameCount - 1);
        const baseFrame = Math.floor(clampedFrame);
        const nextFrame = Math.min(baseFrame + 1, this.frameCount - 1);
        const mix = clampedFrame - baseFrame;

        this.enqueueFrame(baseFrame, true);
        if (nextFrame !== baseFrame) {
            this.enqueueFrame(nextFrame, true);
        }

        this.renderInterpolated(baseFrame, nextFrame, mix);
    }

    queuePriorityFrames(targetFrame) {
        this.enqueueFrame(targetFrame, true);
        for (let step = 1; step <= this.prefetchRadius; step++) {
            this.enqueueFrame(targetFrame + step, true);
            this.enqueueFrame(targetFrame - step, true);
        }
    }

    startBackgroundWarmup() {
        if (this.backgroundWarmupStarted) return;
        this.backgroundWarmupStarted = true;

        let index = 0;
        const queueChunkSize = isMobile ? 14 : 26;
        const queueDelay = isMobile ? 90 : 60;

        const queueNextChunk = () => {
            let queued = 0;
            while (index < this.frameCount && queued < queueChunkSize) {
                this.enqueueFrame(index, false);
                index++;
                queued++;
            }
            if (index < this.frameCount) {
                this.warmupTimer = window.setTimeout(queueNextChunk, queueDelay);
            }
        };
        queueNextChunk();
    }

    registerLoadedFrame(index, image) {
        if (index < 0 || index >= this.frameCount || !image) return;
        this.loadedFrames.add(index);
        this.frameCache.set(index, image);
    }

    enqueueFrame(index, highPriority) {
        if (index < 0 || index >= this.frameCount) return;

        if (this.loadedFrames.has(index) || this.failedFrames.has(index)) return;
        if (this.loadingFrames.has(index) || this.queuedFrames.has(index)) return;

        this.queuedFrames.add(index);
        if (highPriority) {
            this.loadQueue.unshift(index);
        } else {
            this.loadQueue.push(index);
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
                this.registerLoadedFrame(index, image);
                this.activeLoads = Math.max(0, this.activeLoads - 1);
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

    renderInterpolated(baseFrame, nextFrame, mix) {
        if (!this.ctx || !this.frameCanvas) {
            this.renderFallbackFrame(mix >= 0.5 ? nextFrame : baseFrame);
            return;
        }

        const baseImage = this.frameCache.get(baseFrame);
        const nextImage = this.frameCache.get(nextFrame);

        if (baseImage && nextImage && nextFrame !== baseFrame && mix > 0.001) {
            this.drawBlendedFrames(baseImage, 1 - mix, nextImage, mix);
            return;
        }

        if (baseImage) {
            this.drawSingleFrame(baseImage);
            return;
        }

        if (nextImage) {
            this.drawSingleFrame(nextImage);
            return;
        }

        this.renderNearestAvailable(baseFrame);
    }

    renderNearestAvailable(targetFrame) {
        let nearestBack = targetFrame;
        while (nearestBack >= 0 && !this.loadedFrames.has(nearestBack)) {
            nearestBack--;
        }

        if (nearestBack >= 0) {
            const image = this.frameCache.get(nearestBack);
            if (image) this.drawSingleFrame(image);
            return;
        }

        let nearestForward = targetFrame + 1;
        while (nearestForward < this.frameCount && !this.loadedFrames.has(nearestForward)) {
            nearestForward++;
        }

        if (nearestForward < this.frameCount) {
            const image = this.frameCache.get(nearestForward);
            if (image) this.drawSingleFrame(image);
        }
    }

    drawStaticFrame(index) {
        const image = this.frameCache.get(index);
        if (image) this.drawSingleFrame(image);
    }

    drawSingleFrame(image) {
        this.drawBlendedFrames(image, 1);
    }

    drawBlendedFrames(baseImage, baseAlpha, overlayImage = null, overlayAlpha = 0) {
        if (!this.ctx || !this.frameCanvas || this.canvasCssWidth <= 0 || this.canvasCssHeight <= 0) {
            return;
        }

        const width = this.canvasCssWidth;
        const height = this.canvasCssHeight;

        this.ctx.clearRect(0, 0, width, height);
        this.ctx.fillStyle = '#000';
        this.ctx.fillRect(0, 0, width, height);
        this.drawContainedImage(baseImage, baseAlpha);

        if (overlayImage && overlayAlpha > 0.001) {
            this.drawContainedImage(overlayImage, overlayAlpha);
        }

        if (!this.hasFirstCanvasPaint && this.imageElement) {
            this.imageElement.classList.add('is-canvas-active');
            this.hasFirstCanvasPaint = true;
        }
    }

    drawContainedImage(image, alpha = 1) {
        if (!this.ctx || !image) return;

        const sourceWidth = image.naturalWidth || image.width;
        const sourceHeight = image.naturalHeight || image.height;
        if (!sourceWidth || !sourceHeight) return;

        const frameAspect = this.canvasCssWidth / this.canvasCssHeight;
        const imageAspect = sourceWidth / sourceHeight;
        let drawWidth = this.canvasCssWidth;
        let drawHeight = this.canvasCssHeight;
        const shouldContain = this.fitMode === 'contain';

        if (shouldContain) {
            if (imageAspect > frameAspect) {
                drawHeight = drawWidth / imageAspect;
            } else {
                drawWidth = drawHeight * imageAspect;
            }
        } else if (imageAspect > frameAspect) {
            drawHeight = this.canvasCssHeight;
            drawWidth = drawHeight * imageAspect;
        } else {
            drawWidth = this.canvasCssWidth;
            drawHeight = drawWidth / imageAspect;
        }

        const drawX = (this.canvasCssWidth - drawWidth) / 2;
        const drawY = (this.canvasCssHeight - drawHeight) / 2;

        this.ctx.globalAlpha = Math.max(0, Math.min(alpha, 1));
        this.ctx.drawImage(image, drawX, drawY, drawWidth, drawHeight);
        this.ctx.globalAlpha = 1;
    }

    renderFallbackFrame(index) {
        if (!this.imageElement) return;
        if (index < 0 || index >= this.frameCount) return;
        if (index === this.lastFallbackFrame) return;
        this.imageElement.src = this.getFramePath(index);
        this.lastFallbackFrame = index;
    }

    destroy() {
        window.removeEventListener('scroll', this.handleScroll);
        window.removeEventListener('resize', this.handleResize);
        if (this.warmupTimer) {
            clearTimeout(this.warmupTimer);
            this.warmupTimer = 0;
        }
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

