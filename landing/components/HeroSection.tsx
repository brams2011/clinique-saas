'use client'

import { motion } from 'framer-motion'
import { ArrowRight, Play, Calendar, Users, TrendingUp, Monitor } from 'lucide-react'

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 30 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.6, delay, ease: 'easeOut' },
})

const stats = [
  { value: '500+', label: 'cliniques' },
  { value: '98%', label: 'satisfaction' },
  { value: '24/7', label: 'Support' },
]

const mockAppointments = [
  { time: '09:00', patient: 'Marie Dupont', type: 'Consultation', color: 'bg-primary' },
  { time: '10:30', patient: 'Jean Martin', type: 'Suivi', color: 'bg-accent' },
  { time: '11:00', patient: 'Sophie Gagnon', type: 'Bilan annuel', color: 'bg-primary' },
  { time: '14:00', patient: 'Ahmed Ben Ali', type: 'Consultation', color: 'bg-accent' },
]

const mockStats = [
  { icon: Calendar, label: "RDV aujourd'hui", value: '24', colorClass: 'bg-primary-50 text-primary' },
  { icon: Users, label: 'Patients actifs', value: '1 247', colorClass: 'bg-accent-50 text-accent' },
  { icon: TrendingUp, label: 'Revenus (mois)', value: '48 200$', colorClass: 'bg-blue-50 text-blue-600' },
]

export default function HeroSection() {
  return (
    <section className="pt-24 pb-20 bg-gradient-to-br from-primary-50 via-white to-accent-50 overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* ── Left: Text ── */}
          <div>
            {/* Badge pill */}
            <motion.div {...fadeUp(0)}>
              <span className="inline-flex items-center gap-2 px-4 py-2 bg-accent-50 text-accent rounded-full text-sm font-semibold border border-accent-100 mb-6">
                ✨ Nouveau — Facturation automatique disponible
              </span>
            </motion.div>

            {/* H1 */}
            <motion.h1
              className="text-4xl sm:text-5xl font-extrabold text-gray-900 leading-tight mb-5"
              {...fadeUp(0.1)}
            >
              La plateforme{' '}
              <span className="text-primary">tout-en-un</span>{' '}
              pour gérer votre clinique
            </motion.h1>

            {/* Subtitle */}
            <motion.p
              className="text-lg text-gray-600 leading-relaxed mb-8"
              {...fadeUp(0.2)}
            >
              Rendez-vous, dossiers patients, facturation RAMQ et communication
              — tout en un seul endroit.
            </motion.p>

            {/* CTA buttons */}
            <motion.div className="flex flex-wrap gap-4 mb-10" {...fadeUp(0.3)}>
              <a
                href="#"
                className="inline-flex items-center gap-2 px-6 py-3.5 bg-primary text-white rounded-xl font-semibold text-base hover:bg-primary-dark transition-colors shadow-lg"
                aria-label="Démarrer votre essai gratuit de CliniqueSaaS"
              >
                Démarrer gratuitement
                <ArrowRight className="w-5 h-5" />
              </a>
              <a
                href="#demo"
                className="inline-flex items-center gap-2 px-6 py-3.5 border-2 border-primary text-primary rounded-xl font-semibold text-base hover:bg-primary-50 transition-colors"
                aria-label="Voir la démonstration vidéo de CliniqueSaaS"
              >
                <Play className="w-5 h-5" />
                Voir la démo
              </a>
            </motion.div>

            {/* Stats */}
            <motion.div
              className="flex flex-wrap items-center gap-0"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.5 }}
            >
              {stats.map((stat, i) => (
                <div key={i} className="flex items-center">
                  {i > 0 && <div className="w-px h-10 bg-gray-200 mx-6" />}
                  <div>
                    <div className="text-2xl font-extrabold text-primary leading-none">
                      {stat.value}
                    </div>
                    <div className="text-sm text-gray-500 mt-0.5">{stat.label}</div>
                  </div>
                </div>
              ))}
            </motion.div>
          </div>

          {/* ── Right: Dashboard Mockup ── */}
          <motion.div
            className="relative"
            initial={{ opacity: 0, x: 60 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.2, ease: 'easeOut' }}
          >
            {/* Main card */}
            <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 p-5 relative z-10">
              {/* Window controls */}
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-100">
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-400" />
                  <div className="w-3 h-3 rounded-full bg-yellow-400" />
                  <div className="w-3 h-3 rounded-full bg-green-400" />
                </div>
                <div className="flex items-center gap-1.5 text-xs text-gray-400 bg-gray-50 rounded-md px-3 py-1.5">
                  <Monitor className="w-3 h-3" aria-hidden="true" />
                  <span>CliniqueSaaS — Dashboard</span>
                </div>
                <div className="w-16" />
              </div>

              {/* Stats row */}
              <div className="grid grid-cols-3 gap-3 mb-4">
                {mockStats.map((item, i) => (
                  <div key={i} className={`rounded-xl p-3 ${item.colorClass}`}>
                    <item.icon className="w-4 h-4 mb-1.5" aria-hidden="true" />
                    <div className="text-xs font-medium opacity-70 leading-tight">{item.label}</div>
                    <div className="text-lg font-bold mt-0.5">{item.value}</div>
                  </div>
                ))}
              </div>

              {/* Schedule */}
              <div className="bg-gray-50 rounded-xl p-3 mb-3">
                <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                  Agenda du jour
                </div>
                <div className="space-y-1">
                  {mockAppointments.map((appt, i) => (
                    <div key={i} className="flex items-center gap-3 py-1.5 border-b border-gray-100 last:border-0">
                      <span className="text-xs text-gray-400 w-10 flex-shrink-0">{appt.time}</span>
                      <div className={`w-1 h-7 rounded-full flex-shrink-0 ${appt.color}`} />
                      <div>
                        <div className="text-xs font-semibold text-gray-800">{appt.patient}</div>
                        <div className="text-xs text-gray-400">{appt.type}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Occupation rate */}
              <div className="bg-gray-50 rounded-xl p-3">
                <div className="flex justify-between items-center text-xs mb-2">
                  <span className="text-gray-500">Taux d&apos;occupation</span>
                  <span className="font-bold text-primary">87%</span>
                </div>
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-primary to-accent"
                    style={{ width: '87%' }}
                  />
                </div>
              </div>
            </div>

            {/* Floating card: RAMQ */}
            <div className="absolute -right-4 top-1/4 bg-white rounded-xl shadow-lg p-3 border border-gray-100 z-20 hidden sm:block">
              <div className="text-xs text-gray-400 mb-0.5">Facturation RAMQ</div>
              <div className="text-sm font-bold text-accent">✓ Envoyée</div>
            </div>

            {/* Floating card: IA */}
            <div className="absolute -left-4 bottom-1/4 bg-white rounded-xl shadow-lg p-3 border border-gray-100 z-20 hidden sm:block">
              <div className="text-xs text-gray-400 mb-0.5">Agent IA</div>
              <div className="text-sm font-bold text-primary">🤖 Actif 24/7</div>
            </div>

            {/* Background glow */}
            <div className="absolute inset-0 -z-10 translate-x-4 translate-y-4 bg-primary-100 rounded-2xl opacity-50" />
          </motion.div>
        </div>
      </div>
    </section>
  )
}
