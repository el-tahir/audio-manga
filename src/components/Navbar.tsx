import Link from 'next/link';

export default function Navbar() {
  return (
    <nav style={{
      padding: '1rem',
      backgroundColor: '#0C0A0AFF',
      marginBottom: '1rem'
    }}>
      <div style={{
        display: 'flex',
        gap: '1rem',
        maxWidth: '800px',
        margin: '0 auto'
      }}>
        <Link href="/" style={{ color: 'white', textDecoration: 'none' }}>
          Home
        </Link>
        <Link href="/manga-classifier" style={{ color: 'white', textDecoration: 'none' }}>
          Manga Classifier
        </Link>
      </div>
    </nav>
  );
}
