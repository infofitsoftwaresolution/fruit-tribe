import { motion } from 'framer-motion';
import { Star, Quote } from 'lucide-react';
import { useStore } from '@/app/context/StoreContext';

export function Testimonials() {
  const { theme } = useStore();

  const testimonials = [
    {
      name: 'Kriti Pal',
      rating: 5,
      text: 'The Alphonso mangoes are just mind-blowing! Reminded me of the ones we used to get directly from Ratnagiri. The sweetness and aroma are just perfect. Best quality I\'ve found online.',
    },
    {
      name: 'Anirban Pal',
      rating: 5,
      text: 'The Litchi I received was so juicy and sweet! It\'s very hard to find good quality Shahi Litchi in Bengaluru, but Fruit Tribe delivered perfectly. Very fresh and well-packed.',
    },
    {
      name: 'Shashank Shubham',
      rating: 5,
      text: 'I was skeptical about buying mangoes online, but these Kesar mangoes are incredible. No carbide, just pure natural ripeness. The Litchis are also very fresh and firm.',
    },
    {
      name: 'Manjeet Kumar',
      rating: 5,
      text: 'Excellent quality of Litchis and Mangoes. The delivery is prompt and the packing ensures the delicate fruits don\'t get bruised. Definitely my go-to for these seasonal fruits.',
    },
    {
      name: 'Dr. Santosh Ray',
      rating: 5,
      text: 'The nutritional value of these farm-fresh mangoes is evident in the taste. My family loves the Litchis too. Sourcing directly from orchards makes a huge difference.',
    },
  ];
  const reviewCount = testimonials.length;
  const averageRating = testimonials.length
    ? (testimonials.reduce((sum, t) => sum + t.rating, 0) / testimonials.length).toFixed(1)
    : '0.0';

  return (
    <section className="py-16 md:py-24 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Section header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 mb-12">
          <div className="max-w-lg">
            <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wider mb-2">
              Customer reviews
            </p>
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 tracking-tight">
              {theme.testimonialsTitle || 'What our customers say'}
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              {theme.testimonialsSubtitle || 'Genuine feedback from our growing community across Bengaluru.'}
            </p>
          </div>

          {/* Overall rating summary */}
          <div className="flex items-center gap-3 p-4 rounded-2xl bg-slate-50 border border-slate-100 shrink-0">
            <div className="text-center">
              <p className="text-3xl font-bold text-slate-900">{averageRating}</p>
              <div className="flex items-center gap-0.5 mt-1 justify-center">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                ))}
              </div>
              <p className="text-xs text-slate-400 mt-1">{reviewCount} {reviewCount === 1 ? 'review' : 'reviews'}</p>
            </div>
          </div>
        </div>

        {/* Testimonials grid */}
        <div className="grid md:grid-cols-2 gap-5">
          {testimonials.map((testimonial, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.08 }}
              className="relative bg-white rounded-2xl p-7 border border-slate-100 hover:border-emerald-200 hover:shadow-sm transition-all duration-300"
            >
              {/* Quote icon */}
              <Quote className="absolute top-6 right-6 w-8 h-8 text-slate-100" />

              {/* Stars */}
              <div className="flex items-center gap-0.5 mb-4">
                {[...Array(testimonial.rating)].map((_, i) => (
                  <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />
                ))}
              </div>

              {/* Review text — natural case, readable */}
              <p className="text-sm text-slate-700 leading-relaxed mb-6">
                "{testimonial.text}"
              </p>

              {/* Author Avatar & Name */}
              <div className="flex items-center gap-3 pt-5 border-t border-slate-50">
                <div className="w-10 h-10 rounded-full bg-emerald-100 border border-emerald-200 flex items-center justify-center text-emerald-700 font-bold text-sm">
                  {testimonial.name.charAt(0)}
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900">{testimonial.name}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
