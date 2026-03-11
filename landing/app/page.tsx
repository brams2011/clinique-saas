import Navbar from '@/components/Navbar'
import HeroSection from '@/components/HeroSection'
import TrustLogos from '@/components/TrustLogos'
import FeaturesSection from '@/components/FeaturesSection'
import VideoDemoSection from '@/components/VideoDemoSection'
import PricingSection from '@/components/PricingSection'
import TestimonialsSection from '@/components/TestimonialsSection'
import FAQSection from '@/components/FAQSection'
import CTASection from '@/components/CTASection'
import Footer from '@/components/Footer'

export default function HomePage() {
  return (
    <main className="overflow-x-hidden">
      <Navbar />
      <HeroSection />
      <TrustLogos />
      <FeaturesSection />
      <VideoDemoSection />
      <PricingSection />
      <TestimonialsSection />
      <FAQSection />
      <CTASection />
      <Footer />
    </main>
  )
}
