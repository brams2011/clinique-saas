'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Check } from 'lucide-react'

const plans = [
  {
    name: 'Starter',
    monthlyPrice: 79,
    description: 'Idéal pour les praticiens solo',
    features: [
      '1 médecin',
      "Jusqu'à 200 patients",
      'Agenda + Dossiers patients',
      'Support email',
    ],
    cta: 'Commencer',
    popular: false,
  },
  {
    name: 'Pro',
    monthlyPrice: 149,
    description: 'Pour les cliniques en croissance',
    features: [
      '5 médecins',
      'Patients illimités',
      'Facturation RAMQ automatique',
      'Agent IA téléphonique 24/7',
      'Support prioritaire 7j/7',
    ],
    cta: 'Essayer 14 jours gratuit',
    popular: true,
  },
  {
    name: 'Enterprise',
    monthlyPrice: null,
    description: 'Pour les groupes et multi-cliniques',
    features: [
      'Médecins illimités',
      'Multi-cliniques',
      'Intégration sur mesure',
      'Account manager dédié',
    ],
    cta: 'Nous contacter',
    popular: false,
  },
]

export default function PricingSection() {
  const [annual, setAnnual] = useState(false)

  return (
    <section id="tarifs" className="py-20 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          className="text-center mb-12"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <span className="text-accent font-semibold text-sm uppercase tracking-widest">
            Tarifs
          </span>
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mt-2">
            Des tarifs simples et transparents
          </h2>

          {/* Monthly / Annual toggle */}
          <div className="flex items-center justify-center gap-4 mt-8">
            <span
              className={`text-sm font-semibold transition-colors ${
                !annual ? 'text-gray-900' : 'text-gray-400'
              }`}
            >
              Mensuel
            </span>
            <button
              onClick={() => setAnnual(!annual)}
              className={`relative w-14 h-7 rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${
                annual ? 'bg-primary' : 'bg-gray-300'
              }`}
              role="switch"
              aria-checked={annual}
              aria-label="Basculer entre facturation mensuelle et annuelle"
            >
              <div
                className={`absolute top-0.5 left-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform duration-200 ${
                  annual ? 'translate-x-7' : 'translate-x-0'
                }`}
              />
            </button>
            <span
              className={`flex items-center gap-2 text-sm font-semibold transition-colors ${
                annual ? 'text-gray-900' : 'text-gray-400'
              }`}
            >
              Annuel
              <span className="inline-flex items-center px-2 py-0.5 bg-accent-50 text-accent text-xs font-bold rounded-full border border-accent-100">
                -20%
              </span>
            </span>
          </div>
        </motion.div>

        {/* Pricing cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch">
          {plans.map((plan, i) => (
            <motion.div
              key={i}
              className={`relative flex flex-col bg-white rounded-2xl p-8 ${
                plan.popular
                  ? 'border-2 border-primary shadow-xl'
                  : 'border border-gray-200 shadow-sm'
              }`}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
            >
              {/* Popular badge */}
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                  <span className="inline-flex items-center px-4 py-1.5 bg-primary text-white text-sm font-bold rounded-full shadow-lg">
                    ⭐ Populaire
                  </span>
                </div>
              )}

              {/* Plan name & description */}
              <div className="mb-6">
                <h3 className="text-xl font-bold text-gray-900 mb-1">{plan.name}</h3>
                <p className="text-gray-500 text-sm">{plan.description}</p>
              </div>

              {/* Price */}
              <div className="mb-6">
                {plan.monthlyPrice !== null ? (
                  <>
                    <div className="flex items-end gap-1">
                      <span className="text-4xl font-extrabold text-gray-900">
                        {annual
                          ? Math.round(plan.monthlyPrice * 0.8)
                          : plan.monthlyPrice}$
                      </span>
                      <span className="text-gray-400 mb-1.5">/mois</span>
                    </div>
                    {annual && (
                      <p className="text-xs text-accent font-medium mt-1">
                        Économisez {Math.round(plan.monthlyPrice * 0.2 * 12)}$ par an
                      </p>
                    )}
                  </>
                ) : (
                  <div className="text-4xl font-extrabold text-gray-900">Sur devis</div>
                )}
              </div>

              {/* Features */}
              <ul className="flex-1 space-y-3 mb-8">
                {plan.features.map((feature, j) => (
                  <li key={j} className="flex items-start gap-3">
                    <div className="mt-0.5 w-5 h-5 rounded-full bg-accent-50 flex items-center justify-center flex-shrink-0">
                      <Check className="w-3 h-3 text-accent" aria-hidden="true" />
                    </div>
                    <span className="text-gray-700 text-sm leading-snug">{feature}</span>
                  </li>
                ))}
              </ul>

              {/* CTA */}
              <button
                onClick={() => console.log('[analytics] pricing_cta click', { plan: plan.name, annual })}
                className={`w-full py-3 px-6 rounded-xl font-semibold text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                  plan.popular
                    ? 'bg-primary text-white hover:bg-primary-dark focus:ring-primary shadow-lg'
                    : plan.monthlyPrice === null
                    ? 'border border-gray-300 text-gray-700 hover:bg-gray-50 focus:ring-gray-300'
                    : 'border-2 border-primary text-primary hover:bg-primary-50 focus:ring-primary'
                }`}
                aria-label={`${plan.cta} — Plan ${plan.name}`}
              >
                {plan.cta}
              </button>
            </motion.div>
          ))}
        </div>

        {/* Footer note */}
        <p className="text-center text-sm text-gray-400 mt-8">
          Tous les prix sont en CAD · Taxes applicables en sus · Annulation à tout moment
        </p>
      </div>
    </section>
  )
}
