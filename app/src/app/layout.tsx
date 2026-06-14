import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'siL3t — Leveraged Launchpad',
  description: 'Launch bigger. Get liquidated faster.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-gray-950 text-white min-h-screen">
        <nav className="border-b border-gray-800 px-6 py-4">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold bg-gradient-to-r from-orange-500 to-red-500 bg-clip-text text-transparent">
                siL3t
              </span>
              <span className="text-xs text-gray-500 border border-gray-700 px-2 py-0.5 rounded">
                BETA
              </span>
            </div>
            <div className="flex items-center gap-6">
              <a href="/launches" className="text-gray-400 hover:text-white transition">Launches</a>
              <a href="/portfolio" className="text-gray-400 hover:text-white transition">Portfolio</a>
              <a href="/lend" className="text-gray-400 hover:text-white transition">Lend</a>
              <a href="/stats" className="text-gray-400 hover:text-white transition">Stats</a>
              <button className="bg-orange-600 hover:bg-orange-700 px-4 py-2 rounded-lg font-medium transition">
                Connect Wallet
              </button>
            </div>
          </div>
        </nav>
        <main className="max-w-7xl mx-auto px-6 py-8">
          {children}
        </main>
      </body>
    </html>
  );
}
