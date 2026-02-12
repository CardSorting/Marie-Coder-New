/* --- Presentation Logic --- */
let currentSlideIndex = 0;
let slides = [];

function startPresentation() {
    document.body.classList.add('presentation-mode');

    // Gather all visible doc-sections as slides
    // We verify specific IDs to ensure order, or just grab all .doc-section
    // Use the order from the sidebar for expected flow
    const sectionIds = ['mission',
        'architecture',
        'tools',
        'setup',
        'workflow', // New Slide 5
        'physics',  // New Slide 6
        'future'];  // New Slide 7
    slides = [];

    sectionIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) slides.push(el);
    });

    if (slides.length === 0) {
        // Fallback if IDs change
        slides = Array.from(document.querySelectorAll('.doc-section'));
    }

    // Find currently visible section to start there, or default to 0
    const currentVisible = document.querySelector('.doc-section.visible');
    currentSlideIndex = slides.indexOf(currentVisible);
    if (currentSlideIndex === -1) currentSlideIndex = 0;

    showSlide(currentSlideIndex);

    // Add keyboard listener
    document.addEventListener('keydown', handlePresentationKeys);
}

function exitPresentation() {
    document.body.classList.remove('presentation-mode');

    // Cleanup slides
    slides.forEach(slide => {
        slide.classList.remove('active-slide');

        // Ensure the 'visible' class from normal mode is reset properly
        if (slide === slides[currentSlideIndex]) {
            slide.classList.add('visible');
        }

        else {
            slide.classList.remove('visible');
        }
    });

    // Show the current slide as the active section in normal mode
    showSection(slides[currentSlideIndex].id);

    document.removeEventListener('keydown', handlePresentationKeys);
}

function showSlide(index) {
    if (index < 0) index = 0;
    if (index >= slides.length) index = slides.length - 1;

    currentSlideIndex = index;

    // Hide all slides
    slides.forEach(slide => {
        slide.classList.remove('active-slide');
        slide.classList.remove('visible'); // Remove normal mode class to avoid conflicts
    });

    // Show target slide
    slides[currentSlideIndex].classList.add('active-slide');

    // Update counter
    document.getElementById('slide-counter').innerText = `${currentSlideIndex + 1} / ${slides.length}`;

    // Update Progress Bar
    const progress = ((currentSlideIndex + 1) / slides.length) * 100;
    document.getElementById('progress-fill').style.width = `${progress}%`;
}

function nextSlide() {
    showSlide(currentSlideIndex + 1);
}

function prevSlide() {
    showSlide(currentSlideIndex - 1);
}

function handlePresentationKeys(e) {
    if (e.key === 'ArrowRight' || e.key === 'Space') nextSlide();
    if (e.key === 'ArrowLeft') prevSlide();
    if (e.key === 'Escape') exitPresentation();
}
