const logos = [
  'Clinique Santé Plus',
  'Groupe Médical Montréal',
  'Centre Médical Laval',
  'Clinique Familiale Québec',
  'Santé Globale Inc.',
  'MédiCentre Rive-Sud',
]

export default function TrustLogos() {
  return (
    <section className="py-14 bg-gray-50 border-y border-gray-100" aria-label="Nos clients">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <p className="text-center text-xs font-semibold text-gray-400 uppercase tracking-widest mb-8">
          Ils nous font confiance
        </p>
        <div className="flex flex-wrap justify-center gap-4">
          {logos.map((logo, i) => (
            <div
              key={i}
              className="flex items-center justify-center px-6 py-3 bg-white rounded-xl border border-gray-200 shadow-sm min-w-[150px] hover:border-primary-100 transition-colors"
            >
              <span className="text-sm font-semibold text-gray-400">{logo}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
