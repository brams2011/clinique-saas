'use client'

import { motion } from 'framer-motion'
import { Play, Clock, CheckCircle } from 'lucide-react'
import { useState } from 'react'

export default function VideoDemoSection() {
  const [hovered, setHovered] = useState(false)

  return (
    <section id="demo" className="py-20 bg-primary">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          className="text-center mb-12"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-3">
            Voyez CliniqueSaaS en action
          </h2>
          <p className="text-white/70 text-lg">Démo complète en 3 minutes</p>
        </motion.div>

        {/* Video placeholder */}
        <motion.div
          className="max-w-4xl mx-auto"
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          <div
            className="relative rounded-2xl overflow-hidden cursor-pointer"
            style={{ aspectRatio: '16/9' }}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            role="button"
            tabIndex={0}
            aria-label="Lancer la démonstration vidéo de CliniqueSaaS"
            onKeyDown={(e) => e.key === 'Enter' && setHovered(true)}
          >
            {/* Background */}
            <div className="absolute inset-0 bg-primary-dark">
              {/* Dot grid pattern */}
              <div
                className="absolute inset-0 opacity-20"
                style={{
                  backgroundImage:
                    'radial-gradient(circle, rgba(255,255,255,0.4) 1px, transparent 1px)',
                  backgroundSize: '32px 32px',
                }}
              />

              {/* Subtle gradient overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-primary-dark/80 via-transparent to-transparent" />
            </div>

            {/* Mock UI preview */}
            <div className="absolute inset-0 flex items-center justify-center opacity-20">
              <div className="w-3/4 bg-white rounded-xl p-4 shadow-2xl">
                <div className="h-3 bg-gray-200 rounded mb-2 w-1/2" />
                <div className="grid grid-cols-3 gap-2 mb-3">
                  <div className="h-12 bg-primary-100 rounded-lg" />
                  <div className="h-12 bg-accent-100 rounded-lg" />
                  <div className="h-12 bg-blue-100 rounded-lg" />
                </div>
                <div className="space-y-1.5">
                  <div className="h-2 bg-gray-200 rounded w-full" />
                  <div className="h-2 bg-gray-200 rounded w-4/5" />
                  <div className="h-2 bg-gray-200 rounded w-3/5" />
                </div>
              </div>
            </div>

            {/* Play button */}
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <div
                className={`w-20 h-20 bg-white rounded-full flex items-center justify-center shadow-2xl transition-all duration-300 mb-4 ${
                  hovered ? 'scale-110' : 'scale-100'
                }`}
              >
                <Play
                  className="w-8 h-8 text-primary ml-1"
                  aria-hidden="true"
                />
              </div>
              <p className="text-white/80 text-sm font-medium">
                Cliquez pour voir la démo
              </p>
            </div>

            {/* Top-left badge */}
            <div className="absolute top-4 left-4 flex items-center gap-1.5 bg-white/10 backdrop-blur-sm rounded-lg px-3 py-1.5">
              <Clock className="w-3.5 h-3.5 text-white/80" aria-hidden="true" />
              <span className="text-white/90 text-xs font-medium">3 min</span>
            </div>

            {/* Top-right badge */}
            <div className="absolute top-4 right-4 flex items-center gap-1.5 bg-accent/80 backdrop-blur-sm rounded-lg px-3 py-1.5">
              <CheckCircle className="w-3.5 h-3.5 text-white" aria-hidden="true" />
              <span className="text-white text-xs font-semibold">Démo gratuite</span>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
