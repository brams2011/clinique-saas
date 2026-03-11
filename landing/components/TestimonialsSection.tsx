'use client'

import { motion } from 'framer-motion'

const testimonials = [
  {
    quote:
      'CliniqueSaaS a réduit notre temps administratif de 60%. La facturation RAMQ automatique est un game changer.',
    name: 'Dr. Marie Tremblay',
    title: 'Omnipraticienne',
    clinic: 'Clinique Santé Laval',
    avatar: 'https://i.pravatar.cc/96?u=marie-tremblay-md',
  },
  {
    quote:
      "L'agent IA répond à nos patients la nuit. On ne perd plus aucun rendez-vous.",
    name: 'Dr. Ahmed Benali',
    title: 'Directeur',
    clinic: 'Groupe Médical Montréal',
    avatar: 'https://i.pravatar.cc/96?u=ahmed-benali-dr',
  },
  {
    quote:
      'Déploiement en 48h, formation incluse. Notre équipe a adoré dès le premier jour.',
    name: 'Sophie Gagnon',
    title: 'Gestionnaire',
    clinic: 'Clinique Familiale Québec',
    avatar: 'https://i.pravatar.cc/96?u=sophie-gagnon-mgr',
  },
]

function Stars() {
  return (
    <div className="flex gap-1 mb-5" aria-label="Note 5 sur 5 étoiles">
      {[...Array(5)].map((_, i) => (
        <svg
          key={i}
          className="w-5 h-5 text-yellow-400"
          fill="currentColor"
          viewBox="0 0 20 20"
          aria-hidden="true"
        >
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </div>
  )
}

export default function TestimonialsSection() {
  return (
    <section id="temoignages" className="py-20 bg-white">
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
            Témoignages
          </span>
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mt-2">
            Ce que disent nos clients
          </h2>
        </motion.div>

        {/* Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {testimonials.map((t, i) => (
            <motion.article
              key={i}
              className="flex flex-col bg-gray-50 rounded-2xl p-8 border border-gray-100 hover:shadow-md transition-shadow duration-300"
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
            >
              <Stars />
              <blockquote className="flex-1 text-gray-700 leading-relaxed italic mb-6 text-sm">
                &ldquo;{t.quote}&rdquo;
              </blockquote>
              <footer className="flex items-center gap-4">
                <img
                  src={t.avatar}
                  alt={`Photo de ${t.name}`}
                  width={48}
                  height={48}
                  className="w-12 h-12 rounded-full object-cover border-2 border-white shadow-sm"
                />
                <div>
                  <div className="font-semibold text-gray-900 text-sm">{t.name}</div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {t.title} · {t.clinic}
                  </div>
                </div>
              </footer>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  )
}
