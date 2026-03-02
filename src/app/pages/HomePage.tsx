import { useStore } from '@/app/context/StoreContext';
import { Hero } from '@/app/components/Hero';
import { FeaturedProducts } from '@/app/components/FeaturedProducts';
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
  const { theme } = useStore();

  return (
    <div>
      <Hero />
      {theme.showFeaturedProducts !== false && <FeaturedProducts onAddToCart={onAddToCart} />}
      <AboutSection />
      {theme.showHowItWorks !== false && <HowItWorks />}
      {theme.showSeasonalHighlights !== false && <SeasonalHighlights />}
      <ParallaxBanner />
      {theme.showSpecialOffers !== false && <SpecialOffers />}
      <WhyChooseUs />
      {theme.showTestimonials !== false && <Testimonials />}
      {theme.showRecipes !== false && <RecipesSection />}
      {theme.showStats !== false && <StatsSection />}
      {theme.showNewsletter !== false && <NewsletterSection />}
    </div>
  );
}
