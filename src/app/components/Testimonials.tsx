import { motion } from 'motion/react';
import { Star, Quote } from 'lucide-react';
import { useState } from 'react';

export function Testimonials() {
  const [activeIndex, setActiveIndex] = useState(0);

  const testimonials = [
    {
      name: 'Sarah Johnson',
      role: 'Health Enthusiast',
      image: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150',
      rating: 5,
      text: 'The quality of fruits is absolutely amazing! Fresh, juicy, and always delivered on time. My family loves the subscription service!',
    },
    {
      name: 'Michael Chen',
      role: 'Fitness Coach',
      image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
      rating: 5,
      text: 'As a fitness coach, I recommend The Fruit Tribe to all my clients. The variety and freshness is unmatched!',
    },
    {
      name: 'Emily Rodriguez',
      role: 'Busy Mom',
      image: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150',
      rating: 5,
      text: 'Saves me so much time! No more grocery store trips for fruits. Everything arrives fresh and ready to eat.',
    },
    {
      name: 'David Kim',
      role: 'Chef',
      image: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150',
      rating: 5,
      text: 'The exotic fruits collection is incredible. I use them in my restaurant and guests are always impressed!',
    },
  ];

  return (
    <section className="py-20 bg-gradient-to-b from-orange-50/30 to-white relative overflow-hidden">
      {/* Decorative Background */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-orange-400 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-amber-400 rounded-full blur-3xl" />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <motion.div
            animate={{
              rotate: [0, 10, -10, 0],
            }}
            transition={{
              duration: 4,
              repeat: Infinity,
              ease: "easeInOut"
            }}
            className="inline-block mb-6"
          >
            <Quote className="w-16 h-16 text-orange-600" />
          </motion.div>
          
          <h2 className="text-5xl md:text-6xl font-bold mb-6">
            <span className="bg-gradient-to-r from-orange-600 to-amber-600 bg-clip-text text-transparent">
              What Our Customers Say
            </span>
          </h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Don't just take our word for it. Hear from thousands of satisfied customers!
          </p>
        </motion.div>

        {/* Testimonials Grid */}
        <div className="grid md:grid-cols-2 gap-8 mb-12">
          {testimonials.map((testimonial, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: index * 0.1 }}
              whileHover={{ y: -10 }}
              onHoverStart={() => setActiveIndex(index)}
              className={`relative bg-white rounded-3xl p-8 shadow-lg hover:shadow-2xl transition-all ${
                activeIndex === index ? 'ring-4 ring-orange-400' : ''
              }`}
            >
              {/* Quote Icon Background */}
              <div className="absolute top-4 right-4 opacity-10">
                <Quote className="w-24 h-24 text-orange-600" />
              </div>

              {/* Content */}
              <div className="relative z-10">
                {/* Stars */}
                <div className="flex items-center gap-1 mb-4">
                  {[...Array(testimonial.rating)].map((_, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, scale: 0 }}
                      whileInView={{ opacity: 1, scale: 1 }}
                      viewport={{ once: true }}
                      transition={{ delay: index * 0.1 + i * 0.05 }}
                    >
                      <Star className="w-5 h-5 fill-amber-400 text-amber-400" />
                    </motion.div>
                  ))}
                </div>

                {/* Text */}
                <p className="text-gray-700 text-lg mb-6 leading-relaxed">
                  "{testimonial.text}"
                </p>

                {/* Author */}
                <div className="flex items-center gap-4">
                  <motion.img
                    whileHover={{ scale: 1.1, rotate: 5 }}
                    src={testimonial.image}
                    alt={testimonial.name}
                    className="w-16 h-16 rounded-full object-cover border-4 border-orange-200"
                  />
                  <div>
                    <h4 className="font-bold text-gray-800 text-lg">{testimonial.name}</h4>
                    <p className="text-gray-600">{testimonial.role}</p>
                  </div>
                </div>
              </div>

              {/* Hover Glow */}
              <motion.div
                className="absolute inset-0 bg-gradient-to-r from-orange-400 to-amber-400 opacity-0 rounded-3xl blur-2xl transition-opacity duration-500"
                animate={{ opacity: activeIndex === index ? 0.1 : 0 }}
              />
            </motion.div>
          ))}
        </div>

        {/* Trust Badge */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.6 }}
          className="text-center"
        >
          <div className="inline-flex items-center gap-3 bg-gradient-to-r from-orange-50 to-amber-50 px-8 py-4 rounded-full shadow-lg">
            <div className="flex -space-x-2">
              {testimonials.slice(0, 4).map((testimonial, index) => (
                <img
                  key={index}
                  src={testimonial.image}
                  alt={testimonial.name}
                  className="w-10 h-10 rounded-full border-2 border-white object-cover"
                />
              ))}
            </div>
            <div className="text-left">
              <div className="font-bold text-gray-800">50,000+ Happy Customers</div>
              <div className="text-sm text-gray-600">Join our community today!</div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
