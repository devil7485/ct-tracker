import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'CT Signal Tracker - Crypto Twitter Accountability',
  description: 'Track and analyze crypto influencer calls with real performance data',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <div className="min-h-screen bg-gray-950 text-white">
          <nav className="border-b border-gray-800 bg-gray-900">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex justify-between items-center h-16">
                <div className="flex items-center">
                  <a href="/" className="text-xl font-bold text-blue-500">
                    CT Signal Tracker
                  </a>
                </div>
                <div className="flex space-x-6">
                  <a href="/" className="text-gray-300 hover:text-white transition">
                    Leaderboard
                  </a>
                  <a href="/about" className="text-gray-300 hover:text-white transition">
                    About
                  </a>
                </div>
              </div>
            </div>
          </nav>
          {children}
        </div>
      </body>
    </html>
  )
}
