'use client'

import { motion } from 'framer-motion'
import { ArrowRight, Lock, RefreshCw } from 'lucide-react'
import { useState } from 'react'

export default function CTASection() {
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || loading) return
    console.log('[analytics] cta_final click', { email })
    setLoading(true)
    try {
      await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, source: 'landing' }),
      })
    } catch {
      // on soumet quand même (UX non bloquante)
    } finally {
      setLoading(false)
      setSubmitted(true)
    }
  }

  return (
    <section className="py-24 relative overflow-hidden">
      {/* Gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary-dark via-primary to-primary-light" />

      {/* Decorative circles */}
      <div className="absolute -top-20 -right-20 w-80 h-80 bg-white/5 rounded-full" />
      <div className="absolute -bottom-20 -left-20 w-96 h-96 bg-white/5 rounded-full" />

      <div className="relative max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white mb-4 leading-tight">
            Prêt à moderniser votre clinique ?
          </h2>
          <p className="text-lg text-white/75 mb-10 leading-relaxed">
            Rejoignez 500+ cliniques qui font confiance à CliniqueSaaS
          </p>

          {submitted ? (
            <motion.div
              className="bg-white/10 backdrop-blur-sm rounded-2xl px-8 py-6 border border-white/20"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
            >
              <div className="text-2xl mb-2">🎉</div>
              <p className="text-white font-semibold text-lg">✓ Vérifiez votre email !</p>
              <p className="text-white/70 text-sm mt-1">
                Votre accès arrive dans quelques secondes.
              </p>
            </motion.div>
          ) : (
            <form
              className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto mb-5"
              onSubmit={handleSubmit}
              noValidate
            >
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="votre@email.com"
                required
                className="flex-1 px-5 py-3.5 rounded-xl bg-white text-gray-900 placeholder-gray-400 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-white/50 shadow-lg"
                aria-label="Adresse email pour démarrer votre essai gratuit"
              />
              <button
                type="submit"
                disabled={loading}
                className="inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-accent hover:bg-accent-light text-white font-semibold text-sm rounded-xl transition-colors shadow-lg whitespace-nowrap disabled:opacity-60 disabled:cursor-not-allowed"
                aria-label="Démarrer gratuitement CliniqueSaaS"
              >
                {loading ? 'Envoi…' : 'Démarrer gratuitement'}
                {!loading && <ArrowRight className="w-4 h-4" aria-hidden="true" />}
              </button>
            </form>
          )}

          {/* Trust signals */}
          <div className="flex flex-wrap items-center justify-center gap-5 text-white/60 text-xs font-medium">
            <span className="flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5" aria-hidden="true" />
              Aucune carte bancaire requise
            </span>
            <span className="hidden sm:block text-white/30">·</span>
            <span className="flex items-center gap-1.5">
              <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
              Annulation à tout moment
            </span>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
