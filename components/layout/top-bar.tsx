import Link from "next/link";

export function TopBar() {
  return (
    <header className="border-b border-bone-200 bg-bone-50/80 backdrop-blur sticky top-0 z-20">
      <div className="container flex items-center justify-between h-14">
        <Link href="/" className="font-display text-xl text-teal-700 tracking-tight">
          FisiaPrep
        </Link>
        <nav className="flex items-center gap-6 text-sm">
          <Link href="/" className="text-ink-600 hover:text-teal-700">Temas</Link>
          <Link href="/review" className="text-ink-600 hover:text-teal-700">Repaso</Link>
          <Link href="/examen" className="text-ink-600 hover:text-teal-700">Examen</Link>
          <Link href="/car-mode" className="text-ink-600 hover:text-teal-700">Modo Carro</Link>
        </nav>
      </div>
    </header>
  );
}
