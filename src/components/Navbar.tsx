import Link from 'next/link';

export default function Navbar() {
  return (
    <nav className="p-4 bg-[var(--bg-primary)] mb-4">
      <div className="container mx-auto flex gap-4 max-w-4xl">
        <Link href="/" className="text-white no-underline hover:text-gray-300 transition-colors">
          Home
        </Link>
        <Link href="/manga-classifier" className="text-white no-underline hover:text-gray-300 transition-colors">
          Add New Chapter
        </Link>
      </div>
    </nav>
  );
}
