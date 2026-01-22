import { motion } from 'motion/react';
import { Leaf, Award, Truck, Heart, Shield, Users } from 'lucide-react';

export function AboutSection() {
  const features = [
    {
      icon: Leaf,
      title: '100% Organic',
      description: 'All our fruits are grown without harmful pesticides or chemicals',
    },
    {
      icon: Award,
      title: 'Premium Quality',
      description: 'Hand-picked and carefully selected for the highest quality',
    },
    {
      icon: Truck,
      title: 'Fast Delivery',
      description: 'Same-day delivery available in most areas',
    },
    {
      icon: Heart,
      title: 'Health First',
      description: 'Nutrient-rich fruits to support your healthy lifestyle',
    },
    {
      icon: Shield,
      title: 'Quality Assured',
      description: 'Every fruit goes through rigorous quality checks',
    },
    {
      icon: Users,
      title: 'Customer Love',
      description: 'Join 50,000+ happy customers who trust us',
    },
  ];

  return (
    <section className="py-20 bg-gradient-to-b from-orange-50 to-white relative overflow-hidden">
      {/* Background Elements */}
      <div className="absolute inset-0 overflow-hidden">
        <motion.div
          className="absolute top-20 right-10 w-64 h-64 bg-green-300/20 rounded-full blur-3xl"
          animate={{
            scale: [1, 1.3, 1],
            x: [0, 50, 0],
          }}
          transition={{
            duration: 15,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />
        <motion.div
          className="absolute bottom-20 left-10 w-80 h-80 bg-orange-300/20 rounded-full blur-3xl"
          animate={{
            scale: [1.2, 1, 1.2],
            x: [0, -30, 0],
          }}
          transition={{
            duration: 12,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />
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
          <h2 className="text-4xl md:text-5xl font-bold mb-4">
            <span className="bg-gradient-to-r from-orange-600 to-amber-600 bg-clip-text text-transparent">
              Why Choose Us
            </span>
          </h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            We're committed to bringing you the freshest, healthiest fruits with exceptional service
          </p>
        </motion.div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              whileHover={{ y: -8, scale: 1.02 }}
              className="relative bg-white rounded-2xl p-8 shadow-lg hover:shadow-2xl transition-all group"
            >
              {/* Icon Container */}
              <motion.div
                whileHover={{ rotate: 360 }}
                transition={{ duration: 0.6 }}
                className="w-16 h-16 bg-gradient-to-r from-orange-500 to-amber-500 rounded-2xl flex items-center justify-center mb-6 shadow-md group-hover:shadow-lg"
              >
                <feature.icon className="w-8 h-8 text-white" />
              </motion.div>

              {/* Content */}
              <h3 className="text-xl font-bold text-gray-800 mb-3">
                {feature.title}
              </h3>
              <p className="text-gray-600 leading-relaxed">
                {feature.description}
              </p>

              {/* Hover Effect */}
              <motion.div
                className="absolute inset-0 rounded-2xl border-2 border-transparent group-hover:border-orange-200 transition-all"
              />
            </motion.div>
          ))}
        </div>

        {/* Stats Section */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="mt-20 bg-gradient-to-r from-orange-600 via-amber-600 to-orange-600 rounded-3xl p-12 relative overflow-hidden"
        >
          {/* Background Pattern */}
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-0 left-1/4 w-40 h-40 bg-white rounded-full" />
            <div className="absolute bottom-0 right-1/4 w-60 h-60 bg-white rounded-full" />
          </div>

          <div className="relative z-10 grid grid-cols-2 md:grid-cols-4 gap-8">
            {[
              { value: '100+', label: 'Fruit Varieties' },
              { value: '50K+', label: 'Happy Customers' },
              { value: '99%', label: 'Satisfaction Rate' },
              { value: '24/7', label: 'Customer Support' },
            ].map((stat, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, scale: 0.5 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className="text-center text-white"
              >
                <motion.div
                  className="text-4xl md:text-5xl font-bold mb-2"
                  whileHover={{ scale: 1.1 }}
                >
                  {stat.value}
                </motion.div>
                <div className="text-white/90 font-medium">{stat.label}</div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
