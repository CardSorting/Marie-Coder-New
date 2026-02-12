function showSection(id) {
    document.querySelectorAll('.doc-section').forEach(section => {
        section.classList.remove('visible');
    });

    const target = document.getElementById(id);

    if (target) {
        target.classList.add('visible');
    }

    document.querySelectorAll('.sidebar-nav a').forEach(link => {
        link.classList.remove('active');
    });
    event.currentTarget.classList.add('active');

    if (window.innerWidth <= 900) {
        toggleSidebar();
    }

    window.scrollTo({
        top: 0, behavior: 'smooth'
    });
}

function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('active');
}

function filterNav(query) {
    const links = document.querySelectorAll('#sidebar-nav a:not(.start-pres-btn)'); // Exclude presentation button
    const q = query.toLowerCase();

    links.forEach(link => {
        const text = link.innerText.toLowerCase();
        const tags = link.getAttribute('data-tags').toLowerCase();

        if (text.includes(q) || tags.includes(q)) {
            link.parentElement.style.display = 'block';
        }

        else {
            link.parentElement.style.display = 'none';
        }
    });
}

function copyCode(btn) {
    const code = btn.nextElementSibling.innerText;

    navigator.clipboard.writeText(code).then(() => {
        const originalText = btn.innerText;
        btn.innerText = 'Copied!';
        setTimeout(() => btn.innerText = originalText, 2000);
    });
}
