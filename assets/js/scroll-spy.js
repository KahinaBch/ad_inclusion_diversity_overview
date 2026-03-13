// Scroll spy functionality for sidebar navigation
document.addEventListener('DOMContentLoaded', function() {
  const sidebar = document.querySelector('.sidebar-nav');
  if (!sidebar) return; // Exit if sidebar doesn't exist

  const sections = document.querySelectorAll('.scroll-section');
  const navLinks = sidebar.querySelectorAll('a');

  function updateActiveLink() {
    let current = '';

    sections.forEach((section) => {
      const sectionTop = section.offsetTop;
      const sectionHeight = section.clientHeight;
      if (scrollY >= sectionTop - 200) {
        current = section.getAttribute('id');
      }
    });

    navLinks.forEach((link) => {
      link.classList.remove('active');
      if (link.getAttribute('href').slice(1) === current) {
        link.classList.add('active');
      }
    });
  }

  // Smooth scroll behavior
  navLinks.forEach((link) => {
    link.addEventListener('click', function(e) {
      const targetId = this.getAttribute('href').slice(1);
      const targetSection = document.getElementById(targetId);
      
      if (targetSection) {
        e.preventDefault();
        targetSection.scrollIntoView({ behavior: 'smooth' });
        updateActiveLink();
      }
    });
  });

  // Update active link on scroll
  window.addEventListener('scroll', updateActiveLink);
  
  // Initial check
  updateActiveLink();
});
