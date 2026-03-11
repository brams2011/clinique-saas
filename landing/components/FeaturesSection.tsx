'use client'

import { motion } from 'framer-motion'
import { Calendar, User, Receipt, Bot, BarChart3, Shield } from 'lucide-react'

const features = [
  {
    icon: Calendar,
    title: 'Agenda intelligent',
    description:
      'Gérez vos rendez-vous avec des rappels SMS et email automatiques. Réduisez les absences de 40%.',
    colorClass: 'bg-primary-50 text-primary',
  },
  {
    icon: User,
    title: 'Dossiers patients',
    description:
      'Historique complet, ordonnances, documents — tout centralisé et accessible en un clic.',
    colorClass: 'bg-accent-50 text-accent',
  },
  {
    icon: Receipt,
    title: 'Facturation RAMQ',
    description:
      'Génération automatique, envoi PDF, suivi des paiements. Zéro erreur, zéro délai.',
    colorClass: 'bg-blue-50 text-blue-600',
  },
  {
    icon: Bot,
    title: 'Agent IA',
    description:
      'Prise de rendez-vous vocale 24/7 par téléphone. Votre clinique ne dort jamais.',
    colorClass: 'bg-purple-50 text-purple-600',
  },
  {
    icon: BarChart3,
    title: 'Tableaux de bord',
    description:
      "Statistiques revenus, taux d'occupation, performances — pilotez avec des données en temps réel.",
    colorClass: 'bg-orange-50 text-orange-600',
  },
  {
    icon: Shield,
    title: 'Sécurité PIPEDA',
    description:
      'Données chiffrées de bout en bout. Conformité réglementaire canadienne garantie.',
    colorClass: 'bg-teal-50 text-teal-600',
  },
]

export default function FeaturesSection() {
  return (
    <section id="fonctionnalites" className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <span className="text-accent font-semibold text-sm uppercase tracking-widest">
            Fonctionnalités
          </span>
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mt-2">
            Tout ce dont votre clinique a besoin
          </h2>
          <p className="text-lg text-gray-600 mt-4 max-w-2xl mx-auto leading-relaxed">
            Une suite complète d&apos;outils pensée pour les professionnels de santé québécois.
          </p>
        </motion.div>

        {/* Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, i) => (
            <motion.div
              key={i}
              className="group p-6 bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:border-primary-100 transition-all duration-300"
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.08 }}
            >
              <div
                className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${feature.colorClass} transition-transform duration-300 group-hover:scale-110`}
              >
                <feature.icon className="w-6 h-6" aria-hidden="true" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">{feature.title}</h3>
              <p className="text-gray-600 text-sm leading-relaxed">{feature.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
