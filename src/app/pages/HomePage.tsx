import { Hero } from '@/app/components/Hero';
import { FeaturedProducts } from '@/app/components/FeaturedPeoducts';
import { AboutSection } from '@/app/components/AboutSection';
import { HowItWorks } from '@/app/components/HowItWorks';
import { SeasonalHighlights } from '@/app/components/SeasonalHighlights';
import { SpecialOffers } from '@/app/components/SpecialOffers';
import { Testimonials } from '@/app/components/Testimonials';
import { StatsSection } from '@/app/components/StatsSection';
import { WhyChooseUs } from '@/app/components/WhyChooseUs';
import { RecipesSection } from '@/app/components/RecipesSection';
import { NewsletterSection } from '@/app/components/NewsletterSection';
import { ParallaxBanner } from '@/app/components/ParallaxBanner';

interface HomePageProps {
  onAddToCart: (id: number) => void;
}

export function HomePage({ onAddToCart }: HomePageProps) {
  return (
    <div className="pt-20">
      <Hero />
      <FeaturedProducts onAddToCart={onAddToCart} />
      <AboutSection />
      <HowItWorks />
      <SeasonalHighlights />
      <ParallaxBanner />
      <SpecialOffers />
      <WhyChooseUs />
      <Testimonials />
      <RecipesSection />
      <StatsSection />
      <NewsletterSection />
    </div>
  );
}
