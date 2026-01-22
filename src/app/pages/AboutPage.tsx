import { motion } from 'motion/react';
import { Leaf, Award, Truck, Heart, Users, Target, Globe } from 'lucide-react';
import { AboutSection } from '@/app/components/AboutSection';
import { StatsSection } from '@/app/components/StatsSection';
import { Testimonials } from '@/app/components/Testimonials';

export function AboutPage() {
  const values = [
    {
      icon: Leaf,
      title: 'Sustainability',
      description: 'We source our fruits from sustainable farms that prioritize environmental responsibility.',
    },
    {
      icon: Heart,
      title: 'Quality First',
      description: 'Every fruit is hand-selected to ensure only the finest quality reaches your table.',
    },
    {
      icon: Users,
      title: 'Community',
      description: 'We support local farmers and build strong relationships with our community.',
    },
    {
      icon: Globe,
      title: 'Global Reach',
      description: 'We bring exotic fruits from around the world while supporting local growers.',
    },
  ];

  return (
    <div className="pt-24 pb-16 min-h-screen bg-gradient-to-b from-white to-orange-50">
      {/* Hero Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-20">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <h1 className="text-5xl md:text-6xl font-bold mb-6">
            <span className="bg-gradient-to-r from-orange-600 to-amber-600 bg-clip-text text-transparent">
              About The Fruit Tribe
            </span>
          </h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            We're passionate about bringing you the freshest, highest-quality fruits from around the world,
            while supporting sustainable farming practices and local communities.
          </p>
        </motion.div>

        {/* Story Section */}
        <div className="grid md:grid-cols-2 gap-12 items-center mb-20">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
          >
            <h2 className="text-3xl font-bold text-gray-800 mb-4">Our Story</h2>
            <p className="text-gray-600 leading-relaxed mb-4">
              Founded in 2020, The Fruit Tribe began with a simple mission: to make fresh, high-quality
              fruits accessible to everyone. What started as a small local operation has grown into a
              trusted name in fresh fruit delivery.
            </p>
            <p className="text-gray-600 leading-relaxed">
              We work directly with farmers and growers around the world to ensure that every piece of
              fruit we deliver meets our strict quality standards. Our commitment to freshness, quality,
              and customer satisfaction drives everything we do.
            </p>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
            className="relative h-96 rounded-3xl overflow-hidden shadow-2xl"
          >
            <img
              src="https://images.unsplash.com/photo-1619566636858-adf3ef46400b?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080"
              alt="Fresh fruits"
              className="w-full h-full object-cover"
            />
          </motion.div>
        </div>
      </div>

      {/* Values Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-20">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <h2 className="text-4xl font-bold text-gray-800 mb-4">Our Values</h2>
          <p className="text-xl text-gray-600">What drives us every day</p>
        </motion.div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
          {values.map((value, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              whileHover={{ y: -8 }}
              className="bg-white rounded-2xl p-6 shadow-lg hover:shadow-2xl transition-all text-center"
            >
              <div className="w-16 h-16 bg-gradient-to-r from-orange-500 to-amber-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <value.icon className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-bold text-gray-800 mb-2">{value.title}</h3>
              <p className="text-gray-600">{value.description}</p>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Components */}
      <AboutSection />
      <StatsSection />
      <Testimonials />
    </div>
  );
}
