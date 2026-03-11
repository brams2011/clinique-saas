'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown } from 'lucide-react'

const faqs = [
  {
    question: 'Est-ce conforme aux lois canadiennes sur la vie privée ?',
    answer:
      'Oui, CliniqueSaaS est entièrement conforme à la loi PIPEDA (Protection des renseignements personnels et les documents électroniques) et à la Loi 25 du Québec. Toutes les données sont chiffrées au repos et en transit, hébergées exclusivement au Canada.',
  },
  {
    question: 'Combien de temps pour la mise en place ?',
    answer:
      'La plupart de nos clients sont opérationnels en 48 heures. Notre équipe vous accompagne à chaque étape : configuration initiale, import des données et formation de votre équipe — inclus dans tous les plans.',
  },
  {
    question: 'Peut-on migrer nos données depuis un autre logiciel ?',
    answer:
      "Absolument. Nous supportons l'import depuis les principaux logiciels médicaux québécois (Medesync, Omnimed, MYLE, etc.). Notre équipe technique s'occupe de toute la migration sans interruption de service.",
  },
  {
    question: "L'agent IA parle-t-il français et anglais ?",
    answer:
      "Oui, l'agent IA est parfaitement bilingue français/anglais. Il s'adapte automatiquement à la langue du patient et peut gérer des appels en d'autres langues sur demande.",
  },
  {
    question: "Y a-t-il un engagement de durée ?",
    answer:
      "Non, aucun engagement minimal. Vous pouvez annuler à tout moment sans frais. Les abonnements annuels bénéficient de 20% de réduction avec remboursement au prorata si vous annulez.",
  },
  {
    question: 'Comment fonctionne le support ?',
    answer:
      'Le support varie selon votre plan : email pour Starter (réponse sous 24h), prioritaire pour Pro (réponse sous 2h, 7j/7), et un account manager dédié pour Enterprise. Tous les plans incluent notre base de connaissances et les tutoriels vidéo.',
  },
]

function FAQItem({ faq, index }: { faq: (typeof faqs)[0]; index: number }) {
  const [isOpen, setIsOpen] = useState(false)
  const answerId = `faq-answer-${index}`

  return (
    <motion.div
      className="border border-gray-200 rounded-xl overflow-hidden bg-white"
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4, delay: index * 0.07 }}
    >
      <button
        className="w-full flex items-center justify-between gap-4 px-6 py-5 text-left hover:bg-gray-50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-controls={answerId}
      >
        <span className="font-semibold text-gray-900 text-sm leading-snug">{faq.question}</span>
        <ChevronDown
          className={`w-5 h-5 text-gray-400 flex-shrink-0 transition-transform duration-200 ${
            isOpen ? 'rotate-180' : ''
          }`}
          aria-hidden="true"
        />
      </button>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            id={answerId}
            role="region"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            style={{ overflow: 'hidden' }}
          >
            <div className="px-6 pb-5 pt-0 text-gray-600 text-sm leading-relaxed border-t border-gray-100">
              <div className="pt-4">{faq.answer}</div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

export default function FAQSection() {
  return (
    <section id="faq" className="py-20 bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          className="text-center mb-12"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <span className="text-accent font-semibold text-sm uppercase tracking-widest">
            FAQ
          </span>
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mt-2">
            Questions fréquentes
          </h2>
          <p className="text-gray-600 mt-4 leading-relaxed">
            Vous avez d&apos;autres questions ?{' '}
            <a href="#" className="text-primary font-semibold hover:underline">
              Contactez notre équipe
            </a>
          </p>
        </motion.div>

        {/* Accordion */}
        <div className="space-y-3">
          {faqs.map((faq, i) => (
            <FAQItem key={i} faq={faq} index={i} />
          ))}
        </div>
      </div>
    </section>
  )
}
