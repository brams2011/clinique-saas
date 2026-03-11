import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700', '800', '900'],
  variable: '--font-inter',
})

export const metadata: Metadata = {
  title: 'CliniqueSaaS — La plateforme tout-en-un pour gérer votre clinique',
  description:
    'Rendez-vous, dossiers patients, facturation RAMQ et communication — tout en un seul endroit. Rejoignez 500+ cliniques au Québec.',
  keywords: [
    'logiciel clinique médicale',
    'facturation RAMQ',
    'dossier patient électronique',
    'agenda médical',
    'gestion clinique Québec',
  ],
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="fr" className={inter.variable}>
      <body className="font-sans">{children}</body>
    </html>
  )
}
