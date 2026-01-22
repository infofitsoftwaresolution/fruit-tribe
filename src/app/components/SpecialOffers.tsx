import { motion } from 'motion/react';
import { Tag, Clock, TrendingUp, Gift } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export function SpecialOffers() {
  const navigate = useNavigate();

  const offers = [
    {
      icon: Tag,
      title: '25% Off',
      subtitle: 'Exotic Fruits',
      description: 'Special discount on dragon fruit, kiwi, and more exotic varieties',
      color: 'from-purple-500 to-pink-500',
      bgColor: 'from-purple-50 to-pink-50',
    },
    {
      icon: Clock,
      title: 'Flash Sale',
      subtitle: 'Berries Bundle',
      description: 'Mix of strawberries, blueberries & grapes - Limited time offer',
      color: 'from-red-500 to-orange-500',
      bgColor: 'from-red-50 to-orange-50',
    },
    {
      icon: Gift,
      title: 'Buy 2 Get 1',
      subtitle: 'Seasonal Fruits',
      description: 'Purchase any 2 items and get 1 free on selected fruits',
      color: 'from-green-500 to-teal-500',
      bgColor: 'from-green-50 to-teal-50',
    },
  ];

  return (
    <section className="py-20 bg-white relative overflow-hidden">
      {/* Background Decoration */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-orange-200/30 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-amber-200/30 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-orange-100 rounded-full mb-4">
            <TrendingUp className="w-4 h-4 text-orange-600" />
            <span className="text-sm font-medium text-orange-800">Limited Time Offers</span>
          </div>
          
          <h2 className="text-4xl md:text-5xl font-bold mb-4">
            <span className="bg-gradient-to-r from-orange-600 to-amber-600 bg-clip-text text-transparent">
              Special Deals
            </span>
          </h2>
          
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Don't miss out on our exclusive offers and amazing discounts
          </p>
        </motion.div>

        {/* Offers Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
          {offers.map((offer, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              whileHover={{ y: -10, scale: 1.02 }}
              className={`relative bg-gradient-to-br ${offer.bgColor} rounded-3xl p-8 shadow-lg hover:shadow-2xl transition-all overflow-hidden group cursor-pointer`}
              onClick={() => navigate('/products')}
            >
              {/* Icon */}
              <motion.div
                className={`w-16 h-16 bg-gradient-to-r ${offer.color} rounded-2xl flex items-center justify-center mb-6 shadow-lg`}
                whileHover={{ rotate: 360 }}
                transition={{ duration: 0.6 }}
              >
                <offer.icon className="w-8 h-8 text-white" />
              </motion.div>

              {/* Content */}
              <h3 className={`text-3xl font-bold mb-2 bg-gradient-to-r ${offer.color} bg-clip-text text-transparent`}>
                {offer.title}
              </h3>
              <h4 className="text-xl font-semibold text-gray-800 mb-3">
                {offer.subtitle}
              </h4>
              <p className="text-gray-600 leading-relaxed">
                {offer.description}
              </p>

              {/* Decorative Element */}
              <motion.div
                className={`absolute -bottom-10 -right-10 w-32 h-32 bg-gradient-to-r ${offer.color} rounded-full opacity-10 group-hover:opacity-20 transition-opacity`}
                animate={{
                  scale: [1, 1.2, 1],
                }}
                transition={{
                  duration: 3,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
              />
            </motion.div>
          ))}
        </div>

        {/* Call to Action Banner */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="relative bg-gradient-to-r from-orange-600 via-amber-600 to-orange-600 rounded-3xl p-12 overflow-hidden"
        >
          {/* Background Pattern */}
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-0 left-0 w-40 h-40 bg-white rounded-full -translate-x-1/2 -translate-y-1/2" />
            <div className="absolute bottom-0 right-0 w-60 h-60 bg-white rounded-full translate-x-1/3 translate-y-1/3" />
          </div>

          <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="text-white text-center md:text-left">
              <h3 className="text-3xl md:text-4xl font-bold mb-3">
                Subscribe & Save 15%
              </h3>
              <p className="text-white/90 text-lg">
                Join our fruit club and get exclusive deals delivered to your inbox
              </p>
            </div>

            <motion.button
              whileHover={{ scale: 1.05, y: -2 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => navigate('/subscription')}
              className="px-8 py-4 bg-white text-orange-600 rounded-full font-bold shadow-xl hover:shadow-2xl transition-all whitespace-nowrap"
            >
              Subscribe Now
            </motion.button>
          </div>
        </motion.div>
      </div>
    </section>
  );
}