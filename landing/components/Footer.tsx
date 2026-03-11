import { Activity, Twitter, Linkedin, Facebook, Youtube } from 'lucide-react'

const footerLinks: Record<string, { label: string; href: string }[]> = {
  Produit: [
    { label: 'Fonctionnalités', href: '#fonctionnalites' },
    { label: 'Tarifs', href: '#tarifs' },
    { label: 'Mises à jour', href: '#' },
    { label: 'Feuille de route', href: '#' },
  ],
  Entreprise: [
    { label: 'À propos', href: '#' },
    { label: 'Blog', href: '#' },
    { label: 'Carrières', href: '#' },
    { label: 'Partenaires', href: '#' },
  ],
  Légal: [
    { label: 'Politique de confidentialité', href: '#' },
    { label: "Conditions d'utilisation", href: '#' },
    { label: 'Conformité PIPEDA', href: '#' },
    { label: 'Sécurité', href: '#' },
  ],
  Contact: [
    { label: 'Support', href: '#' },
    { label: 'Ventes', href: '#' },
    { label: 'Démo', href: '#' },
    { label: 'Status', href: '#' },
  ],
}

const socialLinks = [
  { Icon: Twitter, label: 'Twitter / X', href: '#' },
  { Icon: Linkedin, label: 'LinkedIn', href: '#' },
  { Icon: Facebook, label: 'Facebook', href: '#' },
  { Icon: Youtube, label: 'YouTube', href: '#' },
]

export default function Footer() {
  return (
    <footer className="bg-gray-900 text-gray-400" aria-label="Pied de page">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-8">
        {/* Top grid */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-10 mb-12">
          {/* Brand column */}
          <div className="col-span-2 md:col-span-1">
            <a href="#" className="inline-flex items-center gap-2.5 mb-4" aria-label="CliniqueSaaS — retour à l'accueil">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center shadow-sm">
                <Activity className="w-5 h-5 text-white" strokeWidth={2.5} aria-hidden="true" />
              </div>
              <span className="text-lg font-bold text-white">CliniqueSaaS</span>
            </a>
            <p className="text-sm text-gray-500 leading-relaxed">
              La plateforme tout-en-un pour moderniser et simplifier la gestion
              de votre clinique médicale au Québec.
            </p>
          </div>

          {/* Link columns */}
          {Object.entries(footerLinks).map(([category, links]) => (
            <div key={category}>
              <h3 className="text-sm font-semibold text-white mb-4">{category}</h3>
              <ul className="space-y-3">
                {links.map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      className="text-sm text-gray-500 hover:text-white transition-colors duration-150"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Divider */}
        <div className="border-t border-gray-800 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-gray-600 text-center sm:text-left">
            © {new Date().getFullYear()} CliniqueSaaS Inc. Tous droits réservés. Fait au Québec 🍁
          </p>

          {/* Social links */}
          <div className="flex items-center gap-3">
            {socialLinks.map(({ Icon, label, href }) => (
              <a
                key={label}
                href={href}
                className="w-9 h-9 rounded-lg bg-gray-800 flex items-center justify-center text-gray-500 hover:text-white hover:bg-gray-700 transition-colors duration-150"
                aria-label={`Suivez-nous sur ${label}`}
              >
                <Icon className="w-4 h-4" aria-hidden="true" />
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  )
}
