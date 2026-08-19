import './Footer.css';

const FOOTER_LINKS = [
  { label: 'Privacy', href: '#' },
  { label: 'Terms', href: '#' },
  { label: 'Support', href: '#' },
  { label: 'Contact', href: '#' },
];

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="footer">
      <div className="footer__inner">
        <div className="footer__row">
          <div className="footer__brand">
            <span className="footer__logo">OPUS</span>
            <p className="footer__tagline">Student freelancing across Nepal</p>
          </div>

          <nav className="footer__links" aria-label="Footer">
            {FOOTER_LINKS.map((link) => (
              <a key={link.label} href={link.href} className="footer__link">
                {link.label}
              </a>
            ))}
          </nav>
        </div>

        <p className="footer__copy">
          &copy; {year} OPUS. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
